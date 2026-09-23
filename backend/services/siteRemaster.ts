import { prisma } from '../db';
import { executeAIRequest } from '../services/aiEngine';
import { uploadAssetToStorage } from './storageService';
import { projectJobsQueue } from '../routes/projects';
import https from 'https';
import http from 'http';
import crypto from 'crypto';

interface ScrapedPage {
  url: string;
  slug: string;
  name: string;
  html: string;
  cleanText: string;
  media?: string[]; // Lista de URLs de mídias detectadas
  originalHtml?: string;
  rewrittenHtml?: string;
}

/**
 * Detecta mídias em um HTML
 */
export function detectMedia(html: string, baseUrl: string): string[] {
  const mediaUrls = new Set<string>();
  const assetRegex = /(src|poster|href)=["']([^"'#?]+(\.(png|jpe?g|gif|svg|webp|mp4|webm)))(\?[^"']*)?["']/gi;
  const matches = html.matchAll(assetRegex);
  
  for (const match of matches) {
    try {
      const fullUrl = new URL(match[2], baseUrl).href;
      mediaUrls.add(fullUrl);
    } catch (e) {}
  }
  
  // Background images
  const bgRegex = /url\(["']?([^"'#?]+(\.(png|jpe?g|gif|svg|webp)))(\?[^"']*)?["']?\)/gi;
  const bgMatches = html.matchAll(bgRegex);
  for (const match of bgMatches) {
    try {
      const fullUrl = new URL(match[1], baseUrl).href;
      mediaUrls.add(fullUrl);
    } catch (e) {}
  }

  return Array.from(mediaUrls);
}

/**
 * Baixa um recurso binário de uma URL
 */
async function downloadAsset(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      rejectUnauthorized: false,
      timeout: 15000
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const u = new URL(url);
          redirectUrl = `${u.origin}${redirectUrl}`;
        }
        return downloadAsset(redirectUrl).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Falha ao baixar asset: ${res.statusCode}`));
      }

      const chunks: any[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: res.headers['content-type'] || 'application/octet-stream'
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout ao baixar asset'));
    });
  });
}

/**
 * Auxiliar para registrar mídia e asset baixados no banco de dados de forma robusta e segura.
 */
async function registerDownloadedMedia(
  fileName: string,
  url: string,
  size: number,
  contentType: string,
  isMinio: boolean,
  userId?: string,
  projectId?: string
) {
  // 1. Resolve userId se estiver vazio
  let resolvedUserId = userId;
  if (!resolvedUserId && projectId) {
    try {
      const member = await prisma.projectMember.findFirst({
        where: { projectId }
      });
      if (member) resolvedUserId = member.userId;
    } catch (_) {}
  }
  if (!resolvedUserId) {
    try {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) resolvedUserId = firstUser.id;
    } catch (_) {}
  }

  // 2. Registrar no model Media (sem coluna inexistente projectId)
  if (resolvedUserId) {
    try {
      await prisma.media.create({
        data: {
          id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: fileName,
          url,
          size,
          mimeType: contentType,
          storage: isMinio ? 'minio' : 'local',
          userId: resolvedUserId
        }
      });
    } catch (e) {
      console.warn('[Remaster] Erro ao registrar mídia na tabela Media:', e);
    }
  }

  // 3. Registrar como Asset do projeto se tiver projectId
  if (projectId) {
    try {
      let assetType = 'image';
      const lowerMime = contentType.toLowerCase();
      if (lowerMime.includes('video')) assetType = 'video';
      else if (lowerMime.includes('font') || fileName.endsWith('.woff') || fileName.endsWith('.woff2') || fileName.endsWith('.ttf') || fileName.endsWith('.otf')) assetType = 'font';
      else if (lowerMime.includes('icon') || fileName.endsWith('.ico')) assetType = 'icon';

      await prisma.asset.create({
        data: {
          id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: fileName,
          type: assetType,
          url,
          projectId
        }
      });
    } catch (e) {
      console.warn('[Remaster] Erro ao registrar asset do projeto:', e);
    }
  }
}

/**
 * Auxiliar para verificar se um link é base64, interno ou já baixado localmente
 */
function isLocalOrBase64(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  if (lower.startsWith('data:')) return true;
  if (lower.startsWith('/api/media/files/')) return true;
  if (lower.startsWith('/data/uploads/')) return true;
  if (lower.includes('/api/media/files/')) return true;
  if (lower.includes('/data/uploads/')) return true;
  if (lower.startsWith('assets/') || lower.startsWith('./assets/') || lower.startsWith('../assets/')) return true;
  return false;
}

/**
 * Detecta e substitui mídias em um HTML de forma robusta e as salva no banco/armazenamento
 */
export async function processPageAssets(
  html: string, 
  baseUrl: string, 
  assetCache: Map<string, string>,
  userId?: string,
  projectId?: string,
  aiProvider?: string,
  ollamaEndpoint?: string
): Promise<string> {
  let rewrittenHtml = html;
  
  // Coletar mídias candidatas usando estratégias robustas:
  // 1. Regex de atributos padrão e de lazy load
  const assetRegex = /(src|href|poster|data-src|data-bg|data-original|data-lazy-src)=["']([^"'#?]+(\.(png|jpe?g|gif|svg|webp|mp4|webm|css|js|woff2?))(\?[^"']*)?)["']/gi;
  const matches = [...html.matchAll(assetRegex)];
  
  // 2. Regex de mídias absolutas externas (para URLs externas dinâmicas sem extensão de arquivo visível)
  const absoluteMediaRegex = /(src|data-src|data-bg|data-original|data-lazy-src|poster)=["'](https?:\/\/[^"'#?]+(\?[^"']*)?)["']/gi;
  const absMatches = [...html.matchAll(absoluteMediaRegex)];

  // 3. Regex para srcset em imagens responsivas
  const srcsetRegex = /srcset=["']([^"']+)["']/gi;
  const srcsetMatches = [...html.matchAll(srcsetRegex)];
  const srcsetUrls = new Set<string>();
  for (const m of srcsetMatches) {
    const parts = m[1].split(',');
    for (const part of parts) {
      const u = part.trim().split(/\s+/)[0];
      if (u) srcsetUrls.add(u);
    }
  }

  // Combinar em um conjunto único de URLs originais para evitar duplicados
  const candidateUrls = new Set<string>();
  for (const m of matches) {
    candidateUrls.add(m[2]);
  }
  for (const m of absMatches) {
    candidateUrls.add(m[2]);
  }
  for (const u of srcsetUrls) {
    candidateUrls.add(u);
  }

  for (const originalUrl of candidateUrls) {
    if (isLocalOrBase64(originalUrl)) {
      continue;
    }

    try {
      // Resolve a URL (se for absoluta, a classe URL a usará diretamente sem problemas)
      const fullUrl = new URL(originalUrl, baseUrl || undefined).href;
      
      if (assetCache.has(fullUrl)) {
        rewrittenHtml = rewrittenHtml.split(originalUrl).join(assetCache.get(fullUrl)!);
        continue;
      }

      console.log(`[Remaster] Baixando e salvando asset: ${fullUrl}`);
      const { buffer, contentType } = await downloadAsset(fullUrl);
      
      // Deduz a extensão correta baseada no content-type ou na URL original
      let ext = fullUrl.split('/').pop()?.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
      const knownExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'webm', 'css', 'js', 'woff2', 'woff', 'ttf', 'otf', 'ico'];
      if (!knownExtensions.includes(ext)) {
        const mimeToExt: Record<string, string> = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/gif': 'gif',
          'image/svg+xml': 'svg',
          'image/webp': 'webp',
          'video/mp4': 'mp4',
          'video/webm': 'webm',
          'text/css': 'css',
          'application/javascript': 'js',
          'text/javascript': 'js'
        };
        const mimeClean = contentType.split(';')[0].toLowerCase().trim();
        ext = mimeToExt[mimeClean] || 'png'; // default para png se for imagem externa sem extensão clara
      }

      const rawFileName = fullUrl.split('/').pop()?.split('?')[0]?.replace(/\.[a-zA-Z0-9]+$/, '') || 'asset';
      const fileName = `${crypto.randomBytes(4).toString('hex')}_${rawFileName}.${ext}`;

      const uploadRes = await uploadAssetToStorage(buffer, fileName, contentType, projectId);
      
      // Registrar no banco de dados com segurança
      await registerDownloadedMedia(
        fileName,
        uploadRes.url,
        uploadRes.size,
        contentType,
        uploadRes.isMinio,
        userId,
        projectId
      );

      assetCache.set(fullUrl, uploadRes.url);
      rewrittenHtml = rewrittenHtml.split(originalUrl).join(uploadRes.url);
    } catch (err) {
      console.warn(`[Remaster] Erro ao processar asset ${originalUrl}:`, (err as Error).message);
    }
  }

  // Regex para background-images no estilo inline ou tags <style>
  const bgRegex = /url\(['"]?([^)'"]+)['"]?\)/gi;
  const bgMatches = [...rewrittenHtml.matchAll(bgRegex)];
  
  for (const match of bgMatches) {
    const originalUrl = match[1];
    if (isLocalOrBase64(originalUrl)) {
      continue;
    }
    
    try {
      const fullUrl = new URL(originalUrl, baseUrl || undefined).href;
      if (assetCache.has(fullUrl)) {
        rewrittenHtml = rewrittenHtml.split(originalUrl).join(assetCache.get(fullUrl)!);
        continue;
      }
      
      console.log(`[Remaster] Baixando e salvando bg-image: ${fullUrl}`);
      const { buffer, contentType } = await downloadAsset(fullUrl);
      
      // Deduz a extensão correta baseada no content-type ou na URL original
      let ext = fullUrl.split('/').pop()?.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
      const knownExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'webm', 'css', 'js', 'woff2', 'woff', 'ttf', 'otf', 'ico'];
      if (!knownExtensions.includes(ext)) {
        const mimeToExt: Record<string, string> = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/gif': 'gif',
          'image/svg+xml': 'svg',
          'image/webp': 'webp'
        };
        const mimeClean = contentType.split(';')[0].toLowerCase().trim();
        ext = mimeToExt[mimeClean] || 'png';
      }

      const rawFileName = fullUrl.split('/').pop()?.split('?')[0]?.replace(/\.[a-zA-Z0-9]+$/, '') || 'bg';
      const fileName = `bg_${crypto.randomBytes(4).toString('hex')}_${rawFileName}.${ext}`;

      const uploadRes = await uploadAssetToStorage(buffer, fileName, contentType, projectId);
      
      // Registrar no banco de dados com segurança
      await registerDownloadedMedia(
        fileName,
        uploadRes.url,
        uploadRes.size,
        contentType,
        uploadRes.isMinio,
        userId,
        projectId
      );

      assetCache.set(fullUrl, uploadRes.url);
      rewrittenHtml = rewrittenHtml.split(originalUrl).join(uploadRes.url);
    } catch (err) {
      console.warn(`[Remaster] Erro ao processar bg-image ${originalUrl}:`, (err as Error).message);
    }
  }
  return rewrittenHtml;
}

/**
 * Resolve URLs relativas dentro de um código CSS contra uma URL de origem
 */
function resolveCssUrls(cssText: string, cssBaseUrl: string): string {
  if (!cssText || !cssBaseUrl) return cssText || '';
  return cssText.replace(/url\(['"]?([^)'"]+)['"]?\)/gi, (match, urlVal) => {
    if (!urlVal || urlVal.startsWith('data:') || urlVal.startsWith('http://') || urlVal.startsWith('https://') || urlVal.startsWith('//')) {
      return match;
    }
    try {
      const resolved = new URL(urlVal, cssBaseUrl).href;
      return `url("${resolved}")`;
    } catch {
      return match;
    }
  });
}

/**
 * Separa e organiza HTML, CSS e JS de um conteúdo HTML bruto
 * Resolvendo URLs relativas de CSS, JS e mídias contra a URL base da página original do cliente
 */
export function extractCodeComponents(html: string, baseUrl?: string): { html: string; css: string; js: string } {
  let processedHtml = html || '';
  let css = '';
  let js = '';

  // 1. Resolver URLs relativas de mídias/links no HTML se houver baseUrl
  if (baseUrl) {
    try {
      processedHtml = processedHtml.replace(
        /(src|poster|data-src|data-bg|background)=["']([^"']+)["']/gi,
        (match, attr, val) => {
          if (!val || val.startsWith('data:') || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('//') || val.startsWith('javascript:') || val.startsWith('#')) {
            return match;
          }
          try {
            return `${attr}="${new URL(val, baseUrl).href}"`;
          } catch {
            return match;
          }
        }
      );

      processedHtml = resolveCssUrls(processedHtml, baseUrl);
    } catch (e) {
      console.warn('[extractCodeComponents] Erro ao resolver URLs:', e);
    }
  }

  // 2. Extrair e processar <style>
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const styleMatches = [...processedHtml.matchAll(styleRegex)];
  processedHtml = processedHtml.replace(styleRegex, '');

  styleMatches.forEach((m, idx) => {
    const content = m[1];
    if (content && content.trim()) {
      let cssContent = content.trim();
      if (baseUrl) {
        cssContent = resolveCssUrls(cssContent, baseUrl);
      }
      const fileName = styleMatches.length === 1 ? 'main.css' : `style-${idx + 1}.css`;
      css += `/* === FILE: ${fileName} === */\n` + cssContent + '\n\n';
    }
  });

  // 3. Extrair e processar <link rel="stylesheet">
  const linkCssRegex = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  processedHtml = processedHtml.replace(linkCssRegex, (match, href) => {
    if (href) {
      let resolvedHref = href;
      if (baseUrl && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('//')) {
        try {
          resolvedHref = new URL(href, baseUrl).href;
        } catch {}
      }
      if (!resolvedHref.includes('fonts.googleapis.com')) {
        const urlFileName = resolvedHref.split('/').pop()?.split('?')[0] || 'external.css';
        css = `/* === FILE: ${urlFileName} === */\n@import url("${resolvedHref}");\n\n` + css;
      }
    }
    return '';
  });

  // 4. Extrair e tratar <script>
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const scriptMatches = [...processedHtml.matchAll(scriptRegex)];
  let scriptInlineIndex = 1;

  processedHtml = processedHtml.replace(scriptRegex, (match, attrs, content) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      let scriptSrc = srcMatch[1];
      if (baseUrl && !scriptSrc.startsWith('http://') && !scriptSrc.startsWith('https://') && !scriptSrc.startsWith('//')) {
        try {
          scriptSrc = new URL(scriptSrc, baseUrl).href;
        } catch {}
      }
      return `<script src="${scriptSrc}"></script>`;
    } else if (content && content.trim()) {
      const fileName = scriptMatches.length === 1 ? 'main.js' : `script-${scriptInlineIndex++}.js`;
      js += `/* === FILE: ${fileName} === */\n` + content.trim() + '\n\n';
      return '';
    }
    return '';
  });

  // 5. Extrair o corpo do documento <body> se existir para manter a estrutura HTML limpa no editor
  let finalHtml = processedHtml;
  const bodyMatch = processedHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    finalHtml = bodyMatch[1];
  } else {
    finalHtml = finalHtml
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<html\b[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<body\b[^>]*>/gi, '')
      .replace(/<\/body>/gi, '');
  }

  return { html: finalHtml.trim(), css: css.trim(), js: js.trim() };
}

/**
 * Função assíncrona que extrai e baixa stylesheets externos para embutir o CSS completo da página original
 */
export async function extractAndBundlePageComponents(
  rawHtml: string, 
  pageUrl?: string, 
  proxyUrl?: string
): Promise<{ html: string; css: string; js: string }> {
  const baseExtracted = extractCodeComponents(rawHtml, pageUrl);
  let accumulatedCss = baseExtracted.css;

  if (pageUrl) {
    try {
      const linkCssRegex = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
      const linkMatches = [...rawHtml.matchAll(linkCssRegex)];

      for (let i = 0; i < linkMatches.length; i++) {
        const rawHref = linkMatches[i][1];
        if (!rawHref || rawHref.includes('fonts.googleapis.com')) continue;

        try {
          const absoluteCssUrl = new URL(rawHref, pageUrl).href;
          const cssContent = await resilientFetchPage(absoluteCssUrl, proxyUrl);

          if (cssContent && cssContent.length > 20 && !cssContent.trim().startsWith('<')) {
            const resolvedCss = resolveCssUrls(cssContent, absoluteCssUrl);
            const fileName = absoluteCssUrl.split('/').pop()?.split('?')[0] || `stylesheet-${i + 1}.css`;
            accumulatedCss += `\n/* === FILE: ${fileName} === */\n` + resolvedCss + '\n\n';
          }
        } catch (cssErr) {
          console.warn(`[Site Remaster] Não foi possível baixar CSS externo de ${rawHref}:`, (cssErr as Error).message);
        }
      }
    } catch (e) {
      console.warn('[Site Remaster] Erro ao agrupar CSSs externos:', e);
    }
  }

  return {
    html: baseExtracted.html,
    css: accumulatedCss.trim(),
    js: baseExtracted.js
  };
}
function resolveInternalUrl(base: string, relative: string): string | null {
  try {
    const baseUrlObj = new URL(base);
    const resolved = new URL(relative, base);

    const baseHostClean = baseUrlObj.hostname.replace(/^www\./, '');
    const resolvedHostClean = resolved.hostname.replace(/^www\./, '');
    if (baseHostClean !== resolvedHostClean) return null;

    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|css|js|woff2?)$/i.test(resolved.pathname)) {
      return null;
    }

    resolved.hash = '';
    return resolved.href;
  } catch {
    return null;
  }
}

function cleanHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

/**
 * Fetch resiliente com fallback SSL e suporte a HTTP/HTTPS nativo
 */
async function resilientFetchPage(url: string, proxyUrl?: string): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
  };

  if (proxyUrl && proxyUrl.startsWith('http')) {
    try {
      const { ProxyAgent, fetch: uFetch } = await import('undici');
      const res = await uFetch(url, {
        headers,
        dispatcher: new ProxyAgent(proxyUrl)
      });
      if (res.ok) return await res.text();
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return await res.text();
  } catch {}

  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.get(url, {
      headers,
      rejectUnauthorized: false,
      timeout: 7000
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const u = new URL(url);
          redirectUrl = `${u.origin}${redirectUrl}`;
        }
        return resilientFetchPage(redirectUrl, proxyUrl).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

/**
 * Raspa todas as páginas e subpáginas de um site cliente
 */
export async function crawlEntireClientWebsite(
  startUrl: string, 
  maxPages: number = 6,
  proxyUrl?: string
): Promise<ScrapedPage[]> {
  let normalizedStart = startUrl.trim();
  if (!normalizedStart.startsWith('http')) {
    normalizedStart = `https://${normalizedStart}`;
  }

  const visited = new Set<string>();
  const queue: string[] = [normalizedStart];
  const pages: ScrapedPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      let html = '';
      try {
        html = await resilientFetchPage(currentUrl, proxyUrl);
      } catch {
        if (currentUrl.startsWith('https://')) {
          const fallbackHttp = currentUrl.replace('https://', 'http://');
          html = await resilientFetchPage(fallbackHttp, proxyUrl);
        }
      }

      if (!html || html.length < 50) continue;

      const cleanText = cleanHtmlToText(html);
      const urlObj = new URL(currentUrl);
      let pathname = urlObj.pathname.replace(/\/$/, '');
      let slug = pathname.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'index';
      
      let name = slug === 'index' ? 'Home' : slug.charAt(0).toUpperCase() + slug.slice(1);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const cleanTitle = titleMatch[1].split(/[-|]/)[0].trim();
        if (cleanTitle.length > 1 && cleanTitle.length < 35) {
          name = cleanTitle;
        }
      }

      pages.push({
        url: currentUrl,
        slug,
        name,
        html,
        cleanText
      });

      const linkMatches = [...html.matchAll(/href=["']([^"'#?]+)["']/gi)];
      for (const m of linkMatches) {
        const resolved = resolveInternalUrl(currentUrl, m[1]);
        if (resolved && !visited.has(resolved) && !queue.includes(resolved)) {
          queue.push(resolved);
        }
      }
    } catch (err: any) {
      console.warn(`[Site Recreator Crawler] Erro ao raspar ${currentUrl}:`, err.message);
    }
  }

  return pages;
}

