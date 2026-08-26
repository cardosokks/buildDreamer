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
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = exports.aiChatJobsQueue = void 0;
const express_1 = require("express");
const gemini_1 = require("../services/gemini");
const siteRemaster_1 = require("../services/siteRemaster");
const projects_1 = require("./projects");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// Helper: decodifica headers que chegam em Base64 do frontend
// O frontend envia: btoa(unescape(encodeURIComponent(value))) para evitar
// o erro ISO-8859-1 em headers HTTP com caracteres pt-BR (acentos etc)
const decodeHeader = (val) => {
    if (!val)
        return '';
    const str = Array.isArray(val) ? val[0] : val;
    if (!str)
        return '';
    try {
        return decodeURIComponent(escape(Buffer.from(str, 'base64').toString('binary')));
    }
    catch {
        return str; // fallback para valor plain-text (compatibilidade)
    }
};
// In-memory queue system for AI chat modifications
exports.aiChatJobsQueue = {};
// Background worker for chat edits (suporta single-page, páginas selecionadas ou todas as páginas)
async function processAIChatJob(jobId, prompt, pageId, applyToAll, clientGeminiKey, model, registeredModels, clientProxyUrl, customSkills, targetPageIds, attachedFiles) {
    try {
        const page = await db_1.prisma.page.findUnique({
            where: { id: pageId },
            include: { project: { include: { pages: true } } }
        });
        if (!page)
            throw new Error('Página não encontrada');
        const projectPages = page.project?.pages || [page];
        // Determina o subconjunto de páginas a serem processadas
        let pagesToProcess = [];
        if (targetPageIds && Array.isArray(targetPageIds) && targetPageIds.length > 0) {
            pagesToProcess = projectPages.filter(p => targetPageIds.includes(p.id));
            if (pagesToProcess.length === 0)
                pagesToProcess = [page];
        }
        else if (applyToAll && projectPages.length > 1) {
            pagesToProcess = projectPages;
        }
        else {
            pagesToProcess = [page];
        }
        const isMultiPage = pagesToProcess.length > 1;
        exports.aiChatJobsQueue[jobId] = {
            status: 'processing',
            currentModel: isMultiPage
                ? `${model || 'gemini-2.5-flash'} (Processando ${pagesToProcess.length} páginas selecionadas em paralelo...)`
                : model || 'gemini-2.5-flash',
            scope: isMultiPage ? 'all' : 'single',
            pageId,
            projectId: page.projectId
        };
        // Detecção inteligente de comandos de elementos compartilhados (Navbar, Header, Footer)
        const isNavbarStandardization = /navbar|header|menu superior|cabe[çc]alho/i.test(prompt) && /(padr[ãa]o|igual|todas|mesm[oa]|sincroniz)/i.test(prompt);
        const isFooterStandardization = /footer|rodap[ée]|menu inferior/i.test(prompt) && /(padr[ãa]o|igual|todas|mesm[oa]|sincroniz)/i.test(prompt);
        if (isMultiPage) {
            const allRoutes = projectPages.map(p => ({
                name: p.name,
                slug: p.slug,
                href: p.isHomepage ? 'index.html' : `${p.slug}.html`
            }));
            const routesGuide = allRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');
            const updatedPages = [];
            for (const p of pagesToProcess) {
                let specificDirective = '';
                if (isNavbarStandardization) {
                    specificDirective = `
              DIRETRIZ CRÍTICA DE NAVBAR / HEADER PADRONIZADA:
              - A Navbar (<header> ou <nav>) da página principal/atual "${page.name}" deve ser a referência visual absoluta e replicada identicamente nesta página.
              - Garanta que todos os links do menu apontem para as rotas corretas listadas no MAPA DE NAVEGAÇÃO.
              - Mantenha a mesma estrutura de logo, botões CTA, fontes e cores da Navbar em todas as páginas selecionadas.
            `;
                }
                else if (isFooterStandardization) {
                    specificDirective = `
              DIRETRIZ CRÍTICA DE FOOTER / RODAPÉ PADRONIZADO:
              - O rodapé (<footer>) deve ser padronizado de forma idêntica e coerente com a identidade visual do site.
            `;
                }
                const pagePrompt = `
            Estamos aplicando alterações nas páginas selecionadas do site do projeto "${page.project?.name}".
            Página atual a ser modificada: "${p.name}" (slug: /${p.slug}, arquivo: ${p.isHomepage ? 'index.html' : p.slug + '.html'})
            Página de origem da solicitação: "${page.name}"
            
            MAPA DE NAVEGAÇÃO UNIVERSAL DO PROJETO (Use para links internos da Navbar e Footer):
            ${routesGuide}

            Instrução do usuário: "${prompt}"

            ${specificDirective}

            REGRAS OBRIGATÓRIAS:
            1. Mantenha o MESMO tema visual, fontes, cores e estética da marca.
            2. Separação Estrita: Retorne APENAS HTML limpo no campo "html" (sem tags <style> nem <script>). Todo CSS adicional no campo "css" e JS funcional no campo "js".
          `;
                const aiResponse = await (0, gemini_1.generateAIResponse)(pagePrompt, {
                    html: p.html,
                    css: p.css,
                    js: p.js
                }, clientGeminiKey, model, registeredModels, undefined, clientProxyUrl, customSkills, attachedFiles);
                await db_1.prisma.page.update({
                    where: { id: p.id },
                    data: {
                        html: aiResponse.html || p.html,
                        css: aiResponse.css || p.css,
                        js: aiResponse.js || p.js
                    }
                });
                updatedPages.push({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    html: aiResponse.html || p.html,
                    css: aiResponse.css || p.css,
                    js: aiResponse.js || p.js
                });
            }
            // Localiza o resultado correspondente à página atualmente aberta no editor
            const currentActiveUpdated = updatedPages.find(p => p.id === pageId) || updatedPages[0];
            exports.aiChatJobsQueue[jobId] = {
                status: 'completed',
                scope: 'all',
                pageId,
                projectId: page.projectId,
                result: {
                    explanation: `Alteração e padronização aplicadas com sucesso em ${updatedPages.length} páginas selecionadas (${updatedPages.map(p => p.name).join(', ')}).`,
                    html: currentActiveUpdated?.html,
                    css: currentActiveUpdated?.css,
                    js: currentActiveUpdated?.js,
                    updatedPages
                },
                currentModel: model
            };
        }
        else {
            // Processamento em página única
            const singlePrompt = `
        Página atual: "${page.name}" (slug: /${page.slug}, arquivo: ${page.isHomepage ? 'index.html' : page.slug + '.html'})
        Instrução de alteração do usuário: "${prompt}"
      `;
            const aiResponse = await (0, gemini_1.generateAIResponse)(singlePrompt, {
                html: page.html,
                css: page.css,
                js: page.js
            }, clientGeminiKey, model, registeredModels, (currentModel) => {
                exports.aiChatJobsQueue[jobId] = {
                    status: 'processing',
                    currentModel,
                    scope: 'single',
                    pageId,
                    projectId: page.projectId
                };
            }, clientProxyUrl, customSkills, attachedFiles);
            // Persiste automaticamente a alteração no banco
            await db_1.prisma.page.update({
                where: { id: page.id },
                data: {
                    html: aiResponse.html || page.html,
                    css: aiResponse.css || page.css,
                    js: aiResponse.js || page.js
                }
            });
            exports.aiChatJobsQueue[jobId] = {
                status: 'completed',
                scope: 'single',
                pageId,
                projectId: page.projectId,
                result: aiResponse,
                currentModel: aiResponse._usedModel || model
            };
        }
    }
    catch (error) {
        console.error(`Erro ao processar job de IA ${jobId}:`, error);
        exports.aiChatJobsQueue[jobId] = {
            status: 'failed',
            pageId,
            error: error.message || 'Erro ao processar alterações da IA'
        };
    }
}
// Endpoint para disparar alteração via Chat AI em background
router.post('/chat', async (req, res) => {
    try {
        const { prompt, pageId, model, applyToAll, targetPageIds, attachedFiles } = req.body;
        if (!prompt || !pageId) {
            return res.status(400).json({ error: 'Prompt e pageId são obrigatórios' });
        }
        const page = await db_1.prisma.page.findUnique({
            where: { id: pageId },
            include: { project: { include: { members: true, pages: true } } }
        });
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        const isMember = page.project.members.some(m => m.userId === req.userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        // Detectar intenção de aplicar a múltiplas páginas via targetPageIds, prompt ou applyToAll
        const hasTargetPages = Array.isArray(targetPageIds) && targetPageIds.length > 0;
        const hasGlobalIntent = applyToAll === true ||
            (hasTargetPages && targetPageIds.length > 1) ||
            /todas as p[áa]ginas|em todo o site|globalmente|em todas|todas páginas|navbar de todas|navbar padrão/i.test(prompt);
        const clientGeminiKey = decodeHeader(req.headers['x-gemini-key']);
        const clientProxyUrl = decodeHeader(req.headers['x-proxy-url']) || process.env.AI_PROXY_URL;
        let registeredModels;
        try {
            const rawModels = decodeHeader(req.headers['x-gemini-models']);
            if (rawModels)
                registeredModels = JSON.parse(rawModels);
        }
        catch { }
        let customSkills;
        try {
            const rawSkills = decodeHeader((req.headers['x-ai-skills'] || req.headers['X-Ai-Skills'] || req.headers['X-AI-Skills']));
            if (rawSkills)
                customSkills = JSON.parse(rawSkills);
        }
        catch { }
        if (!customSkills && req.userId) {
            try {
                const userRows = await db_1.prisma.$queryRawUnsafe(`
          SELECT "customAiSkills" FROM "User" WHERE "id" = $1 LIMIT 1
        `, req.userId);
                if (userRows && userRows[0] && userRows[0].customAiSkills) {
                    let s = userRows[0].customAiSkills;
                    if (typeof s === 'string') {
                        try {
                            s = JSON.parse(s);
                        }
                        catch { }
                    }
                    if (Array.isArray(s) && s.length > 0)
                        customSkills = s;
                }
            }
            catch (dbSkillsErr) {
                console.warn('Erro ao buscar skills do usuário no banco:', dbSkillsErr);
            }
        }
        const jobId = `chat-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        exports.aiChatJobsQueue[jobId] = {
            status: 'pending',
            currentModel: model || 'gemini-2.5-flash',
            scope: hasGlobalIntent ? 'all' : 'single',
            pageId,
            projectId: page.projectId
        };
        // Disparar processamento assíncrono em background
        processAIChatJob(jobId, prompt, pageId, hasGlobalIntent, clientGeminiKey, model, registeredModels, clientProxyUrl, customSkills, targetPageIds, attachedFiles);
        return res.status(202).json({ jobId, status: 'pending', scope: hasGlobalIntent ? 'all' : 'single' });
    }
    catch (error) {
        console.error("Erro na rota /api/ai/chat:", error);
        return res.status(500).json({ error: error.message });
    }
});
// Endpoint para buscar o job ativo de uma página ou projeto
router.get('/jobs/active', (req, res) => {
    const { pageId, projectId } = req.query;
    const jobsList = Object.entries(exports.aiChatJobsQueue);
    for (const [jobId, job] of jobsList.reverse()) {
        if (job.status === 'processing' || job.status === 'pending') {
            if (pageId && job.pageId === pageId) {
                return res.json({ jobId, ...job });
            }
            if (projectId && job.projectId === projectId && job.scope === 'all') {
                return res.json({ jobId, ...job });
            }
        }
    }
    return res.json({ active: false });
});
// Poll AI Chat Job status
router.get('/jobs/:jobId/status', (req, res) => {
    const jobId = req.params.jobId;
    const job = exports.aiChatJobsQueue[jobId];
    if (!job) {
        return res.status(404).json({ error: 'Job não encontrado ou expirado' });
    }
    return res.json(job);
});
// List available models from Google Gemini API with the given API key
router.get('/models', async (req, res) => {
    try {
        const clientGeminiKey = decodeHeader(req.headers['x-gemini-key']) || process.env.GEMINI_API_KEY;
        const clientProxyUrl = decodeHeader(req.headers['x-proxy-url']) || process.env.AI_PROXY_URL;
        if (!clientGeminiKey) {
            return res.status(400).json({ error: 'Chave do Gemini não configurada' });
        }
        const fetchOptions = {};
        if (clientProxyUrl && clientProxyUrl.startsWith('http')) {
            const { ProxyAgent } = await Promise.resolve().then(() => __importStar(require('undici')));
            fetchOptions.dispatcher = new ProxyAgent(clientProxyUrl);
        }
        const resApi = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${clientGeminiKey}`, fetchOptions);
        if (!resApi.ok) {
            const errTxt = await resApi.text();
            return res.status(resApi.status).json({ error: errTxt });
        }
        const data = await resApi.json();
        const models = (data.models || [])
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m) => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', ''),
            description: m.description
        }));
        return res.json({ models });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
