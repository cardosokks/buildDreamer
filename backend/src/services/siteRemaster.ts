import { prisma } from '../db';
import { generateAIResponse } from '../services/gemini';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

export interface ScrapedMedia {
  url: string;
  alt?: string;
  type: 'image' | 'video' | 'logo' | 'icon';
  role?: 'logo' | 'hero' | 'card' | 'gallery' | 'content' | 'video';
  localUrl?: string;
}

export interface ScrapedPage {
  url: string;
  slug: string;
  name: string;
  html: string;
  cleanText: string;
  css?: string;
  js?: string;
  media: ScrapedMedia[];
}

/**
 * Normaliza e resolve URLs internas de um site
 */
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

      // Extração inteligente de Imagens e Vídeos da página
      const pageMedia: ScrapedMedia[] = [];
      const seenMediaUrls = new Set<string>();

      const resolveMediaUrl = (src: string): string | null => {
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) return null;
        try {
          return new URL(src, currentUrl).href;
        } catch {
          return null;
        }
      };

      // 1. Tags <img>
      const imgRegex = /<img\b[^>]*?src=["']([^"']+)["'][^>]*>/gi;
      let imgMatch: RegExpExecArray | null;
      while ((imgMatch = imgRegex.exec(html)) !== null) {
        const rawSrc = imgMatch[1];
        const fullImgTag = imgMatch[0];
        const resolved = resolveMediaUrl(rawSrc);
        if (!resolved || seenMediaUrls.has(resolved)) continue;

        // Ignora imagens insignificantes (trackers, 1x1 pixels)
        if (resolved.includes('pixel') || resolved.includes('tracking') || resolved.includes('favicon.ico')) continue;

        seenMediaUrls.add(resolved);
        const altMatch = fullImgTag.match(/alt=["']([^"']*)["']/i);
        const classMatch = fullImgTag.match(/class=["']([^"']*)["']/i);
        const alt = altMatch ? altMatch[1].trim() : '';
        const cls = classMatch ? classMatch[1].toLowerCase() : '';

        let role: ScrapedMedia['role'] = 'content';
        if (/logo|brand|marca/i.test(resolved) || /logo|brand|marca/i.test(alt) || /logo|brand|marca/i.test(cls)) {
          role = 'logo';
        } else if (/hero|banner|destaque|cover/i.test(resolved) || /hero|banner|destaque|cover/i.test(cls)) {
          role = 'hero';
        } else if (/card|servico|produto|item|service|product/i.test(resolved) || /card|item/i.test(cls)) {
          role = 'card';
        }

        pageMedia.push({
          url: resolved,
          alt: alt || `${name} Imagem`,
          type: role === 'logo' ? 'logo' : 'image',
          role
        });
      }

      // 2. background-image em tags inline
      const bgRegex = /background(?:-image)?:\s*url\(['"]?([^'")]+)['"]?\)/gi;
      let bgMatch: RegExpExecArray | null;
      while ((bgMatch = bgRegex.exec(html)) !== null) {
        const rawBg = bgMatch[1];
        const resolved = resolveMediaUrl(rawBg);
        if (resolved && !seenMediaUrls.has(resolved)) {
          seenMediaUrls.add(resolved);
          pageMedia.push({
            url: resolved,
            alt: `${name} Background`,
            type: 'image',
            role: 'hero'
          });
        }
      }

      // 3. Vídeos (iframe youtube/vimeo ou tag video)
      const iframeRegex = /<iframe\b[^>]*?src=["']([^"']+)["'][^>]*>/gi;
      let ifrMatch: RegExpExecArray | null;
      while ((ifrMatch = iframeRegex.exec(html)) !== null) {
        const rawIfr = ifrMatch[1];
        if (/youtube\.com|youtu\.be|vimeo\.com/i.test(rawIfr)) {
          const resolved = resolveMediaUrl(rawIfr) || rawIfr;
          if (!seenMediaUrls.has(resolved)) {
            seenMediaUrls.add(resolved);
            pageMedia.push({
              url: resolved,
              alt: `${name} Vídeo Institucional`,
              type: 'video',
              role: 'video'
            });
          }
        }
      }

      // Extrai estilos inline e scripts da página original para referência da IA
      let pageCss = '';
      const styleMatches = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
      styleMatches.forEach(sm => {
        if (sm[1] && sm[1].trim()) pageCss += sm[1].trim() + '\n';
      });

      let pageJs = '';
      const scriptMatches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
      scriptMatches.forEach(sm => {
        const scriptCode = sm[1]?.trim() || '';
        // Ignora trackers (analytics, pixel)
        if (scriptCode && !/gtag|google-analytics|facebook|fbevents|clarity|hotjar/i.test(scriptCode)) {
          pageJs += scriptCode.slice(0, 1500) + '\n';
        }
      });

      pages.push({
        url: currentUrl,
        slug,
        name,
        html,
        cleanText,
        css: pageCss,
        js: pageJs,
        media: pageMedia
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
 * Extrai o bloco exato de Header/Navbar e Footer gerado na Home,
 * consolida os links de navegação de todas as páginas e garante
 * que não fiquem blocos duplicados no corpo da página.
 */
export function extractNavbarAndFooter(
  homeHtml: string, 
  allPages?: Array<{ name: string; slug: string }>
): { navbarHtml: string; footerHtml: string; cleanHomeContentHtml: string } {
  let navbarHtml = '';
  let footerHtml = '';
  let cleanHomeContentHtml = homeHtml;

  const navMatch = homeHtml.match(/<header\b[^>]*>[\s\S]*?<\/header>|<nav\b[^>]*>[\s\S]*?<\/nav>/i);
  if (navMatch) {
    navbarHtml = navMatch[0];
    cleanHomeContentHtml = cleanHomeContentHtml.replace(navMatch[0], '').trim();
  }

  const footMatch = cleanHomeContentHtml.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i);
  if (footMatch) {
    footerHtml = footMatch[0];
    cleanHomeContentHtml = cleanHomeContentHtml.replace(footMatch[0], '').trim();
  }

  // Se foram fornecidas as páginas do site, atualiza/garante que os links estejam completos na Navbar
  if (allPages && allPages.length > 0 && navbarHtml) {
    const missingLinks: string[] = [];
    allPages.forEach(p => {
      const targetHref = p.slug === 'index' ? 'index.html' : `${p.slug}.html`;
      if (!navbarHtml.includes(targetHref) && !navbarHtml.includes(`/${p.slug}`)) {
        missingLinks.push(`<a href="${targetHref}" class="text-sm font-medium hover:text-purple-400 transition-colors">${p.name}</a>`);
      }
    });

    if (missingLinks.length > 0) {
      // Injeta links adicionais dentro do <nav> existente
      const navTagMatch = navbarHtml.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i);
      if (navTagMatch) {
        const updatedNav = `<nav ${navTagMatch[0].split('>')[0].replace('<nav', '')}>${navTagMatch[1]}\n  ${missingLinks.join('\n  ')}</nav>`;
        navbarHtml = navbarHtml.replace(navTagMatch[0], updatedNav);
      }
    }
  }

  return { navbarHtml, footerHtml, cleanHomeContentHtml };
}