export function parseThemeColors(themeOrPalette?: any) {
  let primary = '#a855f7';
  let secondary = '#ec4899';
  let accent = '#3b82f6';
  let bg = '#090d16';
  let cardBg = '#111827';
  let textColor = '#f8fafc';
  let textMuted = '#94a3b8';

  if (!themeOrPalette) return { primary, secondary, accent, bg, cardBg, textColor, textMuted };

  if (typeof themeOrPalette === 'object') {
    if (themeOrPalette.colorPalette) {
      if (typeof themeOrPalette.colorPalette === 'object') {
        const p = themeOrPalette.colorPalette;
        return {
          primary: p.primary || primary,
          secondary: p.secondary || secondary,
          accent: p.accent || accent,
          bg: p.bg || p.background || bg,
          cardBg: p.cardBg || p.surface || cardBg,
          textColor: p.textColor || p.text || textColor,
          textMuted: p.textMuted || textMuted
        };
      } else if (typeof themeOrPalette.colorPalette === 'string') {
        themeOrPalette = themeOrPalette.colorPalette;
      }
    } else {
      return {
        primary: themeOrPalette.primary || primary,
        secondary: themeOrPalette.secondary || secondary,
        accent: themeOrPalette.accent || accent,
        bg: themeOrPalette.bg || themeOrPalette.background || bg,
        cardBg: themeOrPalette.cardBg || themeOrPalette.surface || cardBg,
        textColor: themeOrPalette.textColor || themeOrPalette.text || textColor,
        textMuted: themeOrPalette.textMuted || textMuted
      };
    }
  }

  if (typeof themeOrPalette === 'string') {
    try {
      const parsed = JSON.parse(themeOrPalette);
      if (parsed && typeof parsed === 'object') {
        return parseThemeColors(parsed);
      }
    } catch {}

    const str = themeOrPalette.toLowerCase();
    const hexes = themeOrPalette.match(/#[0-9a-fA-F]{3,8}/g);
    if (hexes && hexes.length > 0) {
      bg = hexes[0];
      if (hexes.length > 1) primary = hexes[1];
      if (hexes.length > 2) secondary = hexes[2];
      if (hexes.length > 3) cardBg = hexes[3];
    } else if (str.includes('gold') || str.includes('dourad') || str.includes('adv') || str.includes('jur')) {
      primary = '#d97706';
      secondary = '#3b82f6';
      bg = '#090d16';
      cardBg = '#111827';
    } else if (str.includes('teal') || str.includes('esmerald') || str.includes('saú') || str.includes('méd')) {
      primary = '#0d9488';
      secondary = '#0284c7';
      bg = '#041212';
      cardBg = '#0a2121';
    } else if (str.includes('orange') || str.includes('terracota') || str.includes('restaurante')) {
      primary = '#ea580c';
      secondary = '#dc2626';
      bg = '#0f0d0e';
      cardBg = '#1c1719';
    }
  }

  return { primary, secondary, accent, bg, cardBg, textColor, textMuted };
}

/**
 * Sanitiza links de navegação em HTML para garantir que nenhum link leve a arquivos .html que não existem no projeto.
 * Se um link apontar para `pagina.html` e `pagina.html` não constar nas rotas reais do projeto:
 * - Se for `sobre.html`, converte para `#sobre` ou `index.html#sobre`
 * - Se for `servicos.html`, converte para `#servicos` ou `index.html#servicos`
 * - Se for `contato.html`, converte para `#contato` ou `index.html#contato`
 * - Caso contrário, converte `href="outro.html"` para `href="#outro"` ou `href="index.html#outro"`
 */
export function sanitizeNavLinks(
  html: string,
  navigationRoutes: Array<{ name: string; href: string }> = [],
  activePageSlug: string = 'index'
): string {
  if (!html || typeof html !== 'string') return html || '';

  // Lista de arquivos .html válidos e existentes no projeto
  const validHrefs = new Set<string>();
  validHrefs.add('index.html');

  if (Array.isArray(navigationRoutes)) {
    navigationRoutes.forEach(r => {
      if (r && r.href) {
        validHrefs.add(r.href.toLowerCase().trim());
      }
    });
  }

  const isHome = activePageSlug === 'index' || activePageSlug === 'homepage' || activePageSlug === '';

  // Substituir href="nome.html" por âncoras #nome ou index.html#nome caso nome.html não exista no projeto
  return html.replace(/href=["']([^"']+\.html)["']/gi, (match, hrefValue) => {
    const cleanHref = hrefValue.toLowerCase().trim();

    // Se a página .html existe nas rotas reais do projeto, mantém o link!
    if (validHrefs.has(cleanHref)) {
      return match;
    }

    // Se a página .html NÃO existe no projeto, converte para âncora de seção
    const pageNameMatch = cleanHref.match(/^([^/]+)\.html$/);
    if (pageNameMatch) {
      const pageKey = pageNameMatch[1];
      const anchor = `#${pageKey}`;
      const targetHref = isHome ? anchor : `index.html${anchor}`;
      return `href="${targetHref}"`;
    }

    return match;
  });
}

/**
 * Gera uma Navbar fallback elegante e responsiva harmonizada com o Tema do Projeto
 */
export function buildFallbackNavbar(
  businessName?: string,
  navigationRoutes?: Array<{ name: string; href: string }>,
  themeOrPalette?: any
): string {
  const name = businessName || 'Sua Empresa';
  const colors = parseThemeColors(themeOrPalette);

  let routes: Array<{ name: string; href: string }> = [];

  if (navigationRoutes && navigationRoutes.length > 1) {
    routes = navigationRoutes;
  } else if (navigationRoutes && navigationRoutes.length === 1) {
    routes = [
      { name: navigationRoutes[0].name || 'Início', href: 'index.html' },
      { name: 'Sobre Nós', href: '#sobre' },
      { name: 'Serviços', href: '#servicos' },
      { name: 'Contato', href: '#contato' }
    ];
  } else {
    routes = [
      { name: 'Início', href: 'index.html' },
      { name: 'Sobre Nós', href: '#sobre' },
      { name: 'Serviços', href: '#servicos' },
      { name: 'Contato', href: '#contato' }
    ];
  }

  const navLinksHtml = routes.map(r => 
    `<a href="${r.href}" style="color: ${colors.textColor}" class="opacity-80 hover:opacity-100 transition-opacity text-sm font-semibold hover:underline">${r.name}</a>`
  ).join('\n      ');

  const ctaHref = routes.find(r => r.href.includes('contat') || r.name.toLowerCase().includes('contat'))?.href || '#contato';

  return `<header style="background-color: ${colors.bg}; color: ${colors.textColor}; border-color: ${colors.cardBg}" class="sticky top-0 z-50 backdrop-blur-md border-b px-4 sm:px-6 lg:px-8 py-3.5">
  <div class="max-w-7xl mx-auto flex items-center justify-between">
    <a href="index.html" class="flex items-center gap-2.5 group">
      <div style="background-color: ${colors.primary}; color: #ffffff" class="w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-md">
        ${name.charAt(0).toUpperCase()}
      </div>
      <span style="color: ${colors.textColor}" class="text-lg font-extrabold tracking-tight">${name}</span>
    </a>
    <nav class="hidden md:flex items-center gap-6">
      ${navLinksHtml}
    </nav>
    <div class="flex items-center gap-3">
      <a href="${ctaHref}" style="background-color: ${colors.primary}; color: #ffffff" class="px-4 py-2 text-xs font-bold rounded-xl transition-transform hover:scale-105 shadow-md">
        Falar Conosco
      </a>
    </div>
  </div>
</header>`;
}

/**
 * Gera um Footer fallback rico, 100% full-width, responsivo e adaptado ao tema do projeto
 */
export function buildFallbackFooter(
  businessName: string,
  navigationRoutes?: Array<{ name: string; href: string }>,
  contactInfo?: { phone?: string; address?: string; email?: string },
  themeOrPalette?: any
): string {
  const currentYear = new Date().getFullYear();
  const phoneStr = contactInfo?.phone || '(11) 99999-9999';
  const addressStr = contactInfo?.address || 'Atendimento em todo o Brasil';
  const emailStr = contactInfo?.email || ('contato@' + (businessName ? businessName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'empresa') + '.com');
  const name = businessName || 'Sua Empresa';
  const colors = parseThemeColors(themeOrPalette);

  let routes: Array<{ name: string; href: string }> = [];

  if (navigationRoutes && navigationRoutes.length > 1) {
    routes = navigationRoutes;
  } else if (navigationRoutes && navigationRoutes.length === 1) {
    routes = [
      { name: navigationRoutes[0].name || 'Início', href: 'index.html' },
      { name: 'Sobre Nós', href: '#sobre' },
      { name: 'Serviços', href: '#servicos' },
      { name: 'Contato', href: '#contato' }
    ];
  } else {
    routes = [
      { name: 'Início', href: 'index.html' },
      { name: 'Sobre Nós', href: '#sobre' },
      { name: 'Serviços', href: '#servicos' },
      { name: 'Contato', href: '#contato' }
    ];
  }

  const navLinksHtml = routes.map(r => 
    `<li><a href="${r.href}" style="color: ${colors.textMuted}" class="hover:opacity-100 transition-colors text-sm font-medium hover:underline">${r.name}</a></li>`
  ).join('\n          ');

  return `<footer style="background-color: ${colors.bg}; color: ${colors.textColor}; border-color: ${colors.cardBg}" class="w-full border-t pt-16 pb-12 px-4 sm:px-6 lg:px-8 mt-auto relative z-10 select-none">
  <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
    <div class="space-y-4 md:col-span-1">
      <div class="flex items-center gap-2.5">
        <div style="background-color: ${colors.primary}; color: #ffffff" class="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-base shadow-lg">
          ${name.charAt(0).toUpperCase()}
        </div>
        <span style="color: ${colors.textColor}" class="text-xl font-extrabold tracking-tight">${name}</span>
      </div>
      <p style="color: ${colors.textMuted}" class="text-sm leading-relaxed">
        Soluções inovadoras e serviços de excelência para impulsionar seus resultados com máxima qualidade.
      </p>
    </div>

    <div>
      <h4 style="color: ${colors.textColor}" class="font-bold text-xs uppercase tracking-wider mb-4 opacity-90">Navegação Principal</h4>
      <ul class="space-y-2.5">
        ${navLinksHtml}
      </ul>
    </div>

    <div>
      <h4 style="color: ${colors.textColor}" class="font-bold text-xs uppercase tracking-wider mb-4 opacity-90">Atendimento & Contato</h4>
      <ul style="color: ${colors.textMuted}" class="space-y-3 text-sm">
        <li class="flex items-center gap-2">
          <span>📞</span> <span>${phoneStr}</span>
        </li>
        <li class="flex items-center gap-2">
          <span>✉️</span> <span>${emailStr}</span>
        </li>
        <li class="flex items-center gap-2">
          <span>📍</span> <span>${addressStr}</span>
        </li>
      </ul>
    </div>

    <div class="space-y-4">
      <h4 style="color: ${colors.textColor}" class="font-bold text-xs uppercase tracking-wider mb-4 opacity-90">Fale Conosco</h4>
      <p style="color: ${colors.textMuted}" class="text-sm leading-relaxed">Entre em contato para um orçamento rápido e personalizado.</p>
      <a href="https://wa.me/55${phoneStr.replace(/\D/g, '') || '11999999999'}" target="_blank" rel="noopener noreferrer" style="background-color: ${colors.primary}; color: #ffffff" class="inline-flex items-center justify-center px-4 py-3 text-sm font-bold rounded-xl transition-transform hover:scale-105 shadow-lg gap-2 w-full">
        <span>Falar no WhatsApp</span>
      </a>
    </div>
  </div>

  <div style="border-color: ${colors.cardBg}" class="max-w-7xl mx-auto border-t mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center text-xs gap-4">
    <p style="color: ${colors.textMuted}">© ${currentYear} ${name}. Todos os direitos reservados.</p>
    <div style="color: ${colors.textMuted}" class="flex gap-6">
      <a href="#" class="hover:underline transition-colors">Termos de Uso</a>
      <a href="#" class="hover:underline transition-colors">Política de Privacidade</a>
    </div>
  </div>
</footer>`;
}

/**
 * Cria uma requisição dedicada para geração autônoma de Header e Footer globais alinhados ao tema do projeto
 */
/**
 * Gera os componentes e widgets flutuantes globais harmonizados com o Tema do Projeto
 */
export function buildFallbackGlobalItems(
  businessName?: string,
  contacts?: string,
  themeOrPalette?: any
): string {
  const name = businessName || 'Sua Empresa';
  const colors = parseThemeColors(themeOrPalette);
  const cleanPhone = (contacts || '11999999999').replace(/\D/g, '') || '11999999999';

  return `<!-- Elementos Globais Flutuantes do Tema -->
<div id="global-floating-widgets">
  <!-- Badge de Status Comercial em Tempo Real -->
  <div class="fixed bottom-6 left-6 z-40 hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-full backdrop-blur-md border shadow-xl text-xs font-medium transition-all" style="background-color: ${colors.cardBg}ee; border-color: ${colors.cardBg}; color: ${colors.textColor}">
    <span class="relative flex h-2 w-2">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
    </span>
    <span>Atendimento Online | Plantão Ativo</span>
  </div>

  <!-- Botão Flutuante do WhatsApp Oficial -->
  <a href="https://wa.me/55${cleanPhone}?text=Ol%C3%A1,%20gostaria%20de%20um%20atendimento%20com%20${encodeURIComponent(name)}" target="_blank" rel="noopener noreferrer" class="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-white p-3.5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center gap-2 group cursor-pointer" title="Falar no WhatsApp" aria-label="Falar no WhatsApp">
    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.771.82 2.79.82h.001c3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.77-5.768zm3.364 8.163c-.144.405-.837.774-1.17.825-.312.048-.718.077-2.146-.514-1.22-.505-1.996-1.748-2.057-1.829-.06-.08-1.429-1.901-1.429-3.626 0-1.724.903-2.571 1.225-2.923.322-.352.704-.442.939-.442.235 0 .47 0 .677.011.22.01.512-.084.8.608.298.718 1.015 2.478 1.104 2.658.089.18.149.392.03.628-.119.236-.179.383-.353.587-.174.204-.367.456-.525.612-.175.174-.358.363-.153.714.205.352.913 1.503 1.96 2.434 1.348 1.198 2.484 1.57 2.836 1.745.352.175.558.146.764-.09.206-.235.882-1.028 1.117-1.38.235-.353.47-.294.793-.176.323.118 2.057.971 2.41 1.147.353.176.587.264.675.411.088.147.088.852-.056 1.257z"></path></svg>
    <span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold pr-1">Fale Conosco</span>
  </a>
</div>`;
}

/**
 * Cria requisições dedicadas e separadas para geração autônoma de:
 * 1) Header/Navbar no tema proposto
 * 2) Footer no tema proposto
 * 3) Itens e Widgets Globais no tema proposto
 */
export async function generateGlobalThemeElements(params: {
  businessName: string;
  theme: any;
  logoUrl?: string;
  contacts?: string;
  email?: string;
  segment?: string;
  visualStyle?: string;
  navigationRoutes?: Array<{ name: string; href: string }>;
  aiProvider?: string;
  apiKey?: string;
  model?: string;
  registeredModels?: any;
  proxyUrl?: string;
  ollamaEndpoint?: string;
  lowSpecMode?: boolean;
}): Promise<{
  navbarHtml: string;
  footerHtml: string;
  globalItemsHtml: string;
  css?: string;
  js?: string;
}> {
  const {
    businessName,
    theme,
    logoUrl,
    contacts,
    email,
    segment,
    visualStyle,
    navigationRoutes,
    aiProvider,
    apiKey,
    model,
    registeredModels,
    proxyUrl,
    ollamaEndpoint,
    lowSpecMode
  } = params;

  const colors = parseThemeColors(theme);
  const currentYear = new Date().getFullYear();
  const routesStr = navigationRoutes && navigationRoutes.length > 0
    ? navigationRoutes.map(r => `"${r.name}" (href="${r.href}")`).join(', ')
    : '"Início" (href="index.html"), "Sobre Nós" (href="#sobre"), "Serviços" (href="#servicos"), "Contato" (href="#contato")';

  const ctaHref = navigationRoutes?.find(r => r.href.includes('contat') || r.name.toLowerCase().includes('contat'))?.href || '#contato';
  const cleanPhone = (contacts || '11999999999').replace(/\D/g, '') || '11999999999';
  const phoneFormatted = contacts || '(11) 99999-8888';
  const emailFormatted = email || `contato@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'empresa'}.com.br`;

  // Fallbacks instantâneos pré-computados com os mesmos tokens de design do tema
  const fallbackNav = sanitizeNavLinks(buildFallbackNavbar(businessName, navigationRoutes, colors), navigationRoutes || [], 'index');
  const fallbackFoot = sanitizeNavLinks(buildFallbackFooter(businessName, navigationRoutes, { phone: contacts, email }, colors), navigationRoutes || [], 'index');
  const fallbackItems = buildFallbackGlobalItems(businessName, contacts, colors);

  // Helper de extração tolerante a formatos de retorno JSON
  const extractCode = (res: any, fallbackStr: string): string => {
    if (!res) return fallbackStr;
    const candidates = [res.html, res.navbarHtml, res.footerHtml, res.globalItemsHtml, res.navbar, res.footer];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 25) {
        return c.trim();
      }
    }
    return fallbackStr;
  };

  const aiOptions = {
    provider: (aiProvider as any) || 'gemini',
    apiKey,
    model,
    registeredModels,
    proxyUrl,
    ollamaEndpoint,
    lowSpecMode
  };

  // --------------------------------------------------------------------------
  // REQUISIÇÃO 1: NAVBAR / CABEÇALHO DEDICADO NO TEMA PROPOSTO
  // --------------------------------------------------------------------------
  const promptNavbar = `
Você é o Engenheiro UI/UX e Especialista em Design Systems.
Sua missão é criar EXCLUSIVAMENTE a NAVBAR / CABEÇALHO GLOBAL (<header>) para o site da empresa "${businessName}".

[TEMA E CARACTERÍSTICAS OBRIGATÓRIAS DO PROJETO]:
- Estilo Visual: ${visualStyle || 'Moderno, Elegante e Responsivo'}
- Segmento: ${segment || 'Serviços Profissionais'}
- Cor de Fundo: ${colors.bg} (use efeito backdrop-blur-md com transparência elegante e glassmorphism)
- Borda Inferior: ${colors.cardBg}
- Cor Primária do CTA: ${colors.primary}
- Cor Secundária/Acento: ${colors.secondary}
- Cor dos Textos Principais: ${colors.textColor}
- Cor dos Links de Navegação: ${colors.textMuted}

[LOGOTIPO E IDENTIDADE]:
${logoUrl ? `- Logotipo Oficial: "${logoUrl}" (Use: <img src="${logoUrl}" referrerPolicy="no-referrer" alt="${businessName}" class="h-8 md:h-10 object-contain">)` : `- Logotipo Tipográfico: Use uma tipografia moderna destacando o nome "${businessName}" com um badge inicial na cor primária.`}

[ROTAS OFICIAIS DE NAVEGAÇÃO]:
- Links permitidos: ${routesStr}
- O botão CTA de conversão no desktop e mobile deve direcionar para "${ctaHref}".

[REGRAS ESTRUTURAIS RÍGIDAS]:
1. Tag raiz: <header class="sticky top-0 z-50 backdrop-blur-md border-b ...">
2. Navegação Desktop: Menu centralizado ou alinhado com links espaçados, hover transitions suaves nas cores do tema e botão CTA em destaque (${colors.primary}).
3. Menu Mobile: Botão hambúrguer acessível (<button aria-label="Abrir Menu" id="mobile-menu-btn" class="md:hidden ...">) e gaveta/dropdown (<div id="mobile-menu" class="hidden md:hidden ...">) contendo todos os links e o botão de ação.
4. Inclua micro-script inline funcional para alternar o menu mobile de forma segura.

Retorne EXCLUSIVAMENTE um objeto JSON no formato:
{
  "html": "<header ...>...</header>",
  "navbarHtml": "<header ...>...</header>",
  "css": "",
  "js": ""
}
`;

  // --------------------------------------------------------------------------
  // REQUISIÇÃO 2: FOOTER / RODAPÉ DEDICADO NO TEMA PROPOSTO
  // --------------------------------------------------------------------------
  const promptFooter = `
Você é o Engenheiro UI/UX e Especialista em Design Systems.
Sua missão é criar EXCLUSIVAMENTE o FOOTER / RODAPÉ GLOBAL (<footer>) para o site da empresa "${businessName}".

[TEMA E CARACTERÍSTICAS OBRIGATÓRIAS DO PROJETO]:
- Estilo Visual: ${visualStyle || 'Moderno, Elegante e Responsivo'}
- Segmento: ${segment || 'Serviços Profissionais'}
- Cor de Fundo: ${colors.bg}
- Borda Superior: ${colors.cardBg}
- Cor Primária: ${colors.primary}
- Cor Secundária/Acento: ${colors.secondary}
- Cor dos Textos: ${colors.textColor}
- Cor dos Links/Textos Secundários: ${colors.textMuted}

[REGRAS ESTRUTURAIS DO FOOTER (100% WIDE NO NÍVEL RAIZ)]:
1. Tag raiz: <footer class="w-full relative z-10 border-t pt-16 pb-12 px-4 sm:px-6 lg:px-8 ...">
2. Container interno: <div class="max-w-7xl mx-auto ...">
3. Grid responsivo (1 coluna mobile, 4 colunas desktop):
   - Coluna 1: Nome da empresa "${businessName}", resumo de autoridade e diferenciais da marca.
   - Coluna 2: Navegação rápida com links oficiais para todas as páginas (${routesStr}).
   - Coluna 3: Informações de Atendimento (WhatsApp / Telefone: "${phoneFormatted}", E-mail: "${emailFormatted}", Atendimento Nacional e Regional).
   - Coluna 4: Canal de Atendimento / Newsletter com campo de input estilizado no tema e botão de envio na cor primária (${colors.primary}).
4. Barra inferior de copyright: "© ${currentYear} ${businessName}. Todos os direitos reservados." + links para Termos de Uso e Política de Privacidade.

Retorne EXCLUSIVAMENTE um objeto JSON no formato:
{
  "html": "<footer class=\"w-full ...\">...</footer>",
  "footerHtml": "<footer class=\"w-full ...\">...</footer>",
  "css": "",
  "js": ""
}
`;

  // --------------------------------------------------------------------------
  // REQUISIÇÃO 3: ITENS E WIDGETS GLOBAIS FLUTUANTES NO TEMA PROPOSTO
  // --------------------------------------------------------------------------
  const promptGlobalItems = `
Você é o Engenheiro Frontend Especialista em Componentes e Micro-interações Globais.
Sua missão é criar EXCLUSIVAMENTE os ITENS GLOBAIS E WIDGETS FLUTUANTES transversais do site da empresa "${businessName}".

[TEMA DO PROJETO]:
- Cor Primária: ${colors.primary}
- Cor Secundária: ${colors.secondary}
- Cor de Superfície: ${colors.cardBg}
- Cor dos Textos: ${colors.textColor}

[COMPONENTES GLOBAIS OBRIGATÓRIOS]:
1. BOTÃO FLUTUANTE DO WHATSAPP:
   - Link: href="https://wa.me/55${cleanPhone}?text=Ol%C3%A1,%20gostaria%20de%20um%20atendimento%20com%20${encodeURIComponent(businessName)}" target="_blank" rel="noopener noreferrer"
   - Posicionamento: class="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-white p-3.5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center gap-2 group cursor-pointer"
   - Ícone SVG oficial do WhatsApp e texto retrátil ou tooltip com "Fale Conosco".
2. BADGE DE STATUS COMERCIAL EM TEMPO REAL:
   - Posicionamento: class="fixed bottom-6 left-6 z-40 hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-full backdrop-blur-md border shadow-xl text-xs font-medium transition-all"
   - Use as cores do tema: style="background-color: ${colors.cardBg}ee; border-color: ${colors.cardBg}; color: ${colors.textColor}"
   - Ponto pulsante animado (animate-ping) verde indicando: "Atendimento Online | Resposta Imediata".

Retorne EXCLUSIVAMENTE um objeto JSON no formato:
{
  "html": "<!-- Botão flutuante WhatsApp oficial e Badge de status comercial -->",
  "globalItemsHtml": "<!-- Botão flutuante WhatsApp oficial e Badge de status comercial -->",
  "css": "",
  "js": ""
}
`;

  // Disparo das 3 requisições separadas em paralelo com isolamento total de falhas
  let generatedNavbar = fallbackNav;
  let generatedFooter = fallbackFoot;
  let generatedItems = fallbackItems;
  let combinedCss = '';
  let combinedJs = '';

  try {
    const [navPromise, footerPromise, itemsPromise] = await Promise.allSettled([
      executeAIRequest(promptNavbar, { html: '', css: '', js: '' }, aiOptions),
      executeAIRequest(promptFooter, { html: '', css: '', js: '' }, aiOptions),
      executeAIRequest(promptGlobalItems, { html: '', css: '', js: '' }, aiOptions)
    ]);

    if (navPromise.status === 'fulfilled') {
      const code = extractCode(navPromise.value, fallbackNav);
      generatedNavbar = sanitizeNavLinks(code, navigationRoutes || [], 'index');
      if (navPromise.value.css) combinedCss += `\n${navPromise.value.css}`;
      if (navPromise.value.js) combinedJs += `\n${navPromise.value.js}`;
    } else {
      console.warn('[GlobalThemeElements] Requisição da Navbar falhou, aplicando fallback do tema:', navPromise.reason?.message);
    }

    if (footerPromise.status === 'fulfilled') {
      const code = extractCode(footerPromise.value, fallbackFoot);
      generatedFooter = sanitizeNavLinks(fixFooterClasses(code), navigationRoutes || [], 'index');
      if (footerPromise.value.css) combinedCss += `\n${footerPromise.value.css}`;
      if (footerPromise.value.js) combinedJs += `\n${footerPromise.value.js}`;
    } else {
      console.warn('[GlobalThemeElements] Requisição do Footer falhou, aplicando fallback do tema:', footerPromise.reason?.message);
    }

    if (itemsPromise.status === 'fulfilled') {
      const code = extractCode(itemsPromise.value, fallbackItems);
      generatedItems = code;
      if (itemsPromise.value.css) combinedCss += `\n${itemsPromise.value.css}`;
      if (itemsPromise.value.js) combinedJs += `\n${itemsPromise.value.js}`;
    } else {
      console.warn('[GlobalThemeElements] Requisição dos Itens Globais falhou, aplicando fallback do tema:', itemsPromise.reason?.message);
    }
  } catch (allErr: any) {
    console.warn('[GlobalThemeElements] Erro geral ao orquestrar requisições separadas:', allErr?.message);
  }

  return {
    navbarHtml: generatedNavbar,
    footerHtml: fixFooterClasses(generatedFooter),
    globalItemsHtml: generatedItems,
    css: combinedCss.trim(),
    js: combinedJs.trim()
  };
}

