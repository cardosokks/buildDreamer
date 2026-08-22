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
function extractNavbarAndFooter(homeHtml: string): { navbarHtml: string; footerHtml: string } {
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

/**
 * Worker assíncrono que melhora e reconstrói o site completo com IA
 * Garante:
 * 1. Design System e Paleta de Cores Estritamente Compartilhados
 * 2. Navbar e Footer Universais IDÊNTICOS em todas as páginas
 * 3. Separação Absoluta de HTML, CSS e JS
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
      { name: 'Home', href: 'index.html' },
      ...targetPagesList.map(p => ({ name: p.name, href: `${p.slug}.html` }))
    ];

    const navigationLinksText = allNavigationRoutes
      .map(r => `- Link: "${r.name}" -> href="${r.href}"`)
      .join('\n');

    const existingHome = await prisma.page.findFirst({
      where: { projectId, isHomepage: true }
    });

    if (onProgress) onProgress(`Criando Home remasterizada e estabelecendo Design System & Navbar Universal...`, 2, 4);

    // 1. GERAÇÃO DA HOME (Define o Design System, a Navbar Universal e o Footer)
    const homePrompt = `
      Você é o Líder de Design System e Arquiteto Frontend de Elite.
      Estamos modernizando o site completo da empresa "${businessName}".
      URL original: ${homeUrl}

      MAPA UNIVERSAL DE NAVEGAÇÃO DO SITE (A NAVBAR E O FOOTER DEVEM CONTER ESSES LINKS):
      ${navigationLinksText}

      CONTEÚDO DO SITE ORIGINAL:
      """
      ${homeText}
      """

      DIRETRIZES DE DESIGN SYSTEM E ARQUITETURA:
      1. ESTILO VISUAL: Crie um design minimalista, luxuoso e de altíssimo padrão com Tailwind CSS (dark mode elegante ou tema refinado de alto contraste, tipografia Inter/Outfit).
      2. NAVBAR UNIVERSAL RESPONSIVA:
         - Logo com o nome "${businessName}"
         - Menu com links para TODAS as páginas: ${allNavigationRoutes.map(r => `<a href="${r.href}">${r.name}</a>`).join(' ')}
         - Botão CTA de destaque (ex: "Fale Conosco" / "Atendimento WhatsApp").
      3. SEÇÕES DA HOME: Hero impactante com headline clara e CTA, Grid de Serviços/Soluções, Prova Social / Diferenciais e Footer completo com todos os links.
      4. SEPARAÇÃO RIGOROSA: Retorne APENAS HTML no campo "html" (sem tags <style> nem <script>), CSS customizado no campo "css" e JavaScript no campo "js".
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
      customProxyUrl,
      customSkills
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
    const globalCss = homeAiResponse.css || '';
    const globalJs = homeAiResponse.js || '';
    const { navbarHtml, footerHtml } = extractNavbarAndFooter(homeHtml);

    // 2. GERAÇÃO DAS SUBPÁGINAS (Com Navbar, Tema e Design System IDÊNTICOS da Home)
    if (onProgress) onProgress(`Remasterizando ${targetPagesList.length} subpáginas com Tema e Navbar Universal compartilhados...`, 3, 4);

    await Promise.all(
      targetPagesList.map(async (sub) => {
        const subPrompt = `
          Você é o Arquiteto Frontend responsável por manter 100% de consistência com o Design System da empresa "${businessName}".
          Estamos gerando a subpágina "${sub.name}" (arquivo: ${sub.slug}.html).

          MAPA DE NAVEGAÇÃO UNIVERSAL:
          ${navigationLinksText}

          CONTEÚDO ESPECÍFICO DESTA PÁGINA "${sub.name}":
          """
          ${sub.cleanText || sub.description}
          """

          NAVBAR UNIVERSAL OBRIGATÓRIA DA HOME (MANTENHA A MESMA ESTRUTURA VISUAL E LINKS):
          """
          ${navbarHtml || '<header class="p-4 border-b border-slate-800 flex justify-between items-center"><div class="font-bold">' + businessName + '</div><nav>' + navigationLinksText + '</nav></header>'}
          """

          FOOTER UNIVERSAL OBRIGATÓRIO DA HOME:
          """
          ${footerHtml || '<footer class="p-8 border-t border-slate-800 text-center text-slate-400">© ' + businessName + '</footer>'}
          """

          REGRAS MANDATÓRIAS:
          1. CONSISTÊNCIA DE TEMA: Use rigorosamente a mesma paleta de cores, tipografia, espaçamentos e cards da Home.
          2. NAVBAR & FOOTER IDÊNTICOS: Insira a mesma Navbar no topo (com o link da página atual ativo) e o mesmo Footer no final.
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
                html: subAiResponse.html || existingSub.html,
                css: subAiResponse.css || globalCss,
                js: subAiResponse.js || globalJs
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
                css: subAiResponse.css || globalCss,
                js: subAiResponse.js || globalJs
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
