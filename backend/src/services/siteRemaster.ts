import { prisma } from '../db';
import { generateAIResponse } from '../services/gemini';

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

    // Permitir apenas o mesmo hostname
    if (resolved.hostname !== baseUrlObj.hostname) return null;

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
    .slice(0, 4000); // Primeiros 4000 caracteres essenciais de conteúdo
}

/**
 * Raspa todas as páginas e subpáginas de um site cliente (até o limite de profundidade)
 */
export async function crawlEntireClientWebsite(
  startUrl: string, 
  maxPages: number = 6,
  proxyUrl?: string
): Promise<ScrapedPage[]> {
  const normalizedStart = startUrl.startsWith('http') ? startUrl : `https://${startUrl}`;
  const visited = new Set<string>();
  const queue: string[] = [normalizedStart];
  const pages: ScrapedPage[] = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
  };

  while (queue.length > 0 && pages.length < maxPages) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      let res: any;
      if (proxyUrl) {
        const { ProxyAgent, fetch: uFetch } = await import('undici');
        res = await uFetch(currentUrl, {
          headers,
          dispatcher: new ProxyAgent(proxyUrl)
        });
      } else {
        res = await fetch(currentUrl, { headers });
      }

      if (!res.ok) continue;

      const html = await res.text();
      const cleanText = cleanHtmlToText(html);

      const urlObj = new URL(currentUrl);
      let pathname = urlObj.pathname.replace(/\/$/, '');
      let slug = pathname.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'index';
      
      // Nome amigável da página
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
      const linkMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)];
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
 * Worker assíncrono que melhora e reconstrói o site completo com IA criando cada página correspondente
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
    if (onProgress) onProgress(`Analisando estrutura e páginas do site original (${websiteUrl})...`, 1, 4);

    // 1. Raspar o site completo (Home + Subpáginas)
    const scrapedPages = await crawlEntireClientWebsite(websiteUrl, 6, customProxyUrl);
    if (scrapedPages.length === 0) {
      throw new Error(`Não foi possível acessar as páginas do site ${websiteUrl}. Verifique se o endereço está acessível.`);
    }

    const homeScraped = scrapedPages.find(p => p.slug === 'index') || scrapedPages[0];
    const otherScraped = scrapedPages.filter(p => p !== homeScraped);

    // 2. Buscar a página Home já criada no projeto
    const existingHome = await prisma.page.findFirst({
      where: { projectId, isHomepage: true }
    });

    if (onProgress) onProgress(`Redesenhando a página principal com Tailwind CSS e UI moderna...`, 2, 4);

    // 3. Gerar código remasterizado para a HOME
    const homePrompt = `
      Você é um Arquiteto de Software e UI/UX Designer de Elite.
      Estamos modernizando o site da empresa "${businessName}".
      URL Original: ${homeScraped.url}
      CONTEÚDO EXTRAÍDO DO SITE ORIGINAL:
      """
      ${homeScraped.cleanText}
      """

      SUA MISSÃO:
      Crie uma versão 10x mais moderna, elegante, minimalista e de altíssima conversão para esta empresa.
      - Inclua seções completas: Header responsivo com navegação, Hero Section impactante com CTA, Serviços/Produtos em cards estilizados, Prova Social/Diferenciais, Seção Sobre Nós, Contato e Rodapé.
      - Use Tailwind CSS completo, sombras elegantes, botões modernos e micro-interações.
      - Mantenha os dados reais da empresa (telefones, endereços, serviços oferecidos).
    `;

    const homeAiResponse = await generateAIResponse(
      homePrompt,
      { html: '', css: '', js: '' },
      customApiKey,
      undefined,
      registeredModels,
      undefined,
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

    // 4. Gerar as subpáginas detectadas (ex: Sobre, Serviços, Contato, etc.)
    for (let i = 0; i < otherScraped.length; i++) {
      const sub = otherScraped[i];
      if (onProgress) onProgress(`Criando subpágina remasterizada: ${sub.name} (${i + 1}/${otherScraped.length})...`, 3, 4);

      const subPrompt = `
        Você é um Arquiteto de Software e UI/UX Designer de Elite.
        Estamos modernizando a subpágina "${sub.name}" (slug: ${sub.slug}) da empresa "${businessName}".
        CONTEÚDO ORIGINAL DA SUBPÁGINA:
        """
        ${sub.cleanText}
        """

        SUA MISSÃO:
        Crie o código completo HTML + Tailwind CSS para esta subpágina "${sub.name}", mantendo a mesma identidade visual minimalista e moderna da Home.
      `;

      try {
        const subAiResponse = await generateAIResponse(
          subPrompt,
          { html: '', css: '', js: '' },
          customApiKey,
          undefined,
          registeredModels,
          undefined,
          customProxyUrl
        );

        await prisma.page.create({
          data: {
            name: sub.name,
            slug: sub.slug,
            title: `${sub.name} | ${businessName}`,
            isHomepage: false,
            projectId,
            html: subAiResponse.html,
            css: subAiResponse.css || '',
            js: subAiResponse.js || ''
          }
        });
      } catch (subErr) {
        console.error(`Erro ao gerar subpágina ${sub.name}:`, subErr);
      }
    }

    if (onProgress) onProgress(`Site 100% remasterizado com todas as subpáginas!`, 4, 4);
  } catch (err: any) {
    console.error("Erro no processWebsiteRemasterJob:", err);
    throw err;
  }
}
