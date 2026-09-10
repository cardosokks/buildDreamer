import { Router } from 'express';
import { executeAIRequest, AIExecutionOptions } from '../services/aiEngine';
import { listGeminiModels } from '../services/gemini';
import { testOllamaConnection, RECOMMENDED_LOW_SPEC_MODELS } from '../services/ollamaService';
import { 
  scrapeJobsQueue, 
  startWebsiteScrapeJob, 
  processCustomRemasterGenerationJob,
  detectMedia,
  extractAndBundlePageComponents,
  extractNavbarAndFooter
} from '../services/siteRemaster';
import { projectJobsQueue } from './projects';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiQueueManager } from '../services/aiQueueManager';

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

// GET /api/ai/gemini/models & /api/ai/models - Listar modelos diretamente da API do Google
router.get(['/gemini/models', '/models'], async (req, res) => {
  try {
    const customApiKey = decodeHeader(req.headers['x-gemini-key']) || undefined;
    const customProxyUrl = decodeHeader(req.headers['x-ai-proxy-url']) || undefined;
    
    const models = await listGeminiModels(customApiKey, customProxyUrl);
    
    const invalidKeywords = ['-tts', '-image', 'gemma', 'imagen', 'embedding', '-customtools', 'bison', 'gecko', 'aqa', 'audio', 'vision-preview'];

    // Simplifica a resposta para o frontend e filtra apenas modelos de texto/código válidos
    const simplifiedModels = models
      .filter((m: any) => {
        if (!m.name) return false;
        const name = m.name.toLowerCase();
        if (invalidKeywords.some(kw => name.includes(kw))) return false;
        return !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent');
      })
      .map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', ''),
        description: m.description,
        version: m.version,
        supportedGenerationMethods: m.supportedGenerationMethods
      }));

    return res.json({ success: true, models: simplifiedModels });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message, message: error.message });
  }
});

