import { Router } from 'express';
import { generateAIResponse } from '../services/gemini';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Process AI request and return patch/commands
router.post('/chat', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { prompt, pageId, model } = req.body;

    if (!prompt || !pageId) {
      return res.status(400).json({ error: 'Prompt and pageId are required' });
    }

    const page = await prisma.page.findUnique({
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
    const clientGeminiKey = (req.headers['x-gemini-key'] || req.headers['X-Gemini-Key']) as string;
    let registeredModels: string[] | undefined;
    try {
      const rawModels = (req.headers['x-gemini-models'] || req.headers['X-Gemini-Models']) as string;
      if (rawModels) registeredModels = JSON.parse(rawModels);
    } catch {}

    // Call Gemini with current page context and strictly registered cascade models
    const aiResponse = await generateAIResponse(prompt, {
      html: page.html,
      css: page.css,
      js: page.js
    }, clientGeminiKey, model, registeredModels);

    return res.json(aiResponse);
  } catch (error: any) {
    console.error("Erro na rota /api/ai/chat:", error);
    return res.status(500).json({ error: error.message });
  }
});

export const aiRouter = router;