/**
 * Extrai o bloco exato de Header/Navbar e Footer gerado na Home para reutilização idêntica em todas as subpáginas
 */
export function buildFallbackSubpageHtml(
  subName: string,
  businessName: string,
  navbarHtml: string,
  footerHtml: string,
  globalItemsHtml?: string
): string {
  const cleanNav = navbarHtml && navbarHtml.trim().length > 20 ? navbarHtml : buildFallbackNavbar(businessName);
  const cleanFoot = footerHtml && footerHtml.trim().length > 20 ? footerHtml : buildFallbackFooter(businessName);
  const cleanItems = globalItemsHtml && globalItemsHtml.trim().length > 20 ? `\n\n${globalItemsHtml.trim()}` : '';

  return `${cleanNav}
<main class="min-h-[70vh] bg-slate-950 text-white py-20 px-4 sm:px-6 lg:px-8">
  <div class="max-w-5xl mx-auto text-center space-y-8">
    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold">
      <span>${businessName || 'Sua Empresa'}</span>
    </div>
    <h1 class="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">${subName}</h1>
    <p class="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
      Bem-vindo à página de ${subName} da ${businessName || 'nossa empresa'}. Conheça nossas soluções com máxima qualidade e atendimento exclusivo.
    </p>
    <div class="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
      <div class="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 class="text-white font-bold text-lg mb-2">Atendimento Prioritário</h3>
        <p class="text-slate-400 text-sm mb-4">Entre em contato direto com nossos consultores para tirar dúvidas.</p>
        <a href="contato.html" class="text-purple-400 hover:text-purple-300 text-sm font-semibold inline-flex items-center gap-1">Saiba mais →</a>
      </div>
      <div class="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 class="text-white font-bold text-lg mb-2">Soluções Completas</h3>
        <p class="text-slate-400 text-sm mb-4">Catálogo de serviços e produtos desenvolvidos sob medida.</p>
        <a href="servicos.html" class="text-purple-400 hover:text-purple-300 text-sm font-semibold inline-flex items-center gap-1">Ver serviços →</a>
      </div>
      <div class="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 class="text-white font-bold text-lg mb-2">Falar com Especialista</h3>
        <p class="text-slate-400 text-sm mb-4">Canal direto de WhatsApp com resposta rápida em horário comercial.</p>
        <a href="https://wa.me/5511999999999" target="_blank" class="text-emerald-400 hover:text-emerald-300 text-sm font-semibold inline-flex items-center gap-1">WhatsApp →</a>
      </div>
    </div>
  </div>
</main>
${cleanFoot}${cleanItems}`;
}

