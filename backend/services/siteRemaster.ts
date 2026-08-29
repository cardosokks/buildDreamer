import { prisma } from '../db';
import { generateAIResponse } from '../services/gemini';
import https from 'https';
import http from 'http';

interface ScrapedPage {
  url: string;
  slug: string;
  name: string;
  html: string;
  cleanText: string;
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
  discoveredPages: Array<{
    name: string;
    slug: string;
    url: string;
    cleanText: string;
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
      cleanText: string;
      excerpt: string;
      isHomepage: boolean;
    }> = [];

    if (scraped.length > 0) {
      pagesToReturn = scraped.map(p => ({
        name: p.name,
        slug: p.slug,
        url: p.url,
        cleanText: p.cleanText,
        excerpt: p.cleanText.slice(0, 180) + '...',
        isHomepage: p.slug === 'index'
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
          isHomepage: true
        },
        {
          name: 'Serviços',
          slug: 'servicos',
          url: `${websiteUrl}/servicos`,
          cleanText: `Catálogo completo de soluções e serviços prestados por ${businessName}.`,
          excerpt: `Produtos e soluções com especificações e benefícios...`,
          isHomepage: false
        },
        {
          name: 'Sobre Nós',
          slug: 'sobre',
          url: `${websiteUrl}/sobre`,
          cleanText: `História, missão, visão e autoridade de ${businessName} no mercado.`,
          excerpt: `História e autoridade no mercado...`,
          isHomepage: false
        },
        {
          name: 'Contato',
          slug: 'contato',
          url: `${websiteUrl}/contato`,
          cleanText: `Formulário de atendimento, WhatsApp, localização e telefones de ${businessName}.`,
          excerpt: `Canais de atendimento direto e localização...`,
          isHomepage: false
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
    isHomepage?: boolean;
    enabled?: boolean;
  }>,
  sharedComponents: {
    repeatNavbar: boolean;
    repeatFooter: boolean;
  },
  customApiKey?: string,
  registeredModels?: string[],
  customProxyUrl?: string,
  onProgress?: (status: string, attempt: number, total: number) => void,
  customSkills?: any[]
) {
  try {
    const activePages = pages.filter(p => p.enabled !== false);
    if (activePages.length === 0) throw new Error('Nenhuma página selecionada para geração.');

    let homePage = activePages.find(p => p.isHomepage || p.slug === 'index') || activePages[0];
    const subPages = activePages.filter(p => p !== homePage);

    // Mapeamento dos Links Universais de Navegação
    const allNavigationRoutes = [
      { name: homePage.name || 'Home', href: 'index.html' },
      ...subPages.map(p => ({ name: p.name, href: `${p.slug}.html` }))
    ];
    const navigationLinksText = allNavigationRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

    // 1. GERAR A HOME E CRIAR OS COMPONENTES UNIVERSAIS (Navbar e Footer)
    if (onProgress) onProgress(`IA criando arquitetura da Home e Design System Universal...`, 1, subPages.length + 1);

    const homeAiPrompt = `
      Você é o Arquiteto Frontend Líder e Designer Master do Visual Builder.
      Estamos remasterizando o site da empresa "${projectName}".

      DIRETRIZ VISUAL GLOBAL (APLICA-SE A TODO O SITE):
      """
      ${globalPrompt || 'Design de altíssimo luxo, moderna paleta, tipografia impecável, foco em conversão e interações fluidas.'}
      """

      PROMPT ESPECÍFICO DA HOME:
      """
      ${homePage.customPrompt || 'Hero Section impactante com CTA duplo, estatísticas, seção de serviços em destaque, depoimentos e formulário.'}
      """

      CONTEÚDO EXTRAÍDO DO SITE ORIGINAL:
      """
      ${homePage.cleanText || `Empresa ${projectName}: soluções completas e autoridade.`}
      """

      MAPA DE NAVEGAÇÃO OBRIGATÓRIO PARA A NAVBAR (LINKS PARA TODAS AS PÁGINAS DO SITE):
      ${navigationLinksText}

      REGRAS CRÍTICAS DE COMPONENTES REUTILIZÁVEIS:
      1. Crie uma <header class="sticky top-0 z-50 ..."> com uma NAVBAR rica, responsiva, com a logo "${projectName}" e os links acima.
      2. Crie um <footer class="border-t ..."> elegante no final da página com os mesmos links de navegação e copyright.
      3. SEPARAÇÃO ESTRITA: Retorne HTML sem <style> nem <script>. Todo CSS no campo "css" e JS no campo "js".
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
    
    // Extrai os blocos de Navbar e Footer gerados na Home
    const { navbarHtml, footerHtml } = extractNavbarAndFooter(homeHtml);

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

            PROMPT ESPECÍFICO DESTA SUBPÁGINA ("${sub.name}"):
            """
            ${sub.customPrompt || `Apresente detalhadamente as informações, benefícios e recursos de ${sub.name}.`}
            """

            CONTEÚDO EXTRAÍDO DA SUBPÁGINA ORIGINAL:
            """
            ${sub.cleanText || `Conteúdo institucional e serviços de ${sub.name}.`}
            """

            ${sharedComponents.repeatNavbar ? `
            NAVBAR UNIVERSAL PRONTA DA HOME (INCORPORE EXATAMENTE ESTE BLOCO NO TOPO, APENAS MARCANDO A PÁGINA "${sub.name}" COMO ATIVA):
            """
            ${navbarHtml || `<header class="p-4 border-b border-slate-800 flex justify-between items-center"><div class="font-bold">${projectName}</div><nav>${navigationLinksText}</nav></header>`}
            """` : ''}

            ${sharedComponents.repeatFooter ? `
            FOOTER UNIVERSAL PRONTO DA HOME (INCORPORE EXATAMENTE ESTE BLOCO NA BASE):
            """
            ${footerHtml || `<footer class="p-8 border-t border-slate-800 text-center text-slate-400">© ${projectName}</footer>`}
            """` : ''}

            REGRAS MANDATÓRIAS:
            1. CONSISTÊNCIA DE TEMA: Mantenha a mesma paleta de cores, tipografia, bordas e cards da Home.
            2. ENCAIXE DE COMPONENTES: Não recrie nem altere o visual da Navbar/Footer compartilhados, apenas utilize-os no topo e base da página.
            3. SEPARAÇÃO TOTAL: Retorne APENAS HTML limpo no campo "html" (sem tags <style> nem <script>).
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

            const existingSub = await prisma.page.findFirst({
              where: { projectId, slug: sub.slug }
            });

            if (existingSub) {
              await prisma.page.update({
                where: { id: existingSub.id },
                data: {
                  name: sub.name,
                  html: subAiResponse.html || existingSub.html,
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
                  html: subAiResponse.html || '<div>Subpágina</div>',
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
  customSkills?: any[]
) {
  try {
    if (onProgress) onProgress(`Analisando estrutura e páginas do site (${websiteUrl})...`, 1, 4);

    const scrapedPages = await crawlEntireClientWebsite(websiteUrl, 6, customProxyUrl);
    
    let homeText = '';
    let targetPagesList: Array<{ name: string; slug: string; customPrompt?: string; cleanText?: string }> = [];

    if (scrapedPages.length > 1) {
      const homeScraped = scrapedPages.find(p => p.slug === 'index') || scrapedPages[0];
      homeText = homeScraped.cleanText;
      
      const otherScraped = scrapedPages.filter(p => p !== homeScraped);
      for (const sub of otherScraped) {
        targetPagesList.push({
          name: sub.name,
          slug: sub.slug,
          customPrompt: `Subpágina original: ${sub.url}`,
          cleanText: sub.cleanText
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

    await processCustomRemasterGenerationJob(
      projectId,
      businessName,
      `Site moderno, responsivo e elegante para a empresa ${businessName}`,
      [
        { name: 'Home', slug: 'index', isHomepage: true, cleanText: homeText },
        ...targetPagesList
      ],
      { repeatNavbar: true, repeatFooter: true },
      customApiKey,
      registeredModels,
      customProxyUrl,
      onProgress,
      customSkills
    );
  } catch (err: any) {
    console.error("Erro no processWebsiteRemasterJob:", err);
    throw err;
  }
}