/**
 * Remove qualquer tag <header>, <nav> ou <footer> duplicada do HTML de subpáginas
 */
export function stripDuplicateGlobals(html: string): string {
  if (!html) return '';
  return html
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
    .trim();
}

// In-memory queue para Scrape Jobs
export const scrapeJobsQueue: Record<string, {
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  websiteUrl: string;
  businessName: string;
  discoveredPages: Array<{
    name: string;
    slug: string;
    url: string;
    html?: string;
    css?: string;
    js?: string;
    cleanText: string;
    excerpt: string;
    isHomepage: boolean;
    media: ScrapedMedia[];
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
  customProxyUrl?: string
) {
  scrapeJobsQueue[jobId] = {
    status: 'scraping',
    websiteUrl,
    businessName,
    discoveredPages: [],
    progressMessage: `Conectando e descobrindo páginas de ${websiteUrl}...`
  };

  try {
    const scraped = await crawlEntireClientWebsite(websiteUrl, 8, customProxyUrl);

    let pagesToReturn: Array<{
      name: string;
      slug: string;
      url: string;
      html?: string;
      css?: string;
      js?: string;
      cleanText: string;
      excerpt: string;
      isHomepage: boolean;
      media: ScrapedMedia[];
    }> = [];

    if (scraped.length > 0) {
      pagesToReturn = scraped.map(p => ({
        name: p.name,
        slug: p.slug,
        url: p.url,
        html: p.html,
        css: p.css || '',
        js: p.js || '',
        cleanText: p.cleanText,
        excerpt: p.cleanText.slice(0, 180) + '...',
        isHomepage: p.slug === 'index',
        media: p.media || []
      }));

      // Se a Home não estiver explícita, marca a primeira como Home
      if (!pagesToReturn.some(p => p.isHomepage)) {
        pagesToReturn[0].isHomepage = true;
        pagesToReturn[0].slug = 'index';
      }
    } else {
      // Fallback inteligente caso o crawler não consiga acessar diretamente (ex: Cloudflare restrito)
      pagesToReturn = [
        {
          name: 'Home',
          slug: 'index',
          url: websiteUrl,
          cleanText: `Página principal de ${businessName}. Apresentação da empresa, proposta de valor e diferenciais.`,
          excerpt: `Apresentação institucional e serviços principais de ${businessName}...`,
          isHomepage: true,
          media: []
        },
        {
          name: 'Serviços',
          slug: 'servicos',
          url: `${websiteUrl}/servicos`,
          cleanText: `Catálogo completo de soluções e serviços prestados por ${businessName}.`,
          excerpt: `Produtos e soluções com especificações e benefícios...`,
          isHomepage: false,
          media: []
        },
        {
          name: 'Sobre Nós',
          slug: 'sobre',
          url: `${websiteUrl}/sobre`,
          cleanText: `História, missão, visão e autoridade de ${businessName} no mercado.`,
          excerpt: `História e autoridade no mercado...`,
          isHomepage: false,
          media: []
        },
        {
          name: 'Contato',
          slug: 'contato',
          url: `${websiteUrl}/contato`,
          cleanText: `Formulário de atendimento, WhatsApp, localização e telefones de ${businessName}.`,
          excerpt: `Canais de atendimento direto e localização...`,
          isHomepage: false,
          media: []
        }
      ];
    }

    scrapeJobsQueue[jobId] = {
      status: 'completed',
      websiteUrl,
      businessName,
      discoveredPages: pagesToReturn,
      progressMessage: `Extração concluída com sucesso! ${pagesToReturn.length} páginas mapeadas.`
    };
  } catch (err: any) {
    console.error(`Erro no Scrape Job ${jobId}:`, err);
    scrapeJobsQueue[jobId] = {
      status: 'failed',
      websiteUrl,
      businessName,
      discoveredPages: [],
      error: err.message || 'Falha ao raspar páginas do site.'
    };
  }
}

/**
 * Baixa e armazena mídias remotas na pasta de uploads do projeto e registra no Prisma
 */
export async function downloadAndStoreProjectMedia(
  projectId: string,
  mediaList: ScrapedMedia[],
  userId?: string,
  proxyUrl?: string
): Promise<ScrapedMedia[]> {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
  if (!fs.existsSync(uploadsDir)) {
    try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
  }

  const processedMedia: ScrapedMedia[] = [];
  const validExts: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/gif': 'gif'
  };

  for (let i = 0; i < Math.min(mediaList.length, 25); i++) {
    const item = mediaList[i];
    if (item.type === 'video') {
      processedMedia.push(item);
      continue;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) {
        processedMedia.push(item);
        continue;
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const ext = validExts[contentType.toLowerCase().split(';')[0]] || 'jpg';
      const buffer = Buffer.from(await res.arrayBuffer());

      if (buffer.length < 500) {
        // Imagem muito pequena/vazia, mantém url original
        processedMedia.push(item);
        continue;
      }

      const safeName = item.alt ? item.alt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) : 'midia';
      const filename = `${item.role || 'img'}_${Date.now()}_${i}_${safeName}.${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, buffer);

      const localPublicUrl = `/uploads/projects/${projectId}/${filename}`;
      const mediaId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      if (userId) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "Media" ("id", "name", "url", "size", "mimeType", "userId", "projectId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            mediaId, item.alt || filename, localPublicUrl, buffer.length, contentType, userId, projectId
          );
        } catch (dbErr) {
          console.warn('Aviso ao registrar mídia no banco:', dbErr);
        }
      }

      processedMedia.push({
        ...item,
        localUrl: localPublicUrl
      });
    } catch (e) {
      processedMedia.push(item);
    }
  }

  return processedMedia;
}

/**
 * Worker assíncrono para Geração Completa Multi-Página Customizada
 */
export async function processCustomRemasterGenerationJob(
  projectId: string,
  projectName: string,
  globalPrompt: string,
  pages: Array<{
    name: string;
    slug: string;
    originalUrl?: string;
    customPrompt?: string;
    cleanText?: string;
    html?: string;
    css?: string;
    js?: string;
    isHomepage?: boolean;
    enabled?: boolean;
    media?: ScrapedMedia[];
  }>,
  sharedComponents: {
    repeatNavbar: boolean;
    repeatFooter: boolean;
  },
  customApiKey?: string,
  registeredModels?: string[],
  customProxyUrl?: string,
  onProgress?: (status: string, attempt: number, total: number) => void,
  customSkills?: any[],
  userId?: string
) {
  try {
    const activePages = pages.filter(p => p.enabled !== false);
    if (activePages.length === 0) throw new Error('Nenhuma página selecionada para geração.');

    let homePage = activePages.find(p => p.isHomepage || p.slug === 'index') || activePages[0];
    const subPages = activePages.filter(p => p !== homePage);

    // Mapeamento dos Links Universais de Navegação
    const allNavigationRoutes = [
      { name: homePage.name || 'Home', slug: 'index', href: 'index.html' },
      ...subPages.map(p => ({ name: p.name, slug: p.slug, href: `${p.slug}.html` }))
    ];
    const navigationLinksText = allNavigationRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

    // 0. EXTRAIR E SALVAR MÍDIAS NA BIBLIOTECA DO PROJETO
    if (onProgress) onProgress(`Importando e organizando mídias e logos reais do site...`, 1, subPages.length + 2);

    const allDiscoveredMedia: ScrapedMedia[] = [];
    pages.forEach(p => {
      if (p.media && Array.isArray(p.media)) {
        p.media.forEach(m => {
          if (!allDiscoveredMedia.some(existing => existing.url === m.url)) {
            allDiscoveredMedia.push(m);
          }
        });
      }
    });

    const storedMediaList = await downloadAndStoreProjectMedia(projectId, allDiscoveredMedia, userId, customProxyUrl);

    // Constrói sumário de imagens reais prontas para a IA utilizar
    const logoMedia = storedMediaList.find(m => m.role === 'logo');
    const heroMedia = storedMediaList.filter(m => m.role === 'hero');
    const cardMedia = storedMediaList.filter(m => m.role === 'card');
    const contentMedia = storedMediaList.filter(m => m.role === 'content');
    const videoMedia = storedMediaList.filter(m => m.type === 'video');

    const availableMediaCatalog = `
      MÍDIAS REAIS DA EMPRESA DISPONÍVEIS NO SERVIDOR DO PROJETO (UTILIZE ESTAS TAGS/URLS DIRETAMENTE NO HTML):
      ${logoMedia ? `- LOGO DA EMPRESA: <img src="${logoMedia.localUrl || logoMedia.url}" alt="${projectName} Logo" class="h-10 w-auto object-contain" />` : ''}
      ${heroMedia.map((m, i) => `- IMAGEM DE DESTAQUE ${i + 1}: <img src="${m.localUrl || m.url}" alt="${m.alt || projectName}" class="w-full h-auto rounded-2xl object-cover shadow-2xl" />`).join('\n')}
      ${cardMedia.map((m, i) => `- IMAGEM DE SERVIÇO/CARD ${i + 1}: <img src="${m.localUrl || m.url}" alt="${m.alt || 'Serviço'}" class="w-full h-48 object-cover rounded-xl" />`).join('\n')}
      ${contentMedia.slice(0, 6).map((m, i) => `- IMAGEM DE CONTEÚDO/TUTORIAL ${i + 1}: <img src="${m.localUrl || m.url}" alt="${m.alt || 'Tutorial'}" class="w-full rounded-xl" />`).join('\n')}
      ${videoMedia.map((m, i) => `- VÍDEO INSTITUCIONAL ${i + 1}: <iframe src="${m.url}" class="w-full aspect-video rounded-2xl" frameborder="0" allowfullscreen></iframe>`).join('\n')}
    `;

    // 1. GERAR A HOME E CRIAR OS COMPONENTES UNIVERSAIS (Navbar e Footer)
    if (onProgress) onProgress(`IA criando arquitetura da Home e Design System Universal...`, 1, subPages.length + 1);

    const homeAiPrompt = `
      Você é o Arquiteto Frontend Líder e Designer Master do Visual Builder.
      Estamos remasterizando e elevando para o estado da arte o site da empresa "${projectName}".

      DIRETRIZ VISUAL E IDENTIDADE ÚNICA DO TEMA:
      """
      ${globalPrompt || 'Design de altíssimo luxo, moderna paleta, tipografia impecável, foco em conversão e interações fluidas.'}
      """

      FILOSOFIA DE REMASTERIZAÇÃO:
      - NÃO É APENAS REFAZER DO ZERO COM TEMPLATE GENÉRICO: É MELHORAR, PRESERVAR A ESSÊNCIA DA MARCA E PROFISSIONALIZAR O CONTEÚDO REAL.
      - Respeite a identidade visual do nicho da empresa (${projectName}), aplicando paletas de cores, contraste e estilo visual característicos e autênticos para esse segmento de mercado.
      - Utilize os textos reais, propostas de valor, nomes dos serviços/produtos e informações de contato extraídos do site original.

      ${availableMediaCatalog}

      PROMPT ESPECÍFICO DA HOME:
      """
      ${homePage.customPrompt || 'Hero Section impactante com CTA duplo, estatísticas, seção de serviços em destaque, depoimentos e formulário.'}
      """

      CONTEÚDO TEXTUAL EXTRAÍDO DO SITE ORIGINAL:
      """
      ${homePage.cleanText || `Empresa ${projectName}: soluções completas e autoridade.`}
      """

      ${homePage.html ? `
      ESTRUTURA E CÓDIGO DO SITE ANTIGO (USE COMO BASE PARA ENTENDER A DISTRIBUIÇÃO DAS SEÇÕES, COMPONENTES E MELHORAR):
      """
      HTML ORIGINAL (Trecho representativo):
      ${homePage.html.slice(0, 3000)}
      """
      ` : ''}

      ${homePage.css ? `
      CSS / ESTILOS ORIGINAIS (Referência de cores/elementos da marca):
      """
      ${homePage.css.slice(0, 1500)}
      """
      ` : ''}

      ${homePage.js ? `
      JS / COMPORTAMENTOS ORIGINAIS:
      """
      ${homePage.js.slice(0, 1000)}
      """
      ` : ''}

      MAPA DE NAVEGAÇÃO OBRIGATÓRIO PARA A NAVBAR (LINKS PARA TODAS AS PÁGINAS DO SITE):
      ${navigationLinksText}

      REGRAS CRÍTICAS DE COMPONENTES REUTILIZÁVEIS:
      1. Crie uma <header class="sticky top-0 z-50 ..."> com uma NAVBAR rica, responsiva, com a logo "${projectName}" (use a tag da logo se disponível) e os links acima.
      2. Crie um <footer class="border-t ..."> elegante no final da página com os mesmos links de navegação e copyright.
      3. REUTILIZAÇÃO DE MÍDIAS: Empregue as URLs e tags de imagens reais listadas acima para dar realismo à página.
      4. SEPARAÇÃO ESTRITA: Retorne HTML sem <style> nem <script>. Todo CSS no campo "css" e JS no campo "js".
    `;

    const homeAiResponse = await generateAIResponse(
      homeAiPrompt,
      { html: '', css: '', js: '' },
      customApiKey,
      undefined,
      registeredModels,
      (model, attempt, total) => {
        if (onProgress) onProgress(`IA gerando Home (${model} - ${attempt}/${total})...`, 1, subPages.length + 1);
      },
      customProxyUrl,
      customSkills
    );

    // Salvar Home no Prisma
    const existingHome = await prisma.page.findFirst({
      where: { projectId, isHomepage: true }
    });

    if (existingHome) {
      await prisma.page.update({
        where: { id: existingHome.id },
        data: {
          name: homePage.name || 'Home',
          html: homeAiResponse.html || existingHome.html,
          css: homeAiResponse.css || '',
          js: homeAiResponse.js || ''
        }
      });
    }

    const homeHtml = homeAiResponse.html || '';
    const globalCss = homeAiResponse.css || '';
    const globalJs = homeAiResponse.js || '';
    
    // Extrai os blocos de Navbar e Footer gerados na Home e consolida links de navegação
    const { navbarHtml, footerHtml, cleanHomeContentHtml } = extractNavbarAndFooter(homeHtml, allNavigationRoutes);
    if (navbarHtml || footerHtml) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          ...(navbarHtml ? { navbarHtml } : {}),
          ...(footerHtml ? { footerHtml } : {})
        }
      }).catch((e) => console.warn('Aviso ao salvar navbar/footer no projeto:', e));

      // Atualiza a Home com o conteúdo limpo (sem navbar/footer embutido duplicado)
      if (existingHome && cleanHomeContentHtml) {
        await prisma.page.update({
          where: { id: existingHome.id },
          data: {
            html: cleanHomeContentHtml
          }
        }).catch(() => {});
      }
    }

    // 2. GERAR TODAS AS SUBPÁGINAS SEQUENCIALMENTE PARA EVITAR RATE LIMIT DA API
    if (subPages.length > 0) {
      if (onProgress) onProgress(`IA gerando ${subPages.length} subpáginas sequencialmente...`, 2, subPages.length + 1);

      for (let idx = 0; idx < subPages.length; idx++) {
        const sub = subPages[idx];
        const subPrompt = `
            Você é o Engenheiro Frontend do site "${projectName}".
            Estamos gerando a subpágina "${sub.name}" (arquivo: ${sub.slug}.html).

            DIRETRIZ GLOBAL DO SITE:
            """
            ${globalPrompt}
            """

            ${availableMediaCatalog}

            PROMPT ESPECÍFICO DESTA SUBPÁGINA ("${sub.name}"):
            """
            ${sub.customPrompt || `Apresente detalhadamente as informações, benefícios e recursos de ${sub.name}.`}
            """

            CONTEÚDO TEXTUAL EXTRAÍDO DA SUBPÁGINA ORIGINAL:
            """
            ${sub.cleanText || `Conteúdo institucional e serviços de ${sub.name}.`}
            """

            ${sub.html ? `
            ESTRUTURA E CÓDIGO DA SUBPÁGINA ANTIGA (USE COMO BASE PARA MELHORAR E REORGANIZAR O CONTEÚDO):
            """
            HTML ORIGINAL (Trecho):
            ${sub.html.slice(0, 2500)}
            """
            ` : ''}

            ${sub.css ? `
            CSS ORIGINAL DA SUBPÁGINA:
            """
            ${sub.css.slice(0, 1000)}
            """
            ` : ''}

            ${sub.js ? `
            JS ORIGINAL DA SUBPÁGINA:
            """
            ${sub.js.slice(0, 800)}
            """
            ` : ''}

            REGRAS MANDATÓRIAS (MODELO WORDPRESS GLOBAL BLOCKS):
            1. NÃO GERE HEADER, NAVBAR NEM FOOTER: A Navbar e o Footer já são gerenciados como Blocos Globais do projeto e são acoplados automaticamente no topo e rodapé.
            2. GERE APENAS O CONTEÚDO DO CORPO (<main> ou seções da página "${sub.name}").
            3. CONSISTÊNCIA DE TEMA: Mantenha a mesma paleta de cores, tipografia, bordas e cards da Home.
            4. IMAGENS REAIS: Se houver imagens ou vídeos acima referentes a ${sub.name}, insira-os no conteúdo de forma elegante.
            5. SEPARAÇÃO TOTAL: Retorne APENAS HTML limpo no campo "html" (sem tags <style> nem <script>).
          `;

          try {
            const subAiResponse = await generateAIResponse(
              subPrompt,
              { html: '', css: globalCss, js: globalJs },
              customApiKey,
              undefined,
              registeredModels,
              undefined,
              customProxyUrl,
              customSkills
            );

            const rawSubHtml = subAiResponse.html || '<div>Subpágina</div>';
            const cleanSubHtml = stripDuplicateGlobals(rawSubHtml);

            const existingSub = await prisma.page.findFirst({
              where: { projectId, slug: sub.slug }
            });

            if (existingSub) {
              await prisma.page.update({
                where: { id: existingSub.id },
                data: {
                  name: sub.name,
                  html: cleanSubHtml || existingSub.html,
                  css: subAiResponse.css || globalCss,
                  js: subAiResponse.js || globalJs
                }
              });
            } else {
              await prisma.page.create({
                data: {
                  projectId,
                  name: sub.name,
                  slug: sub.slug,
                  html: cleanSubHtml || '<div>Subpágina</div>',
                  css: subAiResponse.css || globalCss,
                  js: subAiResponse.js || globalJs,
                  isHomepage: false
                }
              });
            }
          } catch (err: any) {
            console.error(`Erro ao gerar subpágina "${sub.name}":`, err.message);
          }
      }
    }

    if (onProgress) onProgress(`Site 100% gerado com sucesso!`, subPages.length + 1, subPages.length + 1);
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
  userId?: string
) {
  try {
    if (onProgress) onProgress(`Analisando estrutura, imagens e páginas do site (${websiteUrl})...`, 1, 4);

    const scrapedPages = await crawlEntireClientWebsite(websiteUrl, 6, customProxyUrl);
    
    let homeText = '';
    let targetPagesList: Array<{ name: string; slug: string; customPrompt?: string; cleanText?: string; media?: ScrapedMedia[] }> = [];

    if (scrapedPages.length > 1) {
      const homeScraped = scrapedPages.find(p => p.slug === 'index') || scrapedPages[0];
      homeText = homeScraped.cleanText;
      
      const otherScraped = scrapedPages.filter(p => p !== homeScraped);
      for (const sub of otherScraped) {
        targetPagesList.push({
          name: sub.name,
          slug: sub.slug,
          customPrompt: `Subpágina original: ${sub.url}`,
          cleanText: sub.cleanText,
          media: sub.media
        });
      }
    } else {
      homeText = scrapedPages.length === 1 
        ? scrapedPages[0].cleanText 
        : `Empresa ${businessName} (${websiteUrl}): Soluções completas e canais de atendimento.`;

      targetPagesList = [
        { name: "Serviços", slug: "servicos", customPrompt: "Soluções completas e produtos da empresa" },
        { name: "Sobre Nós", slug: "sobre", customPrompt: "História, autoridade e equipe" },
        { name: "Contato", slug: "contato", customPrompt: "Canais de atendimento e localização" }
      ];
    }

    const homeMedia = scrapedPages.length > 0 ? scrapedPages[0].media : [];

    await processCustomRemasterGenerationJob(
      projectId,
      businessName,
      `Site moderno, responsivo e elegante para a empresa ${businessName}`,
      [
        { name: 'Home', slug: 'index', isHomepage: true, cleanText: homeText, media: homeMedia },
        ...targetPagesList
      ],
      { repeatNavbar: true, repeatFooter: true },
      customApiKey,
      registeredModels,
      customProxyUrl,
      onProgress,
      customSkills,
      userId
    );
  } catch (err: any) {
    console.error("Erro no processWebsiteRemasterJob:", err);
    throw err;
  }
}
