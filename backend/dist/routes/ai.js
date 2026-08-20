"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const gemini_1 = require("../services/gemini");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// Process AI request and return patch/commands
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
        // Extract client provided Gemini Key from headers if present
        const clientGeminiKey = (req.headers['x-gemini-key'] || req.headers['X-Gemini-Key']);
        let registeredModels;
        try {
            const rawModels = (req.headers['x-gemini-models'] || req.headers['X-Gemini-Models']);
            if (rawModels)
                registeredModels = JSON.parse(rawModels);
        }
        catch { }
        // Call Gemini with current page context and strictly registered cascade models
        const aiResponse = await (0, gemini_1.generateAIResponse)(prompt, {
            html: page.html,
            css: page.css,
            js: page.js
        }, clientGeminiKey, model, registeredModels);
        return res.json(aiResponse);
    }
    catch (error) {
        console.error("Erro na rota /api/ai/chat:", error);
        return res.status(500).json({ error: error.message });
    }
});
exports.aiRouter = router;
