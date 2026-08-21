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
const db_1 = require("../db");
const router = (0, express_1.Router)();
// In-memory queue system for AI chat modifications
exports.aiChatJobsQueue = {};
// Background worker for chat edits (suporta single-page ou todas as páginas)
async function processAIChatJob(jobId, prompt, pageId, applyToAll, clientGeminiKey, model, registeredModels, clientProxyUrl) {
    exports.aiChatJobsQueue[jobId] = {
        status: 'processing',
        currentModel: model || 'gemini-2.5-flash',
        scope: applyToAll ? 'all' : 'single'
    };
    try {
        const page = await db_1.prisma.page.findUnique({
            where: { id: pageId },
            include: { project: { include: { pages: true } } }
        });
        if (!page)
            throw new Error('Página não encontrada');
        // Se applyToAll for true, processa todas as páginas em PARALELO para máxima velocidade
        if (applyToAll && page.project?.pages && page.project.pages.length > 1) {
            const allPages = page.project.pages;
            exports.aiChatJobsQueue[jobId] = {
                status: 'processing',
                currentModel: `${model || 'gemini-2.5-flash'} (Processando ${allPages.length} páginas em paralelo...)`,
                scope: 'all'
            };
            const updatedPages = await Promise.all(allPages.map(async (p) => {
                const pagePrompt = `
            Estamos aplicando uma alteração global em todas as páginas do site.
            Página atual: "${p.name}" (slug: /${p.slug})
            Instrução do usuário: "${prompt}"
          `;
                const aiResponse = await (0, gemini_1.generateAIResponse)(pagePrompt, {
                    html: p.html,
                    css: p.css,
                    js: p.js
                }, clientGeminiKey, model, registeredModels, undefined, clientProxyUrl);
                await db_1.prisma.page.update({
                    where: { id: p.id },
                    data: {
                        html: aiResponse.html || p.html,
                        css: aiResponse.css || p.css,
                        js: aiResponse.js || p.js
                    }
                });
                return {
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    html: aiResponse.html || p.html,
                    css: aiResponse.css || p.css,
                    js: aiResponse.js || p.js
                };
            }));
            const activeUpdated = updatedPages.find(p => p.id === pageId) || updatedPages[0];
            exports.aiChatJobsQueue[jobId] = {
                status: 'completed',
                scope: 'all',
                result: {
                    explanation: `Alteração aplicada em paralelo em todas as ${updatedPages.length} páginas do site!`,
                    html: activeUpdated.html,
                    css: activeUpdated.css,
                    js: activeUpdated.js,
                    updatedPages
                }
            };
        }
        else {
            // Alteração na página individual ativa
            const aiResponse = await (0, gemini_1.generateAIResponse)(prompt, {
                html: page.html,
                css: page.css,
                js: page.js
            }, clientGeminiKey, model, registeredModels, (currentModel) => {
                exports.aiChatJobsQueue[jobId] = {
                    status: 'processing',
                    currentModel,
                    scope: 'single'
                };
            }, clientProxyUrl);
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
                result: aiResponse,
                currentModel: aiResponse._usedModel || model
            };
        }
    }
    catch (error) {
        console.error(`Erro ao processar job de IA ${jobId}:`, error);
        exports.aiChatJobsQueue[jobId] = {
            status: 'failed',
            error: error.message || 'Erro ao processar alterações da IA'
        };
    }
}
// Process AI request and start background job
router.post('/chat', async (req, res) => {
    try {
        const { prompt, pageId, model, applyToAll } = req.body;
        if (!prompt || !pageId) {
            return res.status(400).json({ error: 'Prompt and pageId are required' });
        }
        const page = await db_1.prisma.page.findUnique({
            where: { id: pageId },
            include: { project: { include: { members: true } } }
        });
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }
        const isMember = page.project.members.some(m => m.userId === req.userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        // Detectar intenção de aplicar a todas as páginas via prompt ou checkbox
        const hasGlobalIntent = applyToAll === true ||
            /todas as p[áa]ginas|em todo o site|globalmente|em todas|todas páginas|navbar de todas/i.test(prompt);
        const clientGeminiKey = (req.headers['x-gemini-key'] || req.headers['X-Gemini-Key']);
        const clientProxyUrl = (req.headers['x-proxy-url'] || req.headers['X-Proxy-Url']) || process.env.AI_PROXY_URL;
        let registeredModels;
        try {
            const rawModels = (req.headers['x-gemini-models'] || req.headers['X-Gemini-Models']);
            if (rawModels)
                registeredModels = JSON.parse(rawModels);
        }
        catch { }
        const jobId = `chat-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        exports.aiChatJobsQueue[jobId] = {
            status: 'pending',
            currentModel: model || 'gemini-2.5-flash',
            scope: hasGlobalIntent ? 'all' : 'single'
        };
        // Disparar processamento assíncrono em background
        processAIChatJob(jobId, prompt, pageId, hasGlobalIntent, clientGeminiKey, model, registeredModels, clientProxyUrl);
        return res.status(202).json({ jobId, status: 'pending', scope: hasGlobalIntent ? 'all' : 'single' });
    }
    catch (error) {
        console.error("Erro na rota /api/ai/chat:", error);
        return res.status(500).json({ error: error.message });
    }
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
        const clientGeminiKey = (req.headers['x-gemini-key'] || req.headers['X-Gemini-Key'] || process.env.GEMINI_API_KEY);
        const clientProxyUrl = (req.headers['x-proxy-url'] || req.headers['X-Proxy-Url']) || process.env.AI_PROXY_URL;
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
exports.aiRouter = router;