/**
 * Endpoint 1: Iniciar Extração Prévia de Páginas do Site Cliente (Scrape Job)
 */
router.post('/remaster/scrape', async (req, res) => {
    try {
        const { websiteUrl, businessName } = req.body;
        if (!websiteUrl) {
            return res.status(400).json({ error: 'A URL do website é obrigatória.' });
        }
        const clientProxyUrl = decodeHeader(req.headers['x-proxy-url']) || process.env.AI_PROXY_URL;
        const jobId = `scrape-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`;
        (0, siteRemaster_1.startWebsiteScrapeJob)(jobId, websiteUrl, businessName || 'Empresa', clientProxyUrl);
        return res.status(202).json({
            jobId,
            status: 'scraping',
            message: 'Extração do site iniciada em background.'
        });
    }
    catch (err) {
        console.error('Erro na rota /api/ai/remaster/scrape:', err);
        return res.status(500).json({ error: err.message });
    }
});
/**
 * Endpoint 2: Status da Extração de Páginas do Site Cliente
 */
router.get('/remaster/scrape/:jobId/status', (req, res) => {
    const jobId = req.params.jobId;
    const job = siteRemaster_1.scrapeJobsQueue[jobId];
    if (!job) {
        return res.status(404).json({ error: 'Job de extração não encontrado ou expirado.' });
    }
    return res.json(job);
});
/**
 * Endpoint 3: Geração Customizada do Site Multi-Página a partir do Plano Definido
 */
