import { Router } from 'express';
import { generateAIResponse } from '../services/gemini';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// In-memory queue system for AI chat modifications
export const aiChatJobsQueue: Record<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentModel?: string;
  scope?: 'single' | 'all';
  result?: {
    explanation: string;
    html?: string;
    css?: string;
    js?: string;
    _usedModel?: string;
    updatedPages?: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }>;
  };
  error?: string;
}> = {};

// Background worker for chat edits (suporta single-page ou todas as páginas)
async function processAIChatJob(
  jobId: string,
  prompt: string,
  pageId: string,
  applyToAll: boolean,
  clientGeminiKey?: string,
  model?: string,
  registeredModels?: string[],
  clientProxyUrl?: string
) {
  aiChatJobsQueue[jobId] = { 
    status: 'processing', 
    currentModel: model || 'gemini-2.5-flash',
    scope: applyToAll ? 'all' : 'single'
  };

  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: { include: { pages: true } } }
    });

    if (!page) throw new Error('Página não encontrada');

    // Se applyToAll for true, processa iterativamente ou em lote todas as páginas do projeto
    if (applyToAll && page.project?.pages && page.project.pages.length > 1) {
      const allPages = page.project.pages;
      const updatedPages: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }> = [];

      for (let i = 0; i < allPages.length; i++) {
        const p = allPages[i];
        aiChatJobsQueue[jobId] = {
          status: 'processing',
          currentModel: `${model || 'gemini-2.5-flash'} (Página ${i + 1}/${allPages.length}: ${p.name})`,
          scope: 'all'
        };

        const pagePrompt = `
          Estamos aplicando uma alteração global em todas as páginas do site.
          Página atual sendo editada: "${p.name}" (slug: /${p.slug})
          Instrução do usuário: "${prompt}"
        `;

        const aiResponse = await generateAIResponse(
          pagePrompt,
          {
            html: p.html,
            css: p.css,
            js: p.js
          },
          clientGeminiKey,
          model,
          registeredModels,
          undefined,
          clientProxyUrl
        );

        // Atualizar no banco de dados
        await prisma.page.update({
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

      const activeUpdated = updatedPages.find(p => p.id === pageId) || updatedPages[0];

      aiChatJobsQueue[jobId] = {
        status: 'completed',
        scope: 'all',
        result: {
          explanation: `Alteração aplicada com sucesso em todas as ${updatedPages.length} páginas do site!`,
          html: activeUpdated.html,
          css: activeUpdated.css,
          js: activeUpdated.js,
          updatedPages
        }
      };
    } else {
      // Alteração na página individual ativa
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
            currentModel,
            scope: 'single'
          };
        },
        clientProxyUrl
      );

      // Persiste automaticamente a alteração no banco
      await prisma.page.update({
        where: { id: page.id },
        data: {
          html: aiResponse.html || page.html,
          css: aiResponse.css || page.css,
          js: aiResponse.js || page.js
        }
      });

      aiChatJobsQueue[jobId] = {
        status: 'completed',
        scope: 'single',
        result: aiResponse,
        currentModel: aiResponse._usedModel || model
      };
    }
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
    const { prompt, pageId, model, applyToAll } = req.body;

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

    // Detectar intenção de aplicar a todas as páginas via prompt ou checkbox
    const hasGlobalIntent = applyToAll === true || 
      /todas as p[áa]ginas|em todo o site|globalmente|em todas|todas páginas|navbar de todas/i.test(prompt);

    const clientGeminiKey = (req.headers['x-gemini-key'] || req.headers['X-Gemini-Key']) as string;
    const clientProxyUrl = (req.headers['x-proxy-url'] || req.headers['X-Proxy-Url']) as string || process.env.AI_PROXY_URL;
    let registeredModels: string[] | undefined;
    try {
      const rawModels = (req.headers['x-gemini-models'] || req.headers['X-Gemini-Models']) as string;
      if (rawModels) registeredModels = JSON.parse(rawModels);
    } catch {}

    const jobId = `chat-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    aiChatJobsQueue[jobId] = { 
      status: 'pending', 
      currentModel: model || 'gemini-2.5-flash',
      scope: hasGlobalIntent ? 'all' : 'single'
    };

    // Disparar processamento assíncrono em background
    processAIChatJob(
      jobId, 
      prompt, 
      pageId, 
      hasGlobalIntent, 
      clientGeminiKey, 
      model, 
      registeredModels, 
      clientProxyUrl
    );

    return res.status(202).json({ jobId, status: 'pending', scope: hasGlobalIntent ? 'all' : 'single' });
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

// List available models from Google Gemini API with the given API key
router.get('/models', async (req: AuthenticatedRequest, res: any) => {
  try {
    const clientGeminiKey = (req.headers['x-gemini-key'] || req.headers['X-Gemini-Key'] || process.env.GEMINI_API_KEY) as string;
    const clientProxyUrl = (req.headers['x-proxy-url'] || req.headers['X-Proxy-Url']) as string || process.env.AI_PROXY_URL;
    
    if (!clientGeminiKey) {
      return res.status(400).json({ error: 'Chave do Gemini não configurada' });
    }

    const fetchOptions: any = {};
    if (clientProxyUrl && clientProxyUrl.startsWith('http')) {
      const { ProxyAgent } = await import('undici');
      fetchOptions.dispatcher = new ProxyAgent(clientProxyUrl);
    }

    const resApi = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${clientGeminiKey}`, fetchOptions);
    if (!resApi.ok) {
      const errTxt = await resApi.text();
      return res.status(resApi.status).json({ error: errTxt });
    }

    const data: any = await resApi.json();
    const models = (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', ''),
        description: m.description
      }));

    return res.json({ models });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const aiRouter = router;
