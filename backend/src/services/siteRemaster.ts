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

    // Permitir apenas o mesmo hostname base (ou com/sem www)
    const baseHostClean = baseUrlObj.hostname.replace(/^www\./, '');
    const resolvedHostClean = resolved.hostname.replace(/^www\./, '');
    if (baseHostClean !== resolvedHostClean) return null;

    // Ignorar arquivos estáticos / mídias
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|css|js|woff2?)$/i.test(resolved.pathname)) {
      return null;
    }

    // Remover hash fragmentos e normalizar
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
    .slice(0, 5000);
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

  // Tentativa 1: undici com Proxy se configurado
  if (proxyUrl) {
    try {
      const { ProxyAgent, fetch: uFetch } = await import('undici');
      const res = await uFetch(url, {
        headers,
        dispatcher: new ProxyAgent(proxyUrl)
      });
      if (res.ok) return await res.text();
    } catch {}
  }

  // Tentativa 2: fetch nativo com timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return await res.text();
  } catch {}

  // Tentativa 3: Node http/https nativo com SSL bypass (rejectUnauthorized: false)
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
 * Raspa todas as páginas e subpáginas de um site cliente (até o limite de profundidade)
 */
export async function crawlEntireClientWebsite(
  startUrl: string, 
  maxPages: number = 8,
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

      // Extrair links de subpáginas internas
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
 * Worker assíncrono que melhora e reconstrói o site completo com IA garantindo tema unificado e navegação universal
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

    // 1. Raspar o site completo (Home + Subpáginas)
    const scrapedPages = await crawlEntireClientWebsite(websiteUrl, 8, customProxyUrl);
    
    let homeText = '';
    let homeUrl = websiteUrl;
    let targetPagesList: Array<{ name: string; slug: string; description: string; cleanText?: string }> = [];

    // Se o crawler encontrou páginas reais através do HTML:
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
      // Caso o site seja protegido por firewall (ou retornou apenas a home), a IA atua como Arquiteto de Software para inferir o Sitemap completo de subpáginas do negócio
      if (scrapedPages.length === 1) {
        homeText = scrapedPages[0].cleanText;
      } else {
        homeText = `Empresa ${businessName} (${websiteUrl}): Soluções em certificação digital, sistemas empresariais, automação comercial e canais de atendimento.`;
      }

      if (onProgress) onProgress(`Estruturando arquitetura de subpáginas do negócio...`, 1, 4);

      // Prompt para estruturar o Sitemap e as subpáginas necessárias
      const sitemapPrompt = `
        Você é um Arquiteto de Software e Estrategista Web.
        A empresa "${businessName}" possui o site "${websiteUrl}".
        Contexto do negócio: "${homeText.slice(0, 800)}".

        Defina uma estrutura completa de 4 subpáginas essenciais além da Home (ex: Serviços / Soluções, Sobre Nós, Contato, Certificados ou Preços).
        Retorne um array JSON estrito no formato:
        {
          "pages": [
            { "name": "Serviços", "slug": "servicos", "description": "Soluções completas e serviços oferecidos pela empresa" },
            { "name": "Sobre Nós", "slug": "sobre", "description": "História, autoridade e diferenciais da empresa" },
            { "name": "Certificados Digitais", "slug": "certificados", "description": "Emissão de e-CPF, e-CNPJ e certificação digital" },
            { "name": "Contato", "slug": "contato", "description": "Canais de atendimento, endereços e formulário" }
          ]
        }
      `;

      try {
        const sitemapResponse = await generateAIResponse(
          sitemapPrompt,
          { html: '', css: '', js: '' },
          customApiKey,
          undefined,
          registeredModels,
          undefined,
          customProxyUrl
        );

        let parsedPages = sitemapResponse.pages;
        if (!parsedPages && sitemapResponse.html) {
          try {
            const rawJson = JSON.parse(sitemapResponse.html);
            parsedPages = rawJson.pages;
          } catch {}
        }

        if (Array.isArray(parsedPages) && parsedPages.length > 0) {
          targetPagesList = parsedPages;
        } else {
          // Fallback padrão robusto
          targetPagesList = [
            { name: "Serviços", slug: "servicos", description: "Soluções completas e produtos da empresa" },
            { name: "Sobre Nós", slug: "sobre", description: "História, autoridade e equipe" },
            { name: "Contato", slug: "contato", description: "Canais de atendimento e localização" }
          ];
        }
      } catch {
        targetPagesList = [
          { name: "Serviços", slug: "servicos", description: "Soluções completas e produtos da empresa" },
          { name: "Sobre Nós", slug: "sobre", description: "História, autoridade e equipe" },
          { name: "Contato", slug: "contato", description: "Canais de atendimento e localização" }
        ];
      }
    }

    // Lista de todas as rotas do projeto para links universais
    const allNavigationRoutes = [
      { name: 'Home', href: '/' },
      ...targetPagesList.map(p => ({ name: p.name, href: `/${p.slug}` }))
    ];

    const navigationLinksText = allNavigationRoutes
      .map(r => `- Link: "${r.name}" -> href="${r.href}" (ou "${r.href === '/' ? 'index.html' : r.href.slice(1) + '.html'}")`)
      .join('\n');

    // 2. Buscar a página Home já criada no projeto
    const existingHome = await prisma.page.findFirst({
      where: { projectId, isHomepage: true }
    });

    if (onProgress) onProgress(`Criando Home remasterizada e estabelecendo Design System global...`, 2, 4);

    // 3. Gerar código remasterizado para a HOME com Design System
    const homePrompt = `
      Você é o Líder de Design System e Arquiteto Frontend de Elite.
      Estamos modernizando o site completo da empresa "${businessName}".
      URL original: ${homeUrl}

      MAPA UNIVERSAL DE NAVEGAÇÃO DO SITE (TODAS AS PÁGINAS DEVEM CONTER EXATAMENTE ESSES LINKS NA NAVBAR E NO FOOTER):
      ${navigationLinksText}

      CONTEÚDO DO SITE ORIGINAL:
      """
      ${homeText}
      """

      DIRETRIZES DE DESIGN SYSTEM E IDENTIDADE VISUAL:
      1. ESTILO VISUAL PADRONIZADO: Crie uma identidade visual moderna, minimalista e premium (use Tailwind CSS, fontes elegantes como Outfit para títulos e Inter para textos, fundo escuro/glassmorphism ou tema refinado de alto contraste).
      2. NAVBAR UNIVERSAL RESPONSIVA:
         - Logo com o nome "${businessName}"
         - Menu com links para TODAS as páginas: ${allNavigationRoutes.map(r => `<a href="${r.href}">${r.name}</a>`).join(' ')}
         - Botão CTA de destaque (ex: "Fale Conosco" / "Atendimento WhatsApp").
      3. SEÇÕES DA HOME:
         - Hero impactante com headline clara e CTA
         - Grid de Serviços/Soluções com cards refinados
         - Diferenciais e Prova Social
         - Seção Sobre / Autoridade
         - Footer completo contendo os mesmos links de navegação.
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

    // Extrai um trecho representativo do Header e do Footer gerados na Home para servir de template universal para as subpáginas
    const homeHtml = homeAiResponse.html || '';

    // 4. Gerar todas as subpáginas identificadas aplicando estritamente o MESMO TEMA, NAVBAR e FOOTER da Home
    for (let i = 0; i < targetPagesList.length; i++) {
      const sub = targetPagesList[i];
      if (onProgress) onProgress(`Remasterizando ${sub.name} com Navbar e Tema Unificados (${i + 1}/${targetPagesList.length})...`, 3, 4);

      const subPrompt = `
        Você é o Arquiteto Frontend responsável por manter a consistência de 100% do Design System da empresa "${businessName}".
        Estamos gerando a subpágina "${sub.name}" (rota: /${sub.slug}).

        MAPA UNIVERSAL DE NAVEGAÇÃO (A NAVBAR E O FOOTER DEVEM TER ESSES LINKS):
        ${navigationLinksText}

        CONTEÚDO ORIGINAL ESPECÍFICO DESTA PÁGINA "${sub.name}":
        """
        ${sub.cleanText || sub.description}
        """

        REFERÊNCIA VISUAL DA HOME (COPIE O MESMO HEADER / NAVBAR, MESMAS CORES, MESMA TIPOGRAFIA E MESMO FOOTER):
        """
        ${homeHtml.slice(0, 1500)}
        """

        REGRAS MANDATÓRIAS:
        1. MESMO TEMA E NAVBAR: Utilize EXATAMENTE a mesma estrutura de Navbar e Footer da Home, destacando a página atual ("${sub.name}") como ativa.
        2. NAVEGAÇÃO FUNCIONAL BI-DIRECIONAL: O botão da Home deve levar para href="/" e os demais links para suas respectivas rotas (${allNavigationRoutes.map(r => `${r.name}: ${r.href}`).join(', ')}).
        3. PRESERVAÇÃO INTEGRAL DE DADOS: Mantenha todos os serviços, detalhes técnicos, tabelas, perguntas ou formulários reais desta subpágina.
        4. Retorne SEMPRE o objeto JSON com o código HTML completo da página "${sub.name}".
      `;

      try {
        const subAiResponse = await generateAIResponse(
          subPrompt,
          { html: '', css: homeAiResponse.css || '', js: homeAiResponse.js || '' },
          customApiKey,
          undefined,
          registeredModels,
          (model, attempt, total) => {
            if (onProgress) onProgress(`IA criando ${sub.name} (${model} - ${attempt}/${total})...`, 3, 4);
          },
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
              html: subAiResponse.html,
              css: subAiResponse.css || homeAiResponse.css || '',
              js: subAiResponse.js || homeAiResponse.js || ''
            }
          });
        }
      } catch (subErr) {
        console.error(`Erro ao gerar subpágina ${sub.name}:`, subErr);
      }
    }

    if (onProgress) onProgress(`Site 100% remasterizado com Navbar e Tema Unificados!`, 4, 4);
  } catch (err: any) {
    console.error("Erro no processWebsiteRemasterJob:", err);
    throw err;
  }
}
