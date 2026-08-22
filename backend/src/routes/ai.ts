import { Router } from 'express';
import { 
  generateAIResponse 
} from '../services/gemini';
import { 
  scrapeJobsQueue, 
  startWebsiteScrapeJob, 
  processCustomRemasterGenerationJob 
} from '../services/siteRemaster';
import { projectJobsQueue } from './projects';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// In-memory queue system for AI chat modifications
export const aiChatJobsQueue: Record<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentModel?: string;
  scope?: 'single' | 'all';
  pageId?: string;
  projectId?: string;
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
  clientProxyUrl?: string,
  customSkills?: Array<{ id: string; name: string; promptSnippet: string; enabled: boolean }>
) {
  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: { include: { pages: true } } }
    });

    if (!page) throw new Error('Página não encontrada');

    aiChatJobsQueue[jobId] = { 
      status: 'processing', 
      currentModel: model || 'gemini-2.5-flash',
      scope: applyToAll ? 'all' : 'single',
      pageId,
      projectId: page.projectId
    };

    // Se applyToAll for true, processa todas as páginas em PARALELO para máxima velocidade
    if (applyToAll && page.project?.pages && page.project.pages.length > 1) {
      const allPages = page.project.pages;
      aiChatJobsQueue[jobId] = {
        status: 'processing',
        currentModel: `${model || 'gemini-2.5-flash'} (Processando ${allPages.length} páginas do projeto em paralelo...)`,
        scope: 'all',
        pageId,
        projectId: page.projectId
      };

      const allRoutes = allPages.map(p => ({
        name: p.name,
        slug: p.slug,
        href: p.isHomepage ? 'index.html' : `${p.slug}.html`
      }));
      const routesGuide = allRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

      const updatedPages = await Promise.all(
        allPages.map(async (p) => {
          const pagePrompt = `
            Estamos aplicando uma alteração global em todas as páginas do site do projeto "${page.project?.name}".
            Página atual: "${p.name}" (slug: /${p.slug}, arquivo: ${p.isHomepage ? 'index.html' : p.slug + '.html'})
            
            MAPA DE NAVEGAÇÃO UNIVERSAL DO PROJETO (Mantenha a Navbar e Footer com esses links em todas as páginas):
            ${routesGuide}

            Instrução do usuário: "${prompt}"

            REGRAS OBRIGATÓRIAS:
            1. Mantenha o MESMO tema, fontes, cores e a MESMA Navbar/Header em todas as páginas.
            2. Separação Estrita: Retorne APENAS HTML limpo no campo "html" (sem tags <style> nem <script>). Todo CSS adicional no campo "css" e JS funcional no campo "js".
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
            clientProxyUrl,
            customSkills
          );

          await prisma.page.update({
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
        })
      );

      aiChatJobsQueue[jobId] = {
        status: 'completed',
        scope: 'all',
        pageId,
        projectId: page.projectId,
        result: {
          explanation: `Alteração aplicada globalmente com sucesso em ${updatedPages.length} páginas do site.`,
          updatedPages
        },
        currentModel: model
      };
    } else {
      // Processamento em página única
      const singlePrompt = `
        Página atual: "${page.name}" (slug: /${page.slug}, arquivo: ${page.isHomepage ? 'index.html' : page.slug + '.html'})
        Instrução de alteração do usuário: "${prompt}"
      `;

      const aiResponse = await generateAIResponse(
        singlePrompt,
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
            scope: 'single',
            pageId,
            projectId: page.projectId
          };
        },
        clientProxyUrl,
        customSkills
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
        pageId,
        projectId: page.projectId,
        result: aiResponse,
        currentModel: aiResponse._usedModel || model
      };
    }
  } catch (error: any) {
    console.error(`Erro ao processar job de IA ${jobId}:`, error);
    aiChatJobsQueue[jobId] = {
      status: 'failed',
      pageId,
      error: error.message || 'Erro ao processar alterações da IA'
    };
  }
}

// Endpoint para disparar alteração via Chat AI em background
router.post('/chat', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { prompt, pageId, model, applyToAll } = req.body;

    if (!prompt || !pageId) {
      return res.status(400).json({ error: 'Prompt e pageId são obrigatórios' });
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

    let customSkills: any[] | undefined;
    try {
      const rawSkills = (req.headers['x-ai-skills'] || req.headers['X-Ai-Skills'] || req.headers['X-AI-Skills']) as string;
      if (rawSkills) customSkills = JSON.parse(rawSkills);
    } catch {}

    const jobId = `chat-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    aiChatJobsQueue[jobId] = { 
      status: 'pending', 
      currentModel: model || 'gemini-2.5-flash',
      scope: hasGlobalIntent ? 'all' : 'single',
      pageId,
      projectId: page.projectId
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
      clientProxyUrl,
      customSkills
    );

    return res.status(202).json({ jobId, status: 'pending', scope: hasGlobalIntent ? 'all' : 'single' });
  } catch (error: any) {
    console.error("Erro na rota /api/ai/chat:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint para buscar o job ativo de uma página ou projeto
router.get('/jobs/active', (req: AuthenticatedRequest, res: any) => {
  const { pageId, projectId } = req.query as { pageId?: string; projectId?: string };

  const jobsList = Object.entries(aiChatJobsQueue);
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

/**
 * Endpoint 1: Iniciar Extração Prévia de Páginas do Site Cliente (Scrape Job)
 */
router.post('/remaster/scrape', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { websiteUrl, businessName } = req.body;
    if (!websiteUrl) {
      return res.status(400).json({ error: 'A URL do website é obrigatória.' });
    }

    const clientProxyUrl = (req.headers['x-proxy-url'] || req.headers['X-Proxy-Url']) as string || process.env.AI_PROXY_URL;
    const jobId = `scrape-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`;

    startWebsiteScrapeJob(
      jobId, 
      websiteUrl, 
      businessName || 'Empresa', 
      clientProxyUrl
    );

    return res.status(202).json({
      jobId,
      status: 'scraping',
      message: 'Extração do site iniciada em background.'
    });
  } catch (err: any) {
    console.error('Erro na rota /api/ai/remaster/scrape:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint 2: Status da Extração de Páginas do Site Cliente
 */
router.get('/remaster/scrape/:jobId/status', (req: AuthenticatedRequest, res: any) => {
  const jobId = req.params.jobId as string;
  const job = scrapeJobsQueue[jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job de extração não encontrado ou expirado.' });
  }

  return res.json(job);
});

/**
 * Endpoint 3: Geração Customizada do Site Multi-Página a partir do Plano Definido
 */
router.post('/remaster/generate', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { 
      projectName, 
      globalPrompt, 
      pages, 
      sharedComponents 
    } = req.body;

    if (!projectName || !pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'Nome do projeto e lista de páginas são obrigatórios.' });
    }

    const userId = req.userId as string;

    // 1. Criar o Projeto no Banco de Dados
    const project = await prisma.project.create({
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

    const clientGeminiKey = (req.headers['x-gemini-key'] || req.headers['X-Gemini-Key']) as string || process.env.GEMINI_API_KEY;
    const clientProxyUrl = (req.headers['x-proxy-url'] || req.headers['X-Proxy-Url']) as string || process.env.AI_PROXY_URL;
    let registeredModels: string[] | undefined;
    try {
      const rawModels = (req.headers['x-gemini-models'] || req.headers['X-Gemini-Models']) as string;
      if (rawModels) registeredModels = JSON.parse(rawModels);
    } catch {}

    let customSkills: any[] | undefined;
    try {
      const rawSkills = (req.headers['x-ai-skills'] || req.headers['X-Ai-Skills'] || req.headers['X-AI-Skills']) as string;
      if (rawSkills) customSkills = JSON.parse(rawSkills);
    } catch {}

    // 2. Registrar no queue de status de projetos
    projectJobsQueue[project.id] = { status: 'pending' };

    // 3. Disparar o Worker de Geração Multi-página Customizado
    processCustomRemasterGenerationJob(
      project.id,
      projectName,
      globalPrompt || 'Design moderno, luxuoso, alta conversão e responsivo.',
      pages,
      sharedComponents || { repeatNavbar: true, repeatFooter: true },
      clientGeminiKey,
      registeredModels,
      clientProxyUrl,
      (status, attempt, total) => {
        projectJobsQueue[project.id] = {
          status: 'processing',
          currentModel: status,
          attempt,
          total
        };
      },
      customSkills
    ).then(() => {
      projectJobsQueue[project.id] = { status: 'completed' };
    }).catch((err) => {
      console.error(`Erro ao gerar projeto customizado ${project.id}:`, err);
      projectJobsQueue[project.id] = { status: 'failed', error: err.message };
    });

    return res.status(201).json(project);
  } catch (error: any) {
    console.error('Erro na rota /api/ai/remaster/generate:', error);
    return res.status(500).json({ error: error.message });
  }
});

export const aiRouter = router;

