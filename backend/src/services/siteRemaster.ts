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
 * Worker assíncrono que melhora e reconstrói o site completo com IA garantindo tema unificado, processamento concorrente e tolerância a falhas
 */
export async function processWebsiteRemasterJob(
  projectId: string,
  websiteUrl: string,
  businessName: string,
  customApiKey?: string,
  registeredModels?: string[],
  customProxyUrl?: string,
  onProgress?: (status: string, attempt: number, total: number) => void
) {
  try {
    if (onProgress) onProgress(`Analisando estrutura e páginas do site (${websiteUrl})...`, 1, 4);

    const scrapedPages = await crawlEntireClientWebsite(websiteUrl, 6, customProxyUrl);
    
    let homeText = '';
    let homeUrl = websiteUrl;
    let targetPagesList: Array<{ name: string; slug: string; description: string; cleanText?: string }> = [];

    if (scrapedPages.length > 1) {
      const homeScraped = scrapedPages.find(p => p.slug === 'index') || scrapedPages[0];
      homeText = homeScraped.cleanText;
      homeUrl = homeScraped.url;
      
      const otherScraped = scrapedPages.filter(p => p !== homeScraped);
      for (const sub of otherScraped) {
        targetPagesList.push({
          name: sub.name,
          slug: sub.slug,
          description: `Subpágina original: ${sub.url}`,
          cleanText: sub.cleanText
        });
      }
    } else {
      if (scrapedPages.length === 1) {
        homeText = scrapedPages[0].cleanText;
      } else {
        homeText = `Empresa ${businessName} (${websiteUrl}): Soluções em certificação digital, sistemas empresariais, automação comercial e canais de atendimento.`;
      }

      if (onProgress) onProgress(`Estruturando arquitetura de subpáginas do negócio...`, 1, 4);

      targetPagesList = [
        { name: "Serviços", slug: "servicos", description: "Soluções completas e produtos da empresa" },
        { name: "Sobre Nós", slug: "sobre", description: "História, autoridade e equipe" },
        { name: "Contato", slug: "contato", description: "Canais de atendimento e localização" }
      ];
    }

    const allNavigationRoutes = [
      { name: 'Home', href: '/' },
      ...targetPagesList.map(p => ({ name: p.name, href: `/${p.slug}` }))
    ];

    const navigationLinksText = allNavigationRoutes
      .map(r => `- "${r.name}" -> href="${r.href}"`)
      .join('\n');

    const existingHome = await prisma.page.findFirst({
      where: { projectId, isHomepage: true }
    });

    if (onProgress) onProgress(`Criando Home remasterizada e estabelecendo Design System...`, 2, 4);

    const homePrompt = `
      Você é o Líder de Design System e Arquiteto Frontend de Elite.
      Estamos modernizando o site completo da empresa "${businessName}".
      URL original: ${homeUrl}

      MAPA UNIVERSAL DE NAVEGAÇÃO (A NAVBAR E O FOOTER DEVEM TER ESSES LINKS):
      ${navigationLinksText}

      CONTEÚDO DO SITE ORIGINAL:
      """
      ${homeText}
      """

      DIRETRIZES:
      1. ESTILO VISUAL: Crie um design moderno, minimalista e de altíssimo padrão com Tailwind CSS, fontes limpas e cores refinadas.
      2. NAVBAR E FOOTER UNIVERSAIS: Navbar com logo "${businessName}", links para todas as páginas (${allNavigationRoutes.map(r => r.name).join(', ')}) e botão CTA de contato.
      3. SEÇÕES DA HOME: Hero impactante com CTA, Grid de Serviços, Diferenciais/Sobre e Footer completo com os links.
    `;

    const homeAiResponse = await generateAIResponse(
      homePrompt,
      { html: '', css: '', js: '' },
      customApiKey,
      undefined,
      registeredModels,
      (model, attempt, total) => {
        if (onProgress) onProgress(`IA criando Home (${model} - ${attempt}/${total})...`, 2, 4);
      },
      customProxyUrl
    );

    if (existingHome) {
      await prisma.page.update({
        where: { id: existingHome.id },
        data: {
          name: 'Home',
          html: homeAiResponse.html || existingHome.html,
          css: homeAiResponse.css || '',
          js: homeAiResponse.js || ''
        }
      });
    }

    const homeHtml = homeAiResponse.html || '';

    // 4. Gerar todas as subpáginas em PARALELO com o mesmo tema e navbar
    if (onProgress) onProgress(`Remasterizando ${targetPagesList.length} subpáginas em paralelo com tema unificado...`, 3, 4);

    await Promise.all(
      targetPagesList.map(async (sub) => {
        const subPrompt = `
          Você é o Arquiteto Frontend da empresa "${businessName}".
          Estamos gerando a subpágina "${sub.name}" (rota: /${sub.slug}).

          MAPA DE NAVEGAÇÃO:
          ${navigationLinksText}

          CONTEÚDO DESTA PÁGINA:
          """
          ${sub.cleanText || sub.description}
          """

          REFERÊNCIA VISUAL DA HOME (USE A MESMA NAVBAR, CORES E FOOTER):
          """
          ${homeHtml.slice(0, 1000)}
          """

          Retorne o HTML completo com Tailwind CSS preservando todos os dados reais.
        `;

        try {
          const subAiResponse = await generateAIResponse(
            subPrompt,
            { html: '', css: homeAiResponse.css || '', js: homeAiResponse.js || '' },
            customApiKey,
            undefined,
            registeredModels,
            undefined,
            customProxyUrl
          );

          const existingSub = await prisma.page.findFirst({
            where: { projectId, slug: sub.slug }
          });

          if (existingSub) {
            await prisma.page.update({
              where: { id: existingSub.id },
              data: {
                html: subAiResponse.html || existingSub.html,
                css: subAiResponse.css || homeAiResponse.css || '',
                js: subAiResponse.js || homeAiResponse.js || ''
              }
            });
          } else {
            await prisma.page.create({
              data: {
                name: sub.name,
                slug: sub.slug,
                title: `${sub.name} | ${businessName}`,
                isHomepage: false,
                projectId,
                html: subAiResponse.html || '<div class="p-8 text-center text-white">Conteúdo em atualização</div>',
                css: subAiResponse.css || homeAiResponse.css || '',
                js: subAiResponse.js || homeAiResponse.js || ''
              }
            });
          }
        } catch (subErr: any) {
          console.error(`Erro ao gerar subpágina ${sub.name}:`, subErr.message);
        }
      })
    );

    if (onProgress) onProgress(`Site 100% remasterizado com Navbar e Tema Unificados!`, 4, 4);
  } catch (err: any) {
    console.error("Erro no processWebsiteRemasterJob:", err);
    throw err;
  }
}