/**
 * Extrai o bloco exato de Header/Navbar e Footer gerado na Home para reutilização idêntica em todas as subpáginas
 */
export function extractNavbarAndFooter(
  homeHtml: string,
  businessName?: string,
  navigationRoutes?: Array<{ name: string; href: string }>,
  contactInfo?: any,
  themeOrPalette?: any
): { navbarHtml: string; footerHtml: string } {
  let navbarHtml = '';
  let footerHtml = '';

  if (homeHtml && typeof homeHtml === 'string') {
    const navMatch = homeHtml.match(/<header\b[^>]*>[\s\S]*?<\/header>|<nav\b[^>]*>[\s\S]*?<\/nav>/i);
    if (navMatch && navMatch[0].length > 40) {
      navbarHtml = navMatch[0];
    }

    const footMatch = homeHtml.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i);
    if (footMatch && footMatch[0].length > 40) {
      footerHtml = footMatch[0];
    }
  }

  // Se a IA não gerou Navbar no HTML (ou veio vazio), gera o fallback oficial alinhado ao tema do projeto
  if (!navbarHtml || navbarHtml.trim().length === 0) {
    navbarHtml = buildFallbackNavbar(businessName || 'Empresa', navigationRoutes, themeOrPalette);
  }

  // Se a IA não gerou Footer no HTML (ou veio cortado/incompleto), gera o fallback oficial alinhado ao tema do projeto
  if (!footerHtml || footerHtml.trim().length === 0) {
    footerHtml = buildFallbackFooter(businessName || 'Empresa', navigationRoutes, contactInfo, themeOrPalette);
  }

  return { navbarHtml, footerHtml };
}

