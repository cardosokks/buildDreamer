import { Router } from 'express';
import { executeAIRequest, AIExecutionOptions } from '../services/aiEngine';
import { listGeminiModels } from '../services/gemini';
import { testOllamaConnection, RECOMMENDED_LOW_SPEC_MODELS } from '../services/ollamaService';
import { 
  scrapeJobsQueue, 
  startWebsiteScrapeJob, 
  processCustomRemasterGenerationJob 
} from '../services/siteRemaster';
import { projectJobsQueue } from './projects';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Helper: decodifica headers Base64 ou texto plano
const decodeHeader = (val: string | string[] | undefined): string => {
  if (!val) return '';
  const str = Array.isArray(val) ? val[0] : val;
  if (!str) return '';
  try {
    return decodeURIComponent(escape(Buffer.from(str, 'base64').toString('binary')));
  } catch {
    return str;
  }
};

// In-memory queue system for AI chat modifications
export const aiChatJobsQueue: Record<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  currentModel?: string;
  provider?: string;
  scope?: 'single' | 'all';
  pageId?: string;
  projectId?: string;
  result?: {
    explanation: string;
    html?: string;
    css?: string;
    js?: string;
    _usedModel?: string;
    _usedProvider?: string;
    updatedPages?: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }>;
  };
  error?: string;
}> = {};

// Background worker for chat edits (suporta single-page, páginas selecionadas ou todas as páginas)
async function processAIChatJob(
  jobId: string,
  prompt: string,
  pageId: string,
  applyToAll: boolean,
  options: AIExecutionOptions & {
    targetPageIds?: string[];
  }
) {
  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: { include: { pages: true } } }
    });

    if (!page) throw new Error('Página não encontrada');

    const projectPages = page.project?.pages || [page];
    
    let pagesToProcess: typeof projectPages = [];
    if (options.targetPageIds && Array.isArray(options.targetPageIds) && options.targetPageIds.length > 0) {
      pagesToProcess = projectPages.filter(p => options.targetPageIds!.includes(p.id));
      if (pagesToProcess.length === 0) pagesToProcess = [page];
    } else if (applyToAll && projectPages.length > 1) {
      pagesToProcess = projectPages;
    } else {
      pagesToProcess = [page];
    }

    const isMultiPage = pagesToProcess.length > 1;

    aiChatJobsQueue[jobId] = { 
      status: 'processing', 
      currentModel: isMultiPage 
        ? `${options.model || (options.provider === 'ollama' ? 'qwen2.5-coder:1.5b' : 'gemini-2.0-flash')} (Processando ${pagesToProcess.length} páginas...)`
        : options.model || (options.provider === 'ollama' ? 'qwen2.5-coder:1.5b' : 'gemini-2.0-flash'),
      provider: options.provider || 'gemini',
      scope: isMultiPage ? 'all' : 'single',
      pageId,
      projectId: page.projectId
    };

    if (isMultiPage) {
      const updatedPages: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }> = [];
      let finalExplanation = '';

      for (let i = 0; i < pagesToProcess.length; i++) {
        const currentPage = pagesToProcess[i];
        
        aiChatJobsQueue[jobId].currentModel = `[${i + 1}/${pagesToProcess.length}] Atualizando página: "${currentPage.name}"`;

        const context = {
          html: currentPage.html || '<div></div>',
          css: currentPage.css || '',
          js: currentPage.js || ''
        };

        const pageSpecificPrompt = `${prompt}\n\n[INSTRUÇÃO IMPORTANTE]: Você está atualizando a página "${currentPage.name}" (slug: /${currentPage.slug}) do projeto. Mantenha a identidade visual e o design global sincronizado com as demais páginas.`;

        const res = await executeAIRequest(pageSpecificPrompt, context, {
          ...options,
          onProgress: (info) => {
            if (aiChatJobsQueue[jobId]) {
              aiChatJobsQueue[jobId].currentModel = `[${i + 1}/${pagesToProcess.length}] ${currentPage.name}: ${info.model || ''}`;
            }
          }
        });

        await prisma.page.update({
          where: { id: currentPage.id },
          data: {
            html: res.html,
            css: res.css,
            js: res.js
          }
        });

        updatedPages.push({
          id: currentPage.id,
          name: currentPage.name,
          slug: currentPage.slug,
          html: res.html,
          css: res.css,
          js: res.js
        });

        if (i === 0) finalExplanation = res.explanation;
      }

      const activeUpdated = updatedPages.find(p => p.id === pageId) || updatedPages[0];

      aiChatJobsQueue[jobId] = {
        status: 'completed',
        scope: 'all',
        pageId,
        projectId: page.projectId,
        result: {
          explanation: `Todas as ${updatedPages.length} páginas selecionadas foram atualizadas com sucesso e sincronizadas com a nova instrução visual.\n\n${finalExplanation}`,
          html: activeUpdated?.html,
          css: activeUpdated?.css,
          js: activeUpdated?.js,
          _usedModel: options.model || (options.provider === 'ollama' ? 'qwen2.5-coder:1.5b' : 'gemini-2.0-flash'),
          _usedProvider: options.provider || 'gemini',
          updatedPages
        }
      };
    } else {
      const context = {
        html: page.html || '<div></div>',
        css: page.css || '',
        js: page.js || ''
      };

      const result = await executeAIRequest(prompt, context, {
        ...options,
        onProgress: (info) => {
          if (aiChatJobsQueue[jobId]) {
            aiChatJobsQueue[jobId].currentModel = info.model;
          }
        }
      });

      await prisma.page.update({
        where: { id: page.id },
        data: {
          html: result.html,
          css: result.css,
          js: result.js
        }
      });

      aiChatJobsQueue[jobId] = {
        status: 'completed',
        scope: 'single',
        pageId,
        projectId: page.projectId,
        result: {
          explanation: result.explanation,
          html: result.html,
          css: result.css,
          js: result.js,
          _usedModel: result._usedModel,
          _usedProvider: result._usedProvider
        }
      };
    }
  } catch (error: any) {
    console.error(`[AIChatJob ${jobId}] Erro durante processamento:`, error);
    aiChatJobsQueue[jobId] = {
      status: 'failed',
      pageId,
      error: error.message || 'Falha ao processar comando de IA.'
    };
  }
}

