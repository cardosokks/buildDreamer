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
// Background worker for chat edits
async function processAIChatJob(jobId, prompt, pageId, clientGeminiKey, model, registeredModels, clientProxyUrl) {
    exports.aiChatJobsQueue[jobId] = { status: 'processing', currentModel: model || 'gemini-2.5-flash' };
    try {
        const page = await db_1.prisma.page.findUnique({
            where: { id: pageId }
        });
        if (!page)
            throw new Error('Página não encontrada');
        const aiResponse = await (0, gemini_1.generateAIResponse)(prompt, {
            html: page.html,
            css: page.css,
            js: page.js
        }, clientGeminiKey, model, registeredModels, (currentModel) => {
            exports.aiChatJobsQueue[jobId] = {
                status: 'processing',
                currentModel
            };
        }, clientProxyUrl);
        exports.aiChatJobsQueue[jobId] = {
            status: 'completed',
            result: aiResponse,
            currentModel: aiResponse._usedModel || model
        };
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
        const { prompt, pageId, model } = req.body;
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
        // Extract client provided Gemini Key & Proxy from headers if present
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
        exports.aiChatJobsQueue[jobId] = { status: 'pending', currentModel: model || 'gemini-2.5-flash' };
        // Disparar processamento assíncrono em background sem prender o HTTP request
        processAIChatJob(jobId, prompt, pageId, clientGeminiKey, model, registeredModels, clientProxyUrl);
        return res.status(202).json({ jobId, status: 'pending' });
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
        // Call Google Gemini Models list endpoint directly with proxy support
        const fetchOptions = {};
        if (clientProxyUrl) {
            const { ProxyAgent } = await Promise.resolve().then(() => __importStar(require('undici')));
            fetchOptions.dispatcher = new ProxyAgent(clientProxyUrl);
        }
        const { fetch: undiciFetch } = await Promise.resolve().then(() => __importStar(require('undici')));
        const response = await undiciFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${clientGeminiKey}`, fetchOptions);
        if (!response.ok) {
            const errBody = await response.text();
            return res.status(response.status).json({ error: `Erro na API do Gemini: ${errBody}` });
        }
        const data = await response.json();
        const geminiModels = (data.models || [])
            .filter((m) => m.name && m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map((m) => {
            const id = m.name.replace('models/', '');
            return {
                id,
                name: m.displayName || id,
                description: m.description
            };
        });
        return res.json({ models: geminiModels });
    }
    catch (error) {
        console.error("Erro ao buscar modelos do Gemini:", error);
        return res.status(500).json({ error: error.message });
    }
});
exports.aiRouter = router;