export interface AutomaticTheme {
  name: string;
  visualStyle: string;
  colorPalette: string;
  typography: string;
  badgeStyle: string;
  bgGradient: string;
  accentGlow: string;
}

/**
 * Motor de Derivação Automática de Tema Inteligente baseado nas informações do cliente e segmento.
 */
export function generateAutomaticClientTheme(
  businessName: string,
  segment: string = '',
  description: string = ''
): AutomaticTheme {
  const context = (businessName + ' ' + segment + ' ' + description).toLowerCase();

  // 1. TECH / SOFTWARE / AI / SAAS / DIGITAL
  if (
    context.includes('tech') ||
    context.includes('soft') ||
    context.includes('ai') ||
    context.includes('ia') ||
    context.includes('app') ||
    context.includes('saas') ||
    context.includes('digital') ||
    context.includes('sistem') ||
    context.includes('inov') ||
    context.includes('start')
  ) {
    return {
      name: 'Clean Tech Cyberpunk Glass',
      visualStyle: 'Futurista, Dark Tech High-Contrast com componentes Glassmorphism e linhas neon luminosas.',
      colorPalette: 'Base Obsidian (#030712), Acentos Neon Cyan (#06b6d4), Electric Indigo (#6366f1) e Emerald Glow (#10b981) para CTAs.',
      typography: 'Títulos em Plus Jakarta Sans / Space Grotesk e corpo em Inter.',
      badgeStyle: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
      bgGradient: 'from-cyan-950/40 via-slate-950 to-indigo-950/30',
      accentGlow: 'shadow-cyan-500/30'
    };
  }

  // 2. ADVOCACIA / JURÍDICO / FINANCEIRO / CONTABILIDADE
  if (
    context.includes('adv') ||
    context.includes('jur') ||
    context.includes('direit') ||
    context.includes('finan') ||
    context.includes('contab') ||
    context.includes('invest') ||
    context.includes('banc') ||
    context.includes('fisc') ||
    context.includes('consult')
  ) {
    return {
      name: 'Midnight Gold Executive Prestige',
      visualStyle: 'Sóbrio, Imponente e Executivo de Alto Luxo com cartões escuros em bordas douradas e tipografia editorial.',
      colorPalette: 'Base Deep Royal Navy (#090d16), Acentos Gold Champagne (#d97706 / #f59e0b) e Slate Blue (#3b82f6) para autoridade.',
      typography: 'Títulos imponentes em Playfair Display / Cormorant Garamond e corpo ultra-legível em Inter.',
      badgeStyle: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      bgGradient: 'from-amber-950/20 via-slate-950 to-blue-950/20',
      accentGlow: 'shadow-amber-500/30'
    };
  }

  // 3. SAÚDE / MÉDICO / ODONTO / CLINICA / BEM-ESTAR
  if (
    context.includes('saud') ||
    context.includes('medic') ||
    context.includes('dent') ||
    context.includes('odonto') ||
    context.includes('clinic') ||
    context.includes('psic') ||
    context.includes('terap') ||
    context.includes('estet') ||
    context.includes('hosp') ||
    context.includes('farm')
  ) {
    return {
      name: 'Bio Vitality Clinical Clean',
      visualStyle: 'Clean, Acolhedor e Tecnológico de Saúde com superfícies cristalinas, tom pastel profundo e iluminação suave.',
      colorPalette: 'Base Midnight Teal (#04151f), Acentos Vital Teal (#0d9488), Medical Emerald (#10b981) e Cyan Soft (#22d3ee).',
      typography: 'Títulos e corpo em Outfit / Montserrat (suave, moderno e acessível WCAG AA).',
      badgeStyle: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
      bgGradient: 'from-teal-950/30 via-slate-950 to-emerald-950/20',
      accentGlow: 'shadow-teal-500/30'
    };
  }

  // 4. IMOBILIÁRIA / ARQUITETURA / ENGENHARIA / CONSTRUÇÃO
  if (
    context.includes('imob') ||
    context.includes('arquit') ||
    context.includes('engenh') ||
    context.includes('constr') ||
    context.includes('interi') ||
    context.includes('decor') ||
    context.includes('casa') ||
    context.includes('lote')
  ) {
    return {
      name: 'Architectural Bronze & Slate',
      visualStyle: 'Arquitetônico, Estruturado e Minimalista Premium com proporções geométricas marcantes e texturas nobres.',
      colorPalette: 'Base Charcoal Black (#0f141c), Acentos Metallic Bronze (#b45309), Warm Amber (#f59e0b) e Cool Stone (#64748b).',
      typography: 'Títulos em Syne / Space Grotesk e corpo em Plus Jakarta Sans.',
      badgeStyle: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
      bgGradient: 'from-orange-950/20 via-slate-950 to-stone-900/40',
      accentGlow: 'shadow-orange-500/30'
    };
  }

  // 5. BELEZA / SALÃO / ESTÉTICA / MODA / LUXO
  if (
    context.includes('belez') ||
    context.includes('sal') ||
    context.includes('cabel') ||
    context.includes('barb') ||
    context.includes('moda') ||
    context.includes('fash') ||
    context.includes('joia') ||
    context.includes('lux')
  ) {
    return {
      name: 'Rose Velvet & Gold Elegance',
      visualStyle: 'Elegante, Sofisticado e Sedutor de Luxo com iluminação rosa champanhe e acabamentos em vidro espelhado.',
      colorPalette: 'Base Deep Plum (#0f051d), Acentos Rose Gold (#f43f5e / #fb7185), Velvet Violet (#8b5cf6) e Cream Warm (#fef2f2).',
      typography: 'Títulos sofisticados em Cinzel / Playfair Display e corpo suave em Plus Jakarta Sans.',
      badgeStyle: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      bgGradient: 'from-rose-950/30 via-slate-950 to-purple-950/30',
      accentGlow: 'shadow-rose-500/30'
    };
  }

  // 6. GASTRONOMIA / RESTAURANTE / PADARIA / BAR
  if (
    context.includes('gastr') ||
    context.includes('resta') ||
    context.includes('pizz') ||
    context.includes('burg') ||
    context.includes('bar') ||
    context.includes('caf') ||
    context.includes('padar') ||
    context.includes('alimen') ||
    context.includes('comid')
  ) {
    return {
      name: 'Gourmet Amber & Crimson',
      visualStyle: 'Apetite Visual, Quente e Vibrante com contraste em fundo escuro de alta gastronomia e fotos apetitosas.',
      colorPalette: 'Base Obsidian Food (#0f0d0e), Acentos Crimson Red (#dc2626), Warm Terracotta Amber (#ea580c / #f59e0b).',
      typography: 'Títulos em Cabinet Grotesk / Outfit e corpo em Inter.',
      badgeStyle: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      bgGradient: 'from-red-950/20 via-slate-950 to-amber-950/30',
      accentGlow: 'shadow-red-500/30'
    };
  }

  // 7. ACADEMIA / FITNESS / ESPORTES
  if (
    context.includes('fit') ||
    context.includes('acad') ||
    context.includes('cross') ||
    context.includes('trein') ||
    context.includes('espor') ||
    context.includes('nutr')
  ) {
    return {
      name: 'High Energy Volt & Nitro Carbon',
      visualStyle: 'De Alta Energia, Dinâmico e Impactante com linhas diagonais, tipografia de grande porte e contraste elétrico.',
      colorPalette: 'Base Nitro Carbon (#090a0f), Acentos Electric Lime Volt (#84cc16), Vibrant Orange (#f97316) e Pure White.',
      typography: 'Títulos imponentes em Red Hat Display / Archivo e corpo em Inter.',
      badgeStyle: 'bg-lime-500/10 border-lime-500/30 text-lime-400',
      bgGradient: 'from-lime-950/20 via-slate-950 to-orange-950/20',
      accentGlow: 'shadow-lime-500/30'
    };
  }

  // 8. TEMA PADRÃO UNIVERSAL
  return {
    name: 'Universal Quantum Glassmorphism',
    visualStyle: 'Ultra Moderno, Fluido, de Alta Conversão com Glassmorphism em multicamadas, bordas glowing e acabamento internacional.',
    colorPalette: 'Base Space Dark (#030712 / #0b0f19), Acentos Vibrant Purple (#a855f7), Electric Indigo (#6366f1) e Emerald Glow (#10b981) para CTAs.',
    typography: 'Títulos em Plus Jakarta Sans (bold) e corpo em Inter com espaçamento confortável.',
    badgeStyle: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    bgGradient: 'from-purple-950/30 via-slate-950 to-indigo-950/30',
    accentGlow: 'shadow-purple-500/30'
  };
}