// POST /api/ai/ollama/test - Testar conexão com o Ollama e listar modelos
router.post('/ollama/test', async (req, res) => {
  try {
    const endpoint = req.body.endpoint || req.headers['x-ollama-endpoint'] || 'http://localhost:11434';
    const result = await testOllamaConnection(String(endpoint));
    return res.json({
      ...result,
      recommendedModels: RECOMMENDED_LOW_SPEC_MODELS
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/ai/ollama/models - Obter lista de modelos recomendados para PC fraco
router.get('/ollama/models', async (req, res) => {
  const endpoint = (req.query.endpoint as string) || 'http://localhost:11434';
  const conn = await testOllamaConnection(endpoint);
  return res.json({
    connected: conn.success,
    models: conn.models || [],
    recommended: RECOMMENDED_LOW_SPEC_MODELS,
    endpoint: conn.endpoint
  });
});

// GET /api/ai/gemini/models - Listar modelos diretamente da API do Google
router.get('/gemini/models', async (req, res) => {
  try {
    const customApiKey = decodeHeader(req.headers['x-gemini-key']) || undefined;
    const customProxyUrl = decodeHeader(req.headers['x-ai-proxy-url']) || undefined;
    
    const models = await listGeminiModels(customApiKey, customProxyUrl);
    
    // Simplifica a resposta para o frontend
    const simplifiedModels = models.map((m: any) => ({
      id: m.name.replace('models/', ''),
      name: m.displayName || m.name.replace('models/', ''),
      description: m.description,
      version: m.version,
      supportedGenerationMethods: m.supportedGenerationMethods
    }));

    return res.json({ success: true, models: simplifiedModels });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/modify-stream - Inicia job assíncrono de modificação por IA
router.post('/modify-stream', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { prompt, pageId, applyToAll, targetPageIds, attachedFiles, lowSpecMode } = req.body;

    if (!prompt || !pageId) {
      return res.status(400).json({ error: 'Prompt e pageId são obrigatórios' });
    }

    const provider = (req.headers['x-ai-provider'] as any) || req.body.provider || 'gemini';
    const customApiKey = decodeHeader(req.headers['x-gemini-key']) || undefined;
    const customModel = decodeHeader(req.headers['x-gemini-model']) || req.body.model || undefined;
    const ollamaEndpoint = decodeHeader(req.headers['x-ollama-endpoint']) || req.body.ollamaEndpoint || undefined;
    const isLowSpec = lowSpecMode !== undefined ? !!lowSpecMode : req.headers['x-low-spec-mode'] === 'true';
    
    // Modelos alternativos registrados
    let registeredModels: string[] | undefined;
    const rawRegisteredModels = req.headers['x-registered-models'] as string;
    if (rawRegisteredModels) {
      try {
        const decoded = decodeHeader(rawRegisteredModels);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed) && parsed.length > 0) registeredModels = parsed;
      } catch {}
    }

    // Proxy customizado
    let customProxyUrl: string | undefined;
    const rawProxy = decodeHeader(req.headers['x-ai-proxy-url']);
    if (rawProxy) {
      customProxyUrl = decodeHeader(rawProxy) || undefined;
    }

    // Custom Skills
    let customSkills: any[] | undefined;
    const rawSkills = req.headers['x-custom-ai-skills'] as string;
    if (rawSkills) {
      try {
        const decoded = decodeHeader(rawSkills);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed) && parsed.length > 0) customSkills = parsed;
      } catch {}
    }

    const jobId = `chat_job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    aiChatJobsQueue[jobId] = { 
      status: 'pending', 
      currentModel: customModel || (provider === 'ollama' ? 'qwen2.5-coder:1.5b' : 'gemini-2.0-flash'),
      provider,
      pageId 
    };

    // Dispara em background
    processAIChatJob(jobId, prompt, pageId, !!applyToAll, {
      provider,
      apiKey: customApiKey,
      model: customModel,
      registeredModels,
      proxyUrl: customProxyUrl,
      ollamaEndpoint,
      lowSpecMode: isLowSpec,
      customSkills,
      targetPageIds: Array.isArray(targetPageIds) ? targetPageIds : undefined,
      attachedFiles: Array.isArray(attachedFiles) ? attachedFiles : undefined
    });

    return res.status(202).json({ jobId, status: 'pending' });
  } catch (error: any) {
    console.error('Error starting AI Chat job:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/chat-job/:jobId - Polling do status do chat AI
router.get('/chat-job/:jobId', (req, res: any) => {
  const { jobId } = req.params;
  const job = aiChatJobsQueue[jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job não encontrado ou expirado.' });
  }

  return res.json(job);
});

// POST /api/ai/generate-page - Gerar nova página do zero
router.post('/generate-page', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { prompt, projectId, name, slug } = req.body;
    if (!prompt || !projectId) {
      return res.status(400).json({ error: 'Prompt e projectId são obrigatórios' });
    }

    const provider = (req.headers['x-ai-provider'] as any) || 'gemini';
    const customApiKey = decodeHeader(req.headers['x-gemini-key']) || undefined;
    const customModel = decodeHeader(req.headers['x-gemini-model']) || undefined;
    const ollamaEndpoint = decodeHeader(req.headers['x-ollama-endpoint']) || undefined;

    const result = await executeAIRequest(
      `Crie uma página completa de alta conversão e design ultra moderno com o tema: ${prompt}`,
      { html: '<div id="canvas-root"></div>', css: '', js: '' },
      { provider, apiKey: customApiKey, model: customModel, ollamaEndpoint }
    );

    const pageSlug = slug || (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : `page-${Date.now()}`);
    const pageName = name || 'Nova Página';

    const newPage = await prisma.page.create({
      data: {
        name: pageName,
        slug: pageSlug,
        title: pageName,
        html: result.html,
        css: result.css,
        js: result.js,
        projectId,
        isHomepage: false
      }
    });

    return res.status(201).json({
      page: newPage,
      explanation: result.explanation
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/scrape-job/:jobId ou /api/ai/remaster/scrape/:jobId/status - Polling de job de remasterização
router.get(['/scrape-job/:jobId', '/remaster/scrape/:jobId/status'], (req, res: any) => {
  const { jobId } = req.params;
  const job = scrapeJobsQueue[jobId];
  if (!job) {
    return res.status(404).json({ error: 'Job de remasterização não encontrado.' });
  }
  return res.json(job);
});

// POST /api/ai/scrape-url ou /api/ai/remaster/scrape - Iniciar remasterização de site a partir de URL ou HTML
router.post(['/scrape-url', '/remaster/scrape'], async (req: AuthenticatedRequest, res: any) => {
  try {
    const { url, websiteUrl, customPrompt, rawHtml, rawCss, projectTitle, companyCategory, businessName } = req.body;
    const targetUrl = url || websiteUrl;
    const targetBusinessName = projectTitle || businessName || 'Site Remasterizado';

    if (!targetUrl && !rawHtml) {
      return res.status(400).json({ error: 'Informe uma URL ou o código HTML do site existente para remasterização.' });
    }

    const customApiKey = decodeHeader(req.headers['x-gemini-key']) || undefined;
    const customModel = decodeHeader(req.headers['x-gemini-model']) || undefined;

    const jobId = `scrape_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (rawHtml) {
      // Inicia com scraping virtual do HTML informado
      scrapeJobsQueue[jobId] = {
        status: 'completed',
        websiteUrl: targetUrl || 'HTML Direto',
        businessName: targetBusinessName,
        discoveredPages: [
          {
            name: 'Home',
            slug: 'index',
            url: targetUrl || 'http://localhost',
            cleanText: rawHtml.replace(/<[^>]+>/g, ' ').slice(0, 3000),
            excerpt: rawHtml.replace(/<[^>]+>/g, ' ').slice(0, 180) + '...',
            isHomepage: true
          }
        ],
        progressMessage: 'HTML recebido com sucesso.'
      };
    } else {
      startWebsiteScrapeJob(
        jobId,
        targetUrl!,
        targetBusinessName,
        req.userId as string,
        undefined
      );
    }

    return res.status(202).json({
      jobId,
      message: 'Processamento de remasterização iniciado com sucesso.'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/remaster/generate - Gerar site completo remasterizado com IA
router.post('/remaster/generate', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { projectName, globalPrompt, pages, leadId, sharedComponents } = req.body;
    const userId = req.userId as string;

    if (!projectName || !pages || !Array.isArray(pages)) {
      return res.status(400).json({ error: 'Dados insuficientes para geração do site.' });
    }

    // 1. Criar o Projeto no Banco de Dados (Skeleton)
    const project = await prisma.project.create({
      data: {
        name: projectName,
        description: `Remasterização de site: ${projectName}`,
        members: {
          create: {
            userId,
            role: 'OWNER'
          }
        }
      }
    });

    // 2. Vincular ao Lead se houver
    if (leadId) {
      await prisma.$executeRawUnsafe(`UPDATE "Lead" SET "projectId" = $1 WHERE "id" = $2`, project.id, leadId).catch(() => {});
    }

    // 3. Preparar configurações de IA
    const customApiKey = decodeHeader(req.headers['x-gemini-key']);
    const customProxyUrl = decodeHeader(req.headers['x-proxy-url']);
    
    let registeredModels: string[] | undefined;
    const rawModels = decodeHeader(req.headers['x-gemini-models']);
    if (rawModels) {
      try { registeredModels = JSON.parse(rawModels); } catch {}
    }

    let customSkills: any[] | undefined;
    const rawSkills = decodeHeader(req.headers['x-ai-skills']);
    if (rawSkills) {
      try { customSkills = JSON.parse(rawSkills); } catch {}
    }
    
    const aiProvider = decodeHeader(req.headers['x-ai-provider']);
    const ollamaEndpoint = decodeHeader(req.headers['x-ollama-endpoint']);

    // 4. Disparar geração em Background
    projectJobsQueue[project.id] = { status: 'pending' };
    processCustomRemasterGenerationJob(
      project.id,
      projectName,
      globalPrompt || 'Design moderno e profissional.',
      pages,
      sharedComponents || { repeatNavbar: true, repeatFooter: true },
      customApiKey,
      registeredModels,
      customProxyUrl,
      (status, attempt, total) => {
        projectJobsQueue[project.id] = {
          status: 'processing',
          currentModel: status,
          attempt,
          total
        };
      },
      customSkills,
      userId,
      aiProvider,
      ollamaEndpoint
    ).then(() => {
      projectJobsQueue[project.id] = { status: 'completed' };
    }).catch((err) => {
      console.error(`[Remaster Job ${project.id}] Erro:`, err);
      projectJobsQueue[project.id] = { status: 'failed', error: err.message };
    });

    return res.status(201).json(project);
  } catch (error: any) {
    console.error('Erro ao iniciar geração remaster:', error);
    return res.status(500).json({ error: error.message });
  }
});

export { router as aiRouter };
