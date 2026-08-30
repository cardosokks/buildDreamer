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
 * Detecta e substitui mídias em um HTML de forma robusta e as salva no banco/armazenamento
 */
async function processPageAssets(
  html: string, 
  baseUrl: string, 
  assetCache: Map<string, string>,
  userId?: string,
  projectId?: string,
  aiProvider?: string,
  ollamaEndpoint?: string
): Promise<string> {
  let rewrittenHtml = html;
  
  // Regex aprimorada para capturar src, href, poster, data-src, data-bg, etc.
  const assetRegex = /(src|href|poster|data-src|data-bg)=["']([^"'#?]+(\.(png|jpe?g|gif|svg|webp|mp4|webm|css|js|woff2?))(\?[^"']*)?)["']/gi;
  
  const matches = [...html.matchAll(assetRegex)];
  
  for (const match of matches) {
    const attribute = match[1];
    const originalUrl = match[2];
    
    try {
      const fullUrl = new URL(originalUrl, baseUrl).href;
      
      if (assetCache.has(fullUrl)) {
        rewrittenHtml = rewrittenHtml.replace(originalUrl, assetCache.get(fullUrl)!);
        continue;
      }

      console.log(`[Remaster] Baixando e salvando asset: ${fullUrl}`);
      const { buffer, contentType } = await downloadAsset(fullUrl);
      
      const fileName = `${crypto.randomBytes(4).toString('hex')}_${fullUrl.split('/').pop()?.split('?')[0] || 'asset'}`;
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
    if (originalUrl.startsWith('data:')) continue; // Ignora base64
    
    try {
      const fullUrl = new URL(originalUrl, baseUrl).href;
      if (assetCache.has(fullUrl)) {
        rewrittenHtml = rewrittenHtml.split(originalUrl).join(assetCache.get(fullUrl)!);
        continue;
      }
      const { buffer, contentType } = await downloadAsset(fullUrl);
      const fileName = `bg_${crypto.randomBytes(4).toString('hex')}_${fullUrl.split('/').pop()?.split('?')[0] || 'bg'}`;
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
    } catch (err) {}
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

/**
 * Extrai o bloco exato de Header/Navbar e Footer gerado na Home para reutilização idêntica em todas as subpáginas
 */
export function extractNavbarAndFooter(homeHtml: string): { navbarHtml: string; footerHtml: string } {
  let navbarHtml = '';
  let footerHtml = '';

  const navMatch = homeHtml.match(/<header\b[^>]*>[\s\S]*?<\/header>|<nav\b[^>]*>[\s\S]*?<\/nav>/i);
  if (navMatch) {
    navbarHtml = navMatch[0];
  }

  const footMatch = homeHtml.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i);
  if (footMatch) {
    footerHtml = footMatch[0];
  }

  return { navbarHtml, footerHtml };
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
    const modelLabel = customModel || (aiProvider === 'ollama' ? 'qwen2.5-coder:1.5b' : 'gemini-2.5-flash');

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

    // Atualizar Home imediatamente no banco de dados
    await prisma.page.update({
      where: { id: homePage.dbId },
      data: {
        html: homeAiResponse.html || homePage.html,
        css: homeAiResponse.css || homePage.css,
        js: homeAiResponse.js || homePage.js
      }
    });

    const { navbarHtml, footerHtml } = extractNavbarAndFooter(homeAiResponse.html || '');
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

        // SALVAR IMEDIATAMENTE NO BANCO DE DADOS CADA SUBPÁGINA CONCLUÍDA
        await prisma.page.update({
          where: { id: sub.dbId },
          data: {
            html: subAiResponse.html || sub.html,
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