/**
 * Sanitiza e formata o bloco <footer> para garantir que o elemento <footer ...>
 * expanda por 100% da largura da tela (w-full) sem estar limitado por max-width
 * ou containers restritivos da página.
 */
export function fixFooterClasses(footerHtml: string): string {
  if (!footerHtml || typeof footerHtml !== 'string') return footerHtml || '';

  let sanitized = footerHtml.trim();

  // 1. Sanitizar as classes diretamente da tag <footer ...> inicial
  sanitized = sanitized.replace(/<footer\b([^>]*)>/i, (fullMatch, attrString) => {
    let classMatch = attrString.match(/class=["']([^"']*)["']/i);
    let classes = classMatch ? classMatch[1] : '';

    // Remover classes de limitação de largura e alinhamento do elemento <footer ...> raiz
    classes = classes
      .replace(/\bmax-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|full|prose|screen-\w+)\b/g, '')
      .replace(/\bcontainer\b/g, '')
      .replace(/\bmx-auto\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!classes.includes('w-full')) classes += ' w-full';
    if (!classes.includes('relative')) classes += ' relative';
    if (!classes.includes('z-10')) classes += ' z-10';

    if (classMatch) {
      attrString = attrString.replace(/class=["'][^"']*["']/i, `class="${classes.trim()}"`);
    } else {
      attrString += ` class="${classes.trim()}"`;
    }

    return `<footer ${attrString.trim()}>`;
  });

  // 2. Garantir que o conteúdo interno possua um container de alinhamento max-w-7xl mx-auto
  const footerContentMatch = sanitized.match(/^<footer\b[^>]*>([\s\S]*)<\/footer>$/i);
  if (footerContentMatch) {
    const innerContent = footerContentMatch[1].trim();
    // Se o conteúdo interno direto não possui container max-w- nem container, envelopa
    if (!innerContent.includes('max-w-') && !innerContent.includes('container')) {
      const openTagMatch = sanitized.match(/^<footer\b[^>]*>/i);
      const openTag = openTagMatch ? openTagMatch[0] : '<footer class="w-full relative z-10">';
      sanitized = `${openTag}\n  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">\n    ${innerContent}\n  </div>\n</footer>`;
    }
  }

  return sanitized;
}

/**
 * Garante que a página possua exatamente 1 Navbar/Header no topo e 1 Footer no rodapé,
 * aplicando com autoridade e precisão a Navbar e o Footer mestres da Home em todas as subpáginas,
 * reposicionando o Footer obrigatoriamente no nível RAIZ para ocupar 100% da largura.
 */
