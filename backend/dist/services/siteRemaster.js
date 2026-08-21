"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlEntireClientWebsite = crawlEntireClientWebsite;
exports.processWebsiteRemasterJob = processWebsiteRemasterJob;
const db_1 = require("../db");
const gemini_1 = require("../services/gemini");
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
/**
 * Normaliza e resolve URLs internas de um site
 */
function resolveInternalUrl(base, relative) {
    try {
        const baseUrlObj = new URL(base);
        const resolved = new URL(relative, base);
        // Permitir apenas o mesmo hostname
        if (resolved.hostname !== baseUrlObj.hostname)
            return null;
        // Ignorar arquivos estáticos / mídias
        if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|css|js|woff2?)$/i.test(resolved.pathname)) {
            return null;
        }
        // Remover hash fragmentos e normalizar
        resolved.hash = '';
        return resolved.href;
    }
    catch {
        return null;
    }
}
function cleanHtmlToText(html) {
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
async function resilientFetchPage(url, proxyUrl) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    };
    // Tentativa 1: undici com Proxy se configurado
    if (proxyUrl) {
        try {
            const { ProxyAgent, fetch: uFetch } = await Promise.resolve().then(() => __importStar(require('undici')));
            const res = await uFetch(url, {
                headers,
                dispatcher: new ProxyAgent(proxyUrl)
            });
            if (res.ok)
                return await res.text();
        }
        catch { }
    }
    // Tentativa 2: fetch nativo com timeout
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok)
            return await res.text();
    }
    catch { }
    // Tentativa 3: Node http/https nativo com SSL bypass (rejectUnauthorized: false)
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https');
        const client = isHttps ? https_1.default : http_1.default;
        const req = client.get(url, {
            headers,
            rejectUnauthorized: false,
            timeout: 8000
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
async function crawlEntireClientWebsite(startUrl, maxPages = 6, proxyUrl) {
    let normalizedStart = startUrl.trim();
    if (!normalizedStart.startsWith('http')) {
        normalizedStart = `https://${normalizedStart}`;
    }
    const visited = new Set();
    const queue = [normalizedStart];
    const pages = [];
    while (queue.length > 0 && pages.length < maxPages) {
        const currentUrl = queue.shift();
        if (visited.has(currentUrl))
            continue;
        visited.add(currentUrl);
        try {
            let html = '';
            try {
                html = await resilientFetchPage(currentUrl, proxyUrl);
            }
            catch {
                // Fallback: se falhar em https, tenta http
                if (currentUrl.startsWith('https://')) {
                    const fallbackHttp = currentUrl.replace('https://', 'http://');
                    html = await resilientFetchPage(fallbackHttp, proxyUrl);
                }
            }
            if (!html || html.length < 50)
                continue;
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
            const linkMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)];
            for (const m of linkMatches) {
                const resolved = resolveInternalUrl(currentUrl, m[1]);
                if (resolved && !visited.has(resolved) && !queue.includes(resolved)) {
                    queue.push(resolved);
                }
            }
        }
        catch (err) {
            console.warn(`[Site Recreator Crawler] Erro ao raspar ${currentUrl}:`, err.message);
        }
    }
    return pages;
}
/**
 * Worker assíncrono que melhora e reconstrói o site completo com IA criando cada página correspondente
 */
async function processWebsiteRemasterJob(projectId, websiteUrl, businessName, customApiKey, registeredModels, customProxyUrl, onProgress) {
    try {
        if (onProgress)
            onProgress(`Analisando estrutura e páginas do site original (${websiteUrl})...`, 1, 4);
        // 1. Raspar o site completo (Home + Subpáginas)
        const scrapedPages = await crawlEntireClientWebsite(websiteUrl, 6, customProxyUrl);
        // Se o crawler não conseguir acessar diretamente (ex: firewall do cliente ou site offline), fazemos um fallback inteligente com o nome da empresa e URL
        let homeText = '';
        let homeUrl = websiteUrl;
        let otherScraped = [];
        if (scrapedPages.length > 0) {
            const homeScraped = scrapedPages.find(p => p.slug === 'index') || scrapedPages[0];
            homeText = homeScraped.cleanText;
            homeUrl = homeScraped.url;
            otherScraped = scrapedPages.filter(p => p !== homeScraped);
        }
        else {
            homeText = `Website da empresa ${businessName}: ${websiteUrl}. Empresa brasileira atuante em seu nicho de mercado.`;
        }
        // 2. Buscar a página Home já criada no projeto
        const existingHome = await db_1.prisma.page.findFirst({
            where: { projectId, isHomepage: true }
        });
        if (onProgress)
            onProgress(`Construindo versão remasterizada com IA...`, 2, 4);
        // 3. Gerar código remasterizado para a HOME
        const homePrompt = `
      Você é um Arquiteto de Software e UI/UX Designer de Elite.
      Estamos modernizando e remasterizando o site da empresa "${businessName}".
      URL do site: ${homeUrl}
      CONTEÚDO E ESTRUTURA DO SITE ORIGINAL:
      """
      ${homeText}
      """

      SUA MISSÃO:
      Crie uma versão 10x mais moderna, elegante, minimalista e de altíssima conversão para esta empresa.
      - Crie uma estrutura completa com: Navbar moderna responsiva, Hero Section impactante com CTA claro, Seção de Serviços/Soluções em cards com ícones, Seção de Diferenciais/Sobre Nós, Depoimentos/Confiança, Seção de Contato/WhatsApp e Rodapé completo.
      - Utilize Tailwind CSS moderno, gradientes sutis, botões com efeito hover e tipografia limpa.
      - Preserve e valorize as informações e o propósito da empresa.
    `;
        const homeAiResponse = await (0, gemini_1.generateAIResponse)(homePrompt, { html: '', css: '', js: '' }, customApiKey, undefined, registeredModels, (model, attempt, total) => {
            if (onProgress)
                onProgress(`IA criando Home (${model} - ${attempt}/${total})...`, 2, 4);
        }, customProxyUrl);
        if (existingHome) {
            await db_1.prisma.page.update({
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
            if (onProgress)
                onProgress(`Criando subpágina remasterizada: ${sub.name} (${i + 1}/${otherScraped.length})...`, 3, 4);
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
                const subAiResponse = await (0, gemini_1.generateAIResponse)(subPrompt, { html: '', css: '', js: '' }, customApiKey, undefined, registeredModels, (model, attempt, total) => {
                    if (onProgress)
                        onProgress(`IA criando ${sub.name} (${model} - ${attempt}/${total})...`, 3, 4);
                }, customProxyUrl);
                await db_1.prisma.page.create({
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
            }
            catch (subErr) {
                console.error(`Erro ao gerar subpágina ${sub.name}:`, subErr);
            }
        }
        if (onProgress)
            onProgress(`Site 100% remasterizado com todas as páginas!`, 4, 4);
    }
    catch (err) {
        console.error("Erro no processWebsiteRemasterJob:", err);
        throw err;
    }
}
