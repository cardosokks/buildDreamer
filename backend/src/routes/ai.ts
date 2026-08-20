import { Router } from 'express';
import { generateAIResponse } from '../services/gemini';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// In-memory queue system for AI chat modifications
export const aiChatJobsQueue: Record<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentModel?: string;
  result?: {
    explanation: string;
    html: string;
    css: string;
    js: string;
    _usedModel?: string;
  };
  error?: string;
}> = {};

// Background worker for chat edits
async function processAIChatJob(
  jobId: string,
  prompt: string,
  pageId: string,
  clientGeminiKey?: string,
  model?: string,
  registeredModels?: string[]
) {
  aiChatJobsQueue[jobId] = { status: 'processing', currentModel: model || 'gemini-2.5-flash' };
  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId }
    });

    if (!page) throw new Error('Página não encontrada');

    const aiResponse = await generateAIResponse(
      prompt,
      {
        html: page.html,
        css: page.css,
        js: page.js
      },
      clientGeminiKey,
      model,
      registeredModels,
      (currentModel) => {
        aiChatJobsQueue[jobId] = {
          status: 'processing',
          currentModel
        };
      }
    );

    aiChatJobsQueue[jobId] = {
      status: 'completed',
      result: aiResponse,
      currentModel: aiResponse._usedModel || model
    };
  } catch (error: any) {
    console.error(`Erro ao processar job de IA ${jobId}:`, error);
    aiChatJobsQueue[jobId] = {
      status: 'failed',
      error: error.message || 'Erro ao processar alterações da IA'
    };
  }
}

// Process AI request and start background job
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

    const jobId = `chat-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    aiChatJobsQueue[jobId] = { status: 'pending', currentModel: model || 'gemini-2.5-flash' };

    // Disparar processamento assíncrono em background sem prender o HTTP request
    processAIChatJob(jobId, prompt, pageId, clientGeminiKey, model, registeredModels);

    return res.status(202).json({ jobId, status: 'pending' });
  } catch (error: any) {
    console.error("Erro na rota /api/ai/chat:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Poll AI Chat Job status
router.get('/jobs/:jobId/status', (req: AuthenticatedRequest, res: any) => {
  const jobId = req.params.jobId as string;
  const job = aiChatJobsQueue[jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job não encontrado ou expirado' });
  }

  return res.json(job);
});

export const aiRouter = router;