export function ensureAndDeduplicateGlobalElements(
  html: string,
  globalNavbarHtml?: string,
  globalFooterHtml?: string,
  activePageSlug?: string,
  navigationRoutes?: Array<{ name: string; href: string }>,
  globalItemsHtml?: string
): string {
  if (!html || typeof html !== 'string') return html || '';
  let cleanHtml = html.trim();

  const headerRegex = /<(?:header|nav)\b[^>]*>[\s\S]*?<\/(?:header|nav)>/gi;
  const footerRegex = /<footer\b[^>]*>[\s\S]*?<\/footer>/gi;

  // 1. DEDUPLICAÇÃO E SUBSTITUIÇÃO DA NAVBAR / HEADER
  if (globalNavbarHtml && globalNavbarHtml.trim().length > 20) {
    cleanHtml = cleanHtml.replace(headerRegex, '');
    let navToInsert = globalNavbarHtml.trim();
    if (activePageSlug) {
      const slugRegex = new RegExp(`(href=["']${activePageSlug}\\.html["'][^>]*class=["'])([^"']*)`, 'gi');
      navToInsert = navToInsert.replace(slugRegex, '$1$2 text-purple-300 font-bold ');
    }
    cleanHtml = `${navToInsert}\n\n${cleanHtml.trim()}`;
  } else {
    const headerMatches = [...cleanHtml.matchAll(headerRegex)];
    if (headerMatches.length > 1) {
      let count = 0;
      cleanHtml = cleanHtml.replace(headerRegex, (match) => {
        count++;
        if (count === 1) return match;
        return '';
      });
    }
  }

  // 2. DEDUPLICAÇÃO E INSERÇÃO PRECISA DO FOOTER (RODAPÉ 100% FULL-WIDTH RAIZ)
  // Determinar qual HTML de Footer usar: o mestre global ou o footer local da própria página
  let targetFooterSource = globalFooterHtml && globalFooterHtml.trim().length > 20
    ? globalFooterHtml
    : null;

  if (!targetFooterSource) {
    const localMatch = cleanHtml.match(footerRegex);
    if (localMatch && localMatch[0].length > 20) {
      targetFooterSource = localMatch[0];
    }
  }

  if (targetFooterSource && targetFooterSource.trim().length > 20) {
    // A) Remover TODAS as ocorrências locais de footer para desanexá-lo de seções contêineres restritivas
    cleanHtml = cleanHtml.replace(footerRegex, '');

    // B) Isolar elementos flutuantes fixos (ex: botão WhatsApp wa.me) para reanexar DEPOIS do footer
    const waFloatingRegex = /<a\b[^>]*href=["'][^"']*wa\.me[^"']*["'][^>]*class=["'][^"']*fixed[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
    const floatingMatches: string[] = [];
    cleanHtml = cleanHtml.replace(waFloatingRegex, (match) => {
      floatingMatches.push(match);
      return '';
    });

    // Sanitizar e expandir o footer para 100% da largura da página (w-full)
    const footerToInsert = fixFooterClasses(targetFooterSource.trim());

    // C) Fechar corretamente as tags de conteúdo <main> caso estejam abertas no final
    if (cleanHtml.includes('<main') && !cleanHtml.includes('</main>')) {
      cleanHtml = `${cleanHtml.trim()}\n</main>`;
    }

    // D) Inserção do Footer no nível RAIZ (FORA de <main> e de qualquer container limitado)
    if (cleanHtml.includes('</main>')) {
      const mainEndIndex = cleanHtml.lastIndexOf('</main>');
      const beforeMainEnd = cleanHtml.substring(0, mainEndIndex + 7);
      const afterMainEnd = cleanHtml.substring(mainEndIndex + 7);
      cleanHtml = `${beforeMainEnd.trim()}\n\n${footerToInsert}\n\n${afterMainEnd.trim()}`;
    } else {
      cleanHtml = `${cleanHtml.trim()}\n\n${footerToInsert}`;
    }

    // E) Reanexar ou Inserir os elementos flutuantes/globais (ex: botão WhatsApp, badge de status) após o footer
    if (globalItemsHtml && globalItemsHtml.trim().length > 10) {
      cleanHtml = cleanHtml.replace(/<div\b[^>]*id=["']global-floating-widgets["'][^>]*>[\s\S]*?<\/div>/gi, '');
      cleanHtml = `${cleanHtml.trim()}\n\n${globalItemsHtml.trim()}`;
    } else if (floatingMatches.length > 0) {
      cleanHtml = `${cleanHtml.trim()}\n\n${floatingMatches.join('\n')}`;
    }
  } else {
    const footerMatches = [...cleanHtml.matchAll(footerRegex)];
    if (footerMatches.length > 1) {
      let count = 0;
      cleanHtml = cleanHtml.replace(footerRegex, (match) => {
        count++;
        if (count === 1) return match;
        return '';
      });
    }
    if (globalItemsHtml && globalItemsHtml.trim().length > 10 && !cleanHtml.includes('id="global-floating-widgets"') && !cleanHtml.includes('global-floating-widgets')) {
      cleanHtml = `${cleanHtml.trim()}\n\n${globalItemsHtml.trim()}`;
    }
  }

  // Sanitizar links para garantir que nenhum leve a arquivos .html que não existem no projeto
  if (navigationRoutes && Array.isArray(navigationRoutes)) {
    cleanHtml = sanitizeNavLinks(cleanHtml, navigationRoutes, activePageSlug || 'index');
  }

  return cleanHtml;
}

// In-memory queue para Scrape Jobs
export const scrapeJobsQueue: Record<string, {
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  websiteUrl: string;
  businessName: string;
  projectId?: string; // Adicionado ID do projeto original
  discoveredPages: Array<{
    name: string;
    slug: string;
    url: string;
    cleanText: string;
    html?: string;
    css?: string;
    js?: string;
    media?: string[];
    rewrittenHtml?: string;
    excerpt: string;
    isHomepage: boolean;
  }>;
  progressMessage?: string;
  error?: string;
}> = {};

/**
 * Worker assíncrono para extração prévia de páginas do site cliente
 */
export async function startWebsiteScrapeJob(
  jobId: string,
  websiteUrl: string,
  businessName: string,
  userId?: string,
  aiProvider?: string,
  ollamaEndpoint?: string, 
  customProxyUrl?: string
) {
  scrapeJobsQueue[jobId] = {
    status: 'scraping',
    websiteUrl,
    businessName,
    discoveredPages: [],
    progressMessage: `Conectando e mapeando páginas de ${websiteUrl}...`
  };

  try {
    // 1. MAPEAMENTO DE PÁGINAS E DETECÇÃO DE MÍDIAS (FASE 1: PREVIEW)
    const scraped = await crawlEntireClientWebsite(websiteUrl, 10, customProxyUrl);

    if (scraped.length === 0) {
      throw new Error('Não foi possível acessar o site ou nenhuma página foi encontrada.');
    }

    const pagesToReturn = [];
    const assetCache = new Map<string, string>();

    for (let i = 0; i < scraped.length; i++) {
      const p = scraped[i];
      if (scrapeJobsQueue[jobId]) {
        scrapeJobsQueue[jobId].progressMessage = `Processando mídias e código da página (${i + 1}/${scraped.length}): ${p.name}...`;
      }
      const code = await extractAndBundlePageComponents(p.html, p.url, customProxyUrl);
      let rawHtml = code.html || p.html;

      try {
        rawHtml = await processPageAssets(rawHtml, p.url, assetCache, userId);
      } catch (assetErr) {
        console.warn(`[ScrapeJob] Não foi possível reescrever mídias de ${p.name}:`, assetErr);
      }

      const localMedia = detectMedia(rawHtml, p.url);

      pagesToReturn.push({
        name: p.name,
        slug: p.slug,
        url: p.url,
        cleanText: p.cleanText,
        html: rawHtml,
        css: code.css || '',
        js: code.js || '',
        media: localMedia,
        excerpt: p.cleanText.slice(0, 180) + '...',
        isHomepage: p.slug === 'index'
      });
    }

    scrapeJobsQueue[jobId] = {
      status: 'completed',
      websiteUrl,
      businessName,
      discoveredPages: pagesToReturn,
      progressMessage: `Mapeamento e extração de HTML, CSS e JS concluídos! ${pagesToReturn.length} páginas importadas.`
    };
  } catch (err: any) {
    console.error(`Erro no Scrape Job ${jobId}:`, err);
    scrapeJobsQueue[jobId] = {
      status: 'failed',
      websiteUrl,
      businessName,
      discoveredPages: [],
      error: err.message || 'Falha ao clonar o site original.'
    };
  }
}

/**
 * Worker assíncrono para Geração Completa Multi-Página Customizada
 */
export async function processCustomRemasterGenerationJob(
  projectId: string,
  businessName: string,
  globalPrompt: string,
  pagesList: Array<{
    name: string;
    slug: string;
    url?: string;
    originalUrl?: string;
    customPrompt?: string;
    cleanText?: string;
    html?: string;
    css?: string;
    js?: string;
    rewrittenHtml?: string;
    isHomepage?: boolean;
    enabled?: boolean;
  }>,
  sharedComponents: { repeatNavbar: boolean; repeatFooter: boolean },
  customApiKey?: string,
  registeredModels?: string[],
  customProxyUrl?: string,
  onProgress?: (status: string, attempt: number, total: number) => void,
  customSkills?: any[],
  userId?: string,
  aiProvider?: string,
  ollamaEndpoint?: string,
  customModel?: string,
  lowSpecMode?: boolean
) {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const proj = await prisma.project.findUnique({ where: { id: projectId } });
      if (proj && proj.ownerId) {
        resolvedUserId = proj.ownerId;
      } else {
        resolvedUserId = 'system';
      }
    }

    const assetCache = new Map<string, string>();
    const activePages = pagesList.filter(p => p.enabled !== false);
    const totalPages = activePages.length;
    const providerLabel = aiProvider === 'ollama' ? 'Ollama' : (aiProvider || 'Gemini');
    const modelLabel = customModel || (aiProvider === 'ollama' ? 'qwen2.5-coder:1.5b' : 'gemini-3.6-flash');

    // 1. PROCESSAR ATIVOS E PREPARAR CONTEÚDO DE TODAS AS PÁGINAS
    if (onProgress) onProgress(`Baixando mídias e extraindo código completo HTML/CSS/JS (${totalPages} páginas)...`, 0, totalPages * 2);
    
    const preparedPages = [];
    for (let i = 0; i < totalPages; i++) {
      if (projectJobsQueue[projectId]?.status === 'cancelled') throw new Error('Job cancelled');
      const p = activePages[i];
      if (onProgress) onProgress(`Preparando estrutura da página (${i + 1}/${totalPages}): ${p.name}...`, i + 1, totalPages * 2);
      
      const targetOriginalUrl = p.originalUrl || p.url || '';
      const sourceHtml = p.html || p.rewrittenHtml || '';
      if (sourceHtml && targetOriginalUrl) {
        try {
          p.rewrittenHtml = await processPageAssets(sourceHtml, targetOriginalUrl, assetCache, resolvedUserId!, projectId);
        } catch (assetErr) {
          console.warn(`[Remaster] Não foi possível reescrever mídias da página ${p.name}:`, assetErr);
        }
      }
      
      // Extrair e agrupar código (HTML, CSS e JS) preservando a página original do cliente
      const rawHtmlToUse = p.rewrittenHtml || p.html || p.cleanText || '';
      const context = await extractAndBundlePageComponents(rawHtmlToUse, targetOriginalUrl, customProxyUrl);
      
      const finalHtml = context.html || rawHtmlToUse;
      const finalCss = [p.css || '', context.css || ''].filter(Boolean).join('\n\n');
      const finalJs = [p.js || '', context.js || ''].filter(Boolean).join('\n\n');

      const createdPage = await prisma.page.create({
        data: {
          projectId,
          name: p.name,
          slug: p.slug,
          isHomepage: p.isHomepage || false,
          html: finalHtml,
          css: finalCss,
          js: finalJs
        }
      });
      
      preparedPages.push({ 
        ...p, 
        html: finalHtml,
        css: finalCss,
        js: finalJs,
        dbId: createdPage.id 
      });
    }

    let homePage = preparedPages.find(p => p.isHomepage || p.slug === 'index') || preparedPages[0];
    const subPages = preparedPages.filter(p => p !== homePage);

    // Mapeamento dos Links Universais de Navegação
    const allNavigationRoutes = [
      { name: homePage.name || 'Home', href: 'index.html' },
      ...subPages.map(p => ({ name: p.name, href: `${p.slug}.html` }))
    ];
    const navigationLinksText = allNavigationRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

    // 2. GERAR MELHORIA DA HOME (PÁGINA 1 DE N) - UMA PÁGINA POR VEZ
    if (onProgress) onProgress(`Melhorando página 1 de ${totalPages} (${homePage.name}) via ${providerLabel} [${modelLabel}]...`, totalPages + 1, totalPages * 2);

    const homeAiPrompt = `
      Você é o Arquiteto Frontend Líder e Designer Master.
      Estamos remasterizando o site "${businessName}".

      OBJETIVO: 
      1. Melhorar o design drasticamente usando Tailwind CSS premium.
      2. PADRONIZAR O CORPO: Retorne uma estrutura limpa de seções que seja compatível com um editor visual.
      3. MANTER O CONTEÚDO: Preserve fielmente todos os textos, títulos e mídias originais.

      DIRETRIZ VISUAL:
      """
      ${globalPrompt || 'Design de altíssimo luxo, moderno, limpo e focado em conversão.'}
      """

      ESTRUTURA E CONTEÚDO ORIGINAL (USE COMO REFERÊNCIA ÚNICA):
      HTML:
      """
      ${homePage.html}
      """
      CSS:
      """
      ${homePage.css}
      """
      JS:
      """
      ${homePage.js}
      """

      MAPA DE NAVEGAÇÃO (NAVBAR):
      ${navigationLinksText}

      REGRAS CRÍTICAS:
      - NAVBAR GLOBAL: Crie uma <header class="sticky top-0 z-50 ..."> rica e responsiva.
      - FOOTER GLOBAL: Crie um <footer class="border-t ..."> elegante.
      - SEM SCRIPTS/STYLES: Retorne apenas HTML no campo "html", CSS no "css" e JS no "js".
      - IMAGENS: Utilize as URLs das imagens presentes no conteúdo original (já processadas).
    `;

    const homeAiResponse = await executeAIRequest(
      homeAiPrompt,
      { html: homePage.html, css: homePage.css, js: homePage.js },
      {
        provider: (aiProvider as any) || 'gemini',
        apiKey: customApiKey,
        model: customModel,
        registeredModels: registeredModels,
        proxyUrl: customProxyUrl,
        ollamaEndpoint: ollamaEndpoint,
        lowSpecMode: lowSpecMode,
        customSkills: customSkills,
        onProgress: (info) => {
          if (onProgress) onProgress(`Gerando página 1 de ${totalPages} (${homePage.name}) [${info.model || modelLabel}]...`, totalPages + 1, totalPages * 2);
        }
      }
    );

    // Atualizar Home imediatamente no banco de dados (reprocessando assets se necessário)
    let finalHomeHtml = homeAiResponse.html || homePage.html;
    try {
      finalHomeHtml = await processPageAssets(finalHomeHtml, homePage.originalUrl || homePage.url || '', assetCache, resolvedUserId!, projectId);
    } catch (e) {
      console.warn('[Remaster] Erro ao reprocessar assets da home gerada:', e);
    }

    finalHomeHtml = ensureAndDeduplicateGlobalElements(finalHomeHtml, undefined, undefined, 'index', allNavigationRoutes);

    await prisma.page.update({
      where: { id: homePage.dbId },
      data: {
        html: finalHomeHtml,
        css: homeAiResponse.css || homePage.css,
        js: homeAiResponse.js || homePage.js
      }
    });

    const { navbarHtml, footerHtml } = extractNavbarAndFooter(finalHomeHtml, businessName, allNavigationRoutes);
    const globalCss = homeAiResponse.css || '';
    const globalJs = homeAiResponse.js || '';

    // 3. GERAR SUBPÁGINAS SEQUENCIALMENTE - UMA PÁGINA POR VEZ
    for (let idx = 0; idx < subPages.length; idx++) {
      if (projectJobsQueue[projectId]?.status === 'cancelled') throw new Error('Job cancelled');
      const sub = subPages[idx];
      const pageNum = idx + 2;
      
      if (onProgress) onProgress(`Melhorando página ${pageNum} de ${totalPages} (${sub.name}) via ${providerLabel} [${modelLabel}]...`, totalPages + pageNum, totalPages * 2);

      const subPrompt = `
        Você é o Engenheiro Frontend do site "${businessName}".
        Subpágina: "${sub.name}" (${sub.slug}).

        OBJETIVO: Design premium, consistência com a Home e padronização para o editor.
        CONTEÚDO ORIGINAL:
        HTML:
        """
        ${sub.html}
        """
        CSS:
        """
        ${sub.css}
        """
        JS:
        """
        ${sub.js}
        """

        ${sharedComponents.repeatNavbar ? `NAVBAR GERADA NA HOME:\n${navbarHtml}` : ''}
        ${sharedComponents.repeatFooter ? `FOOTER GERADO NA HOME:\n${footerHtml}` : ''}

        REGRAS:
        - Mantenha todo o conteúdo e mídias originais.
        - Use a mesma paleta e estilo da Home.
        - Retorne HTML limpo e padronizado.
      `;

      try {
        const subAiResponse = await executeAIRequest(
          subPrompt,
          { html: sub.html, css: sub.css || globalCss, js: sub.js || globalJs },
          {
            provider: (aiProvider as any) || 'gemini',
            apiKey: customApiKey,
            model: customModel,
            registeredModels: registeredModels,
            proxyUrl: customProxyUrl,
            ollamaEndpoint: ollamaEndpoint,
            lowSpecMode: lowSpecMode,
            customSkills: customSkills,
            onProgress: (info) => {
              if (onProgress) onProgress(`Gerando página ${pageNum} de ${totalPages} (${sub.name}) [${info.model || modelLabel}]...`, totalPages + pageNum, totalPages * 2);
            }
          }
        );

        // SALVAR IMEDIATAMENTE NO BANCO DE DADOS CADA SUBPÁGINA CONCLUÍDA (reprocessando assets)
        let finalSubHtml = subAiResponse.html || sub.html;
        try {
          finalSubHtml = await processPageAssets(finalSubHtml, sub.originalUrl || sub.url || '', assetCache, resolvedUserId!, projectId);
        } catch (e) {
          console.warn(`[Remaster] Erro ao reprocessar assets da subpágina ${sub.name}:`, e);
        }

        finalSubHtml = ensureAndDeduplicateGlobalElements(finalSubHtml, navbarHtml, footerHtml, sub.slug, allNavigationRoutes);

        await prisma.page.update({
          where: { id: sub.dbId },
          data: {
            html: finalSubHtml,
            css: subAiResponse.css || globalCss,
            js: subAiResponse.js || globalJs
          }
        });
      } catch (e: any) {
        console.error(`Erro ao melhorar subpágina ${sub.name}:`, e);
      }
    }

    if (onProgress) onProgress(`Site remasterizado com sucesso! (${totalPages} páginas atualizadas)`, totalPages * 2, totalPages * 2);
    return projectId;
  } catch (err: any) {
    console.error("Erro no processCustomRemasterGenerationJob:", err);
    throw err;
  }
}

/**
 * Worker assíncrono padrão que melhora e reconstrói o site completo com IA
 */
export async function processWebsiteRemasterJob(
  projectId: string,
  websiteUrl: string,
  businessName: string,
  customApiKey?: string,
  registeredModels?: string[],
  customProxyUrl?: string,
  onProgress?: (status: string, attempt: number, total: number) => void,
  customSkills?: any[],
  aiProvider?: string,
  ollamaEndpoint?: string,
  customModel?: string,
  lowSpecMode?: boolean,
  userId?: string
) {
  try {
    if (onProgress) onProgress(`Analisando estrutura e páginas do site (${websiteUrl})...`, 1, 4);

    const scrapedPages = await crawlEntireClientWebsite(websiteUrl, 6, customProxyUrl);
    
    let homeText = '';
    let homeHtml = '';
    let homeUrl = '';
    let targetPagesList: Array<{ name: string; slug: string; customPrompt?: string; cleanText?: string; html?: string; originalUrl?: string }> = [];

    if (scrapedPages.length > 1) {
      const homeScraped = scrapedPages.find(p => p.slug === 'index') || scrapedPages[0];
      homeText = homeScraped.cleanText;
      homeHtml = homeScraped.html;
      homeUrl = homeScraped.url;
      
      const otherScraped = scrapedPages.filter(p => p !== homeScraped);
      for (const sub of otherScraped) {
        targetPagesList.push({
          name: sub.name,
          slug: sub.slug,
          customPrompt: `Subpágina original: ${sub.url}`,
          cleanText: sub.cleanText,
          html: sub.html,
          originalUrl: sub.url
        });
      }
    } else {
      homeText = scrapedPages.length === 1 
        ? scrapedPages[0].cleanText 
        : `Empresa ${businessName} (${websiteUrl}): Soluções completas e canais de atendimento.`;
        
      if (scrapedPages.length === 1) {
        homeHtml = scrapedPages[0].html;
        homeUrl = scrapedPages[0].url;
      }

      targetPagesList = [
        { name: "Serviços", slug: "servicos", customPrompt: "Soluções completas e produtos da empresa" },
        { name: "Sobre Nós", slug: "sobre", customPrompt: "História, autoridade e equipe" },
        { name: "Contato", slug: "contato", customPrompt: "Canais de atendimento e localização" }
      ];
    }

    await processCustomRemasterGenerationJob(
      projectId,
      businessName,
      `Site moderno, responsivo e elegante para a empresa ${businessName}`,
      [
        { name: 'Home', slug: 'index', isHomepage: true, cleanText: homeText, html: homeHtml, originalUrl: homeUrl },
        ...targetPagesList
      ],
      { repeatNavbar: true, repeatFooter: true },
      customApiKey,
      registeredModels,
      customProxyUrl,
      onProgress,
      customSkills,
      userId,
      aiProvider,
      ollamaEndpoint,
      customModel,
      lowSpecMode
    );
  } catch (err: any) {
    console.error("Erro no processWebsiteRemasterJob:", err);
    throw err;
  }
}