// POST /api/ai/modify-stream - Inicia job assíncrono de modificação por IA
router.post('/modify-stream', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { prompt, pageId, applyToAll, targetPageIds, attachedFiles, lowSpecMode, targetSectionIndex, targetSectionLabel, targetSectionHtml } = req.body;

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

    // Busca o projeto correspondente à página
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { projectId: true }
    });

    if (!page) {
      return res.status(404).json({ error: 'Página não encontrada' });
    }

    // Cria e enfileira a tarefa na fila centralizada do projeto
    const job = aiQueueManager.enqueue(
      page.projectId,
      'chat_edit',
      prompt,
      pageId,
      {
        applyToAll: !!applyToAll,
        targetPageIds: Array.isArray(targetPageIds) ? targetPageIds : undefined,
        attachedFiles: Array.isArray(attachedFiles) ? attachedFiles : undefined,
        lowSpecMode: isLowSpec,
        provider,
        apiKey: customApiKey,
        model: customModel,
        registeredModels,
        proxyUrl: customProxyUrl,
        ollamaEndpoint,
        customSkills,
        targetSectionIndex: targetSectionIndex !== undefined ? Number(targetSectionIndex) : undefined,
        targetSectionLabel: targetSectionLabel || undefined,
        targetSectionHtml: targetSectionHtml || undefined
      }
    );

    return res.status(202).json({ jobId: job.id, status: 'pending' });
  } catch (error: any) {
    console.error('Error starting AI Chat job:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/chat-job/:jobId - Polling do status do chat AI
router.get('/chat-job/:jobId', (req, res: any) => {
  const { jobId } = req.params;

  // 1. Tentar encontrar no gerenciador centralizado de filas do projeto
  const queueJob = aiQueueManager.getItemStatusGlobally(jobId);
  if (queueJob) {
    return res.json({
      status: queueJob.status,
      currentModel: queueJob.currentModel,
      provider: queueJob.options?.provider || 'gemini',
      scope: queueJob.scope || 'single',
      pageId: queueJob.pageId,
      projectId: queueJob.projectId,
      result: queueJob.result,
      error: queueJob.error
    });
  }

  // 2. Fallback para fila legado em memória
  const job = aiChatJobsQueue[jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job não encontrado ou expirado.' });
  }

  return res.json(job);
});

// POST /api/ai/generate-page - Gerar nova página do zero integrada ao projeto existente
router.post('/generate-page', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { prompt, projectId, name, slug, templateType } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId é obrigatório' });
    }

    const provider = (req.headers['x-ai-provider'] as any) || 'gemini';
    const customApiKey = decodeHeader(req.headers['x-gemini-key']) || undefined;
    const customModel = decodeHeader(req.headers['x-gemini-model']) || undefined;
    const ollamaEndpoint = decodeHeader(req.headers['x-ollama-endpoint']) || undefined;

    // Buscar projeto e páginas existentes para manter 100% de consistência visual
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { pages: true }
    });

    const homePage = project?.pages.find(p => p.isHomepage || p.slug === 'index') || project?.pages[0];
    let navbarHtml = '';
    let footerHtml = '';
    let globalCss = '';
    let globalJs = '';

    if (homePage?.html) {
      const extracted = extractNavbarAndFooter(homePage.html);
      navbarHtml = extracted.navbarHtml;
      footerHtml = extracted.footerHtml;
      globalCss = homePage.css || '';
      globalJs = homePage.js || '';
    }

    const pageSlug = slug || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `page-${Date.now()}`);
    const pageName = name || 'Nova Página';

    const allRoutes = project?.pages ? [
      ...project.pages.map(p => ({ name: p.name, href: p.isHomepage ? 'index.html' : `${p.slug}.html` })),
      { name: pageName, href: `${pageSlug}.html` }
    ] : [{ name: 'Home', href: 'index.html' }, { name: pageName, href: `${pageSlug}.html` }];

    const navLinksDoc = allRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

    const projectContext = `
PROJETO: "${project?.name || 'Website'}"
DESCRIÇÃO/PROMPT DO PROJETO: "${project?.description || 'Site institucional profissional de alta conversão'}"
CÓDIGO DA PÁGINA HOME / ESTILOS TEMA:
CSS da Home (reutilizar variáveis :root e cores):
${globalCss}
`;

    const fullPrompt = `
Você é o Engenheiro Frontend Líder e Designer Master do projeto "${project?.name || 'Website'}".
Sua tarefa é criar a subpágina "${pageName}" (slug: ${pageSlug}) com nível de excelência internacional.

CONTEXTO DO PROJETO E PALETA DE CORES:
${projectContext}

TEMA E OBJETIVO DA PÁGINA:
${prompt || `Crie a página ${pageName} totalmente customizada para o nicho de ${project?.name}`}
Tipo de Estrutura: ${templateType || 'Livre / Niche Custom'}

DIRETRIZES DE DESIGN SYSTEM E CONSISTÊNCIA DE MARCA:
1. Mantenha exatamente a mesma identidade visual, paleta de cores e variáveis CSS do :root definidas para a página principal do projeto.
2. É ESTRITAMENTE PROIBIDO usar textos genéricos como "Lorem Ipsum", "Insira seu texto" ou "Empresa XYZ". Todo o conteúdo DEVE ser escrito sob medida para a proposta do projeto ("${project?.name}").
3. NAVBAR E FOOTER REPETIDOS:
${navbarHtml ? `Utilize EXATAMENTE a mesma estrutura de Navbar padronizada abaixo (destaque o link "${pageName}" como ativo):\n${navbarHtml}\n` : 'Crie um Header/Navbar moderno com links para as páginas.'}
${footerHtml ? `Utilize EXATAMENTE a mesma estrutura de Footer padronizado abaixo:\n${footerHtml}\n` : 'Crie um Footer completo multicolunas.'}

ROTAS DO SITE:
${navLinksDoc}

REGRAS:
- Retorne JSON estrito: { "html": "...", "css": "...", "js": "...", "explanation": "..." }
- HTML com classes Tailwind semânticas. NUNCA coloque tags <style> ou <script> dentro do HTML.
- Inclua botão flutuante de WhatsApp e interações funcionais no JS.
    `;

    const result = await executeAIRequest(
      fullPrompt,
      { html: '<div id="canvas-root"></div>', css: globalCss, js: globalJs },
      { provider, apiKey: customApiKey, model: customModel, ollamaEndpoint }
    );

    const newPage = await prisma.page.create({
      data: {
        name: pageName,
        slug: pageSlug,
        title: pageName,
        html: result.html,
        css: [globalCss, result.css || ''].filter(Boolean).join('\n\n'),
        js: [globalJs, result.js || ''].filter(Boolean).join('\n\n'),
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

// POST /api/ai/audit-site - Auditoria de Integridade, Erros e Qualidade do Site com IA
router.post('/audit-site', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId é obrigatório para auditoria' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { pages: true }
    });

    if (!project || project.pages.length === 0) {
      return res.status(404).json({ error: 'Projeto ou páginas não encontrados' });
    }

    const homePage = project.pages.find(p => p.isHomepage || p.slug === 'index') || project.pages[0];
    const extractedHome = extractNavbarAndFooter(homePage.html || '');

    const issues: Array<{
      id: string;
      pageId: string;
      pageName: string;
      type: 'placeholder' | 'theme_mismatch' | 'nav_inconsistency' | 'missing_content' | 'seo_missing' | 'broken_link';
      severity: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      suggestedFix: string;
    }> = [];

    let totalScore = 100;

    // Analisar cada página deterministicamente + regras de sanidade
    project.pages.forEach((page) => {
      const html = page.html || '';
      const lowerHtml = html.toLowerCase();

      // 1. Verificar Placeholders
      if (lowerHtml.includes('lorem ipsum') || lowerHtml.includes('insira seu texto') || lowerHtml.includes('sua empresa aqui') || lowerHtml.includes('via.placeholder.com')) {
        totalScore -= 12;
        issues.push({
          id: `placeholder-${page.id}`,
          pageId: page.id,
          pageName: page.name,
          type: 'placeholder',
          severity: 'warning',
          title: 'Texto ou Imagem Placeholder Detectado',
          description: `A página "${page.name}" contém textos temporários (ex: Lorem Ipsum) ou imagens genéricas de exemplo.`,
          suggestedFix: 'Substitua por copy persuasivo e imagens do nicho do projeto.'
        });
      }

      // 2. Verificar Links Quebrados na Navbar ou Botões
      if (html.includes('href="#"') || html.includes('href=""')) {
        totalScore -= 8;
        issues.push({
          id: `link-${page.id}`,
          pageId: page.id,
          pageName: page.name,
          type: 'broken_link',
          severity: 'info',
          title: 'Links não mapeados (href="#")',
          description: `A página "${page.name}" possui botões ou links direcionando para "#" sem destino real definido.`,
          suggestedFix: 'Atualize o href para apontar para seções internas (#contato) ou para outras páginas (.html).'
        });
      }

      // 3. Verificar se falta SEO Basico
      if (!page.seoTitle || !page.seoDescription) {
        totalScore -= 5;
        issues.push({
          id: `seo-${page.id}`,
          pageId: page.id,
          pageName: page.name,
          type: 'seo_missing',
          severity: 'info',
          title: 'Configurações de SEO Incompletas',
          description: `A página "${page.name}" está sem Título SEO ou Meta Descrição configurados.`,
          suggestedFix: 'Gere um título otimizado e meta descrição atrativa para o Google.'
        });
      }

      // 4. Consistência do Header/Navbar em subpáginas
      if (!page.isHomepage && extractedHome.navbarHtml) {
        const pageExtracted = extractNavbarAndFooter(page.html || '');
        if (!pageExtracted.navbarHtml || pageExtracted.navbarHtml.length < 50) {
          totalScore -= 15;
          issues.push({
            id: `nav-${page.id}`,
            pageId: page.id,
            pageName: page.name,
            type: 'nav_inconsistency',
            severity: 'critical',
            title: 'Menu de Navegação (Navbar) Ausente ou Inconsistente',
            description: `A página "${page.name}" não possui o mesmo Header/Navbar que a página principal.`,
            suggestedFix: 'Replique a estrutura de Navbar padronizada com o logo e links ativos da página.'
          });
        }
      }

      // 5. Consistência do Rodapé
      if (!page.isHomepage && extractedHome.footerHtml) {
        const pageExtracted = extractNavbarAndFooter(page.html || '');
        if (!pageExtracted.footerHtml || pageExtracted.footerHtml.length < 50) {
          totalScore -= 10;
          issues.push({
            id: `footer-${page.id}`,
            pageId: page.id,
            pageName: page.name,
            type: 'nav_inconsistency',
            severity: 'warning',
            title: 'Rodapé (Footer) Desconectado do Tema',
            description: `A subpágina "${page.name}" não inclui o rodapé multicolunas institucional.`,
            suggestedFix: 'Insira o mesmo Footer institucional da Home para garantir navegabilidade.'
          });
        }
      }
    });

    const finalScore = Math.max(10, Math.min(100, totalScore));

    return res.json({
      healthScore: finalScore,
      status: finalScore >= 90 ? 'perfect' : finalScore >= 70 ? 'warnings' : 'critical',
      summary: issues.length === 0
        ? 'Todas as páginas estão 100% completas, alinhadas ao tema do projeto, com Navbar e Footer padronizados!'
        : `Encontrados ${issues.length} pontos de melhoria para deixar o site 100% profissional e sem erros.`,
      issues,
      pagesChecked: project.pages.length
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/autofix-site - Correção Automática de Erros e Inconsistências com IA
router.post('/autofix-site', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId é obrigatório' });
    }

    const provider = (req.headers['x-ai-provider'] as any) || 'gemini';
    const customApiKey = decodeHeader(req.headers['x-gemini-key']) || undefined;
    const customModel = decodeHeader(req.headers['x-gemini-model']) || undefined;
    const ollamaEndpoint = decodeHeader(req.headers['x-ollama-endpoint']) || undefined;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { pages: true }
    });

    if (!project || project.pages.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    const homePage = project.pages.find(p => p.isHomepage || p.slug === 'index') || project.pages[0];
    const { navbarHtml, footerHtml } = extractNavbarAndFooter(homePage.html || '');
    const globalCss = homePage.css || '';

    const navigationRoutes = project.pages.map(p => ({
      name: p.name,
      href: p.isHomepage ? 'index.html' : `${p.slug}.html`
    }));
    const navLinksDoc = navigationRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

    const updatedPages: any[] = [];

    for (const page of project.pages) {
      const isHome = page.id === homePage.id;

      const fixPrompt = `
Você é o Auditor de Qualidade e Desenvolvedor Sênior de IA do site "${project.name}".
Sua tarefa é CORRIGIR E FINALIZAR 100% a página "${page.name}" (slug: ${page.slug}).

INSTRUÇÃO DE AUDITORIA & QUALIDADE:
1. Elimine QUALQUER texto placeholder (Lorem ipsum, "Insira seu texto", "SEU NOME", "Empresa Exemplo").
2. Escreva textos altamente ricos, reais e focados na conversão do projeto "${project.name}" (Descrição: ${project.description || 'Serviços de excelência'}).
3. Corrija todos os links de botões e navegadores para usar as rotas reais:
${navLinksDoc}
4. Garanta que a Navbar e o Footer sejam EXATAMENTE os mesmos da página Home abaixo, mantendo as cores e identidade visual intactas.
${!isHome && navbarHtml ? `NAVBAR PADRÃO:\n${navbarHtml}\n` : ''}
${!isHome && footerHtml ? `FOOTER PADRÃO:\n${footerHtml}\n` : ''}

REGRAS DE SAÍDA:
- Retorne JSON estrito: { "html": "...", "css": "...", "js": "...", "explanation": "..." }
- Não coloque tags <style> ou <script> dentro do HTML.
- Mantenha ou adicione botão flutuante de WhatsApp e interatividade no JS.
      `;

      try {
        const resAi = await executeAIRequest(
          fixPrompt,
          { html: page.html || '<div></div>', css: page.css || globalCss, js: page.js || '' },
          { provider, apiKey: customApiKey, model: customModel, ollamaEndpoint }
        );

        const updated = await prisma.page.update({
          where: { id: page.id },
          data: {
            html: resAi.html,
            css: resAi.css || page.css,
            js: resAi.js || page.js,
            seoTitle: page.seoTitle || `${page.name} | ${project.name}`,
            seoDescription: page.seoDescription || `${page.name} oficial de ${project.name}. Conheça nossas soluções e entre em contato.`
          }
        });

        updatedPages.push(updated);
      } catch (err: any) {
        console.warn(`[Autofix] Falha na IA para a página ${page.name}:`, err.message);
        updatedPages.push(page);
      }
    }

    return res.json({
      message: 'Site corrigido e otimizado com sucesso pela IA!',
      updatedPages
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
      // Inicia com scraping virtual do HTML informado extraindo HTML, CSS e JS completos
      const targetBaseUrl = targetUrl || 'http://localhost';
      const code = await extractAndBundlePageComponents(rawHtml, targetBaseUrl);

      scrapeJobsQueue[jobId] = {
        status: 'completed',
        websiteUrl: targetUrl || 'HTML Direto',
        businessName: targetBusinessName,
        discoveredPages: [
          {
            name: 'Home',
            slug: 'index',
            url: targetBaseUrl,
            cleanText: rawHtml.replace(/<[^>]+>/g, ' ').slice(0, 3000),
            html: code.html || rawHtml,
            css: [rawCss || '', code.css || ''].filter(Boolean).join('\n\n'),
            js: code.js || '',
            media: detectMedia(rawHtml, targetBaseUrl),
            excerpt: rawHtml.replace(/<[^>]+>/g, ' ').slice(0, 180) + '...',
            isHomepage: true
          }
        ],
        progressMessage: 'HTML recebido e código original (HTML, CSS e JS) extraído com sucesso.'
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
    const customModel = decodeHeader(req.headers['x-ai-model'] || req.headers['x-ollama-model'] || req.headers['x-gemini-model']);
    const ollamaEndpoint = decodeHeader(req.headers['x-ollama-endpoint']);
    const lowSpecMode = req.headers['x-ollama-low-spec'] ? req.headers['x-ollama-low-spec'] === 'true' : undefined;

    // 4. Disparar geração em Background via Fila do Chat (AIQueueManager)
    const job = aiQueueManager.enqueue(
      project.id,
      'site_remaster',
      globalPrompt || 'Design moderno e profissional.',
      undefined,
      {
        businessName: projectName,
        pagesList: pages,
        sharedComponents: sharedComponents || { repeatNavbar: true, repeatFooter: true },
        customApiKey,
        registeredModels,
        customProxyUrl,
        customSkills,
        userId,
        aiProvider,
        ollamaEndpoint,
        customModel,
        lowSpecMode
      }
    );

    return res.status(201).json(project);
  } catch (error: any) {
    console.error('Erro ao iniciar geração remaster:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Remasterizar uma única página com IA (preservando frases e imagens)
router.post('/page/remaster', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { pageId, customPrompt } = req.body;
    const userId = req.userId as string;

    if (!pageId) {
      return res.status(400).json({ error: 'ID da página é obrigatório.' });
    }

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: true }
    });

    if (!page) {
      return res.status(404).json({ error: 'Página não encontrada.' });
    }

    const customApiKey = decodeHeader(req.headers['x-gemini-key']);
    const customProxyUrl = decodeHeader(req.headers['x-proxy-url']);
    const aiProvider = decodeHeader(req.headers['x-ai-provider']);
    const customModel = decodeHeader(req.headers['x-ai-model'] || req.headers['x-ollama-model']);
    const ollamaEndpoint = decodeHeader(req.headers['x-ollama-endpoint']);

    // Cria e enfileira a tarefa de remasterização na fila do projeto correspondente
    const job = aiQueueManager.enqueue(
      page.projectId,
      'page_remaster',
      customPrompt || 'Melhore o layout e estilo com Tailwind CSS de forma moderna, elegante e responsiva.',
      pageId,
      {
        provider: (aiProvider as any) || 'gemini',
        apiKey: customApiKey,
        model: customModel,
        proxyUrl: customProxyUrl,
        ollamaEndpoint: ollamaEndpoint
      }
    );

    return res.json({
      message: 'Remasterização adicionada à fila com sucesso!',
      queued: true,
      jobId: job.id
    });
  } catch (error: any) {
    console.error('Erro na remasterização da página:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/jobs/active - Obter job ativo para a página ou projeto
router.get('/jobs/active', async (req: AuthenticatedRequest, res: any) => {
  const { pageId, projectId } = req.query as { pageId?: string; projectId?: string };
  const activeJob = aiQueueManager.getActiveJob(projectId, pageId);
  
  if (activeJob) {
    return res.json({
      jobId: activeJob.id,
      status: activeJob.status,
      currentModel: activeJob.currentModel,
      projectId: activeJob.projectId,
      pageId: activeJob.pageId
    });
  }
  return res.json(null);
});

// GET /api/ai/jobs/:jobId/status - Obter status de um job de IA
router.get('/jobs/:jobId/status', async (req: AuthenticatedRequest, res: any) => {
  const { jobId } = req.params;
  const queueJob = aiQueueManager.getItemStatusGlobally(jobId);
  
  if (queueJob) {
    return res.json({
      status: queueJob.status,
      currentModel: queueJob.currentModel,
      provider: queueJob.options?.provider || 'gemini',
      scope: queueJob.scope || 'single',
      pageId: queueJob.pageId,
      projectId: queueJob.projectId,
      result: queueJob.result,
      error: queueJob.error
    });
  }
  return res.status(404).json({ error: 'Job não encontrado.' });
});

// GET /api/ai/queue/:projectId - Obter toda a fila de um projeto
router.get('/queue/:projectId', async (req: AuthenticatedRequest, res: any) => {
  const { projectId } = req.params;
  const queue = aiQueueManager.getQueueList(projectId);
  return res.json({ success: true, queue });
});

// POST /api/ai/queue/:projectId/clear - Limpar histórico de tarefas concluídas/falhas/canceladas
router.post('/queue/:projectId/clear', async (req: AuthenticatedRequest, res: any) => {
  const { projectId } = req.params;
  aiQueueManager.clearQueue(projectId);
  return res.json({ success: true, message: 'Fila limpa com sucesso!' });
});

// POST /api/ai/queue/:projectId/cancel/:itemId - Cancelar uma tarefa pendente ou em execução
router.post('/queue/:projectId/cancel/:itemId', async (req: AuthenticatedRequest, res: any) => {
  const { projectId, itemId } = req.params;
  aiQueueManager.cancelItem(projectId, itemId);
  return res.json({ success: true, message: 'Tarefa cancelada com sucesso!' });
});

export { router as aiRouter };