router.post('/remaster/generate', async (req, res) => {
    try {
        const { projectName, globalPrompt, pages, sharedComponents, leadId } = req.body;
        if (!projectName || !pages || !Array.isArray(pages) || pages.length === 0) {
            return res.status(400).json({ error: 'Nome do projeto e lista de páginas são obrigatórios.' });
        }
        const userId = req.userId;
        // 1. Criar o Projeto no Banco de Dados
        const project = await db_1.prisma.project.create({
            data: {
                name: projectName,
                description: globalPrompt ? `Remasterização IA: ${globalPrompt.slice(0, 120)}...` : `Site gerado com IA para ${projectName}`,
                members: {
                    create: {
                        userId,
                        role: 'OWNER'
                    }
                },
                pages: {
                    create: {
                        name: 'Home',
                        slug: 'index',
                        title: `Home | ${projectName}`,
                        isHomepage: true,
                        html: `<div class="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center">
  <h1 class="text-3xl font-bold mb-3">Reconstruindo ${projectName}...</h1>
  <p class="text-slate-400">Aguarde enquanto a IA arquiteta o Design System e gera todas as subpáginas.</p>
</div>`,
                        css: 'body { margin: 0; font-family: sans-serif; }',
                        js: ''
                    }
                }
            },
            include: {
                pages: true
            }
        });
        if (leadId) {
            try {
                await db_1.prisma.$executeRawUnsafe(`
          UPDATE "Lead" SET "projectId" = $1 WHERE "id" = $2 AND "userId" = $3
        `, project.id, leadId, userId);
            }
            catch (err) {
                console.warn('Erro ao vincular lead ao remaster:', err);
            }
        }
        const clientGeminiKey = decodeHeader(req.headers['x-gemini-key']) || process.env.GEMINI_API_KEY;
        const clientProxyUrl = decodeHeader(req.headers['x-proxy-url']) || process.env.AI_PROXY_URL;
        let registeredModels;
        try {
            const rawModels = decodeHeader(req.headers['x-gemini-models']);
            if (rawModels)
                registeredModels = JSON.parse(rawModels);
        }
        catch { }
        let customSkills;
        try {
            const rawSkills = decodeHeader((req.headers['x-ai-skills'] || req.headers['X-Ai-Skills'] || req.headers['X-AI-Skills']));
            if (rawSkills)
                customSkills = JSON.parse(rawSkills);
        }
        catch { }
        // 2. Registrar no queue de status de projetos
        projects_1.projectJobsQueue[project.id] = { status: 'pending' };
        // 3. Disparar o Worker de Geração Multi-página Customizado
        (0, siteRemaster_1.processCustomRemasterGenerationJob)(project.id, projectName, globalPrompt || 'Design moderno, luxuoso, alta conversão e responsivo.', pages, sharedComponents || { repeatNavbar: true, repeatFooter: true }, clientGeminiKey, registeredModels, clientProxyUrl, (status, attempt, total) => {
            projects_1.projectJobsQueue[project.id] = {
                status: 'processing',
                currentModel: status,
                attempt,
                total
            };
        }, customSkills).then(() => {
            projects_1.projectJobsQueue[project.id] = { status: 'completed' };
        }).catch((err) => {
            console.error(`Erro ao gerar projeto customizado ${project.id}:`, err);
            projects_1.projectJobsQueue[project.id] = { status: 'failed', error: err.message };
        });
        return res.status(201).json(project);
    }
    catch (error) {
        console.error('Erro na rota /api/ai/remaster/generate:', error);
        return res.status(500).json({ error: error.message });
    }
});
exports.aiRouter = router;
