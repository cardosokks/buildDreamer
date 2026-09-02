import { prisma } from '../db';
import { executeAIRequest } from './aiEngine';
import { AIQueueItem, aiQueueManager } from './aiQueueManager';
import { processPageAssets, extractAndBundlePageComponents, extractNavbarAndFooter } from './siteRemaster';

export async function executeSiteRemaster(item: AIQueueItem) {
  const { projectId, prompt, options = {} } = item;
  
  if (!projectId) throw new Error('ID do projeto é obrigatório para remasterização do site.');

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Projeto não encontrado.');

  const {
    businessName = project.name,
    globalPrompt = prompt,
    pagesList = [],
    sharedComponents = { repeatNavbar: true, repeatFooter: true },
    userId = project.ownerId,
    aiProvider,
    ollamaEndpoint,
    customModel,
    customProxyUrl,
    customApiKey,
    customSkills,
    optimizeTokens = true // Padrão agora é otimizar tokens
  } = options;

  if (!Array.isArray(pagesList) || pagesList.length === 0) {
    throw new Error('Nenhuma página fornecida para remasterização.');
  }

  const totalPages = pagesList.length;
  item.currentModel = `Preparando ${totalPages} página(s)...`;
  item.scope = 'all';

  // 1. Pre-processar assets (downloading to Minio) and create pages in DB
  const preparedPages: any[] = [];
  for (let i = 0; i < totalPages; i++) {
    const p = pagesList[i];
    item.currentModel = `Processando mídias e assets para a página ${p.name} (${i + 1}/${totalPages})...`;
    const targetOriginalUrl = p.originalUrl || p.url || '';
    const sourceHtml = p.html || p.rewrittenHtml || '';
    
    let rewrittenHtml = sourceHtml;
    if (sourceHtml && targetOriginalUrl) {
      try {
        // This handles downloading images/videos and uploading them to Minio
        rewrittenHtml = await processPageAssets(sourceHtml, targetOriginalUrl, new Map(), userId, projectId);
      } catch (assetErr) {
        console.warn(`[SiteRemasterQueue] Não foi possível reescrever mídias da página ${p.name}:`, assetErr);
      }
    }

    const rawHtmlToUse = rewrittenHtml || p.html || p.cleanText || '';
    const context = await extractAndBundlePageComponents(rawHtmlToUse, targetOriginalUrl, customProxyUrl);
    
    const finalHtml = context.html || rawHtmlToUse;
    // Otimização: Se optimizeTokens for true, omitimos o CSS externo gigante do banco na fase inicial, 
    // ou mantemos, mas não enviaremos para a IA
    const finalCss = [p.css || '', context.css || ''].filter(Boolean).join('\n\n');
    const finalJs = [p.js || '', context.js || ''].filter(Boolean).join('\n\n');

    // Create page in database immediately so it exists
    const createdPage = await prisma.page.create({
      data: {
        projectId,
        name: p.name,
        slug: p.slug,
        isHomepage: p.isHomepage || false,
        html: finalHtml,
        css: finalCss,
        js: finalJs
      }
    });

    preparedPages.push({
      ...p,
      html: finalHtml,
      css: finalCss,
      js: finalJs,
      dbId: createdPage.id
    });
  }

  let homePage = preparedPages.find(p => p.isHomepage || p.slug === 'index') || preparedPages[0];
  const subPages = preparedPages.filter(p => p !== homePage);

  const allNavigationRoutes = [
    { name: homePage.name || 'Home', href: 'index.html' },
    ...subPages.map(p => ({ name: p.name, href: `${p.slug}.html` }))
  ];
  const navigationLinksText = allNavigationRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

  // 2. Generate Home Page
  item.currentModel = `Remasterizando página 1 de ${totalPages} (${homePage.name})...`;
  const homePrompt = `
    Você é o Arquiteto Frontend Líder e Designer Master.
    Estamos remasterizando o site "${businessName}".

    DIRETRIZ VISUAL:
    """
    ${globalPrompt}
    """
    
    ESTRUTURA ORIGINAL DA HOME:
    HTML:
    """
    ${homePage.html}
    """

    ${!optimizeTokens ? `
    CSS ORIGINAL:
    """
    ${homePage.css}
    """
    ` : ''}

    REGRAS INEGOCIÁVEIS:
    1. NÃO INVENTE TEXTOS OU IMAGENS FAKES. Mantenha integralmente as mídias (tags <img> e background-images) originais, frases e contatos.
    2. GERE APENAS HTML, CSS (Tailwind) e JS funcional, sem comentários ou retórica.
    3. Retorne no formato de objeto JSON com chaves "html", "css" e "js".
    4. Crie uma Navbar e Footer responsivos com os links:
    ${navigationLinksText}
  `;

  let homeResult;
  try {
    homeResult = await executeAIRequest(homePrompt, { html: '', css: '', js: '' }, {
      provider: aiProvider || 'gemini',
      apiKey: customApiKey,
      model: customModel,
      proxyUrl: customProxyUrl,
      ollamaEndpoint: ollamaEndpoint,
      customSkills: customSkills
    });

    if (homeResult.html) {
      await prisma.page.update({
        where: { id: homePage.dbId },
        data: {
          html: homeResult.html,
          css: homeResult.css || '',
          js: homeResult.js || ''
        }
      });
      homePage.html = homeResult.html;
      homePage.css = homeResult.css;
      homePage.js = homeResult.js;
    }
  } catch (err: any) {
    throw new Error(`Falha na geração da Home: ${err.message}`);
  }

  let extractedNavbar = '';
  let extractedFooter = '';

  if (sharedComponents.repeatNavbar || sharedComponents.repeatFooter) {
    item.currentModel = `Extraindo Navbar e Footer da Home para reaproveitamento...`;
    const extractPrompt = `
      Você receberá um código HTML de uma página inicial recém-criada.
      Extraia EXATAMENTE os elementos de Navbar (<nav> ou <header>) e Footer (<footer>).
      Retorne em formato JSON estrito: { "navbar": "<código html da navbar>", "footer": "<código html do footer>" }
      
      HTML DA HOME:
      """
      ${homePage.html}
      """
    `;
    
    try {
      const extRes = await executeAIRequest(extractPrompt, { html: '', css: '', js: '' }, {
        provider: aiProvider || 'gemini',
        apiKey: customApiKey,
        model: customModel,
        proxyUrl: customProxyUrl,
        ollamaEndpoint: ollamaEndpoint
      }) as any;
      extractedNavbar = extRes.navbar || '';
      extractedFooter = extRes.footer || '';
    } catch (e) {
      console.warn('[SiteRemaster] Falha ao extrair navbar/footer via IA, usando fallback regex.', e);
    }

    if (!extractedNavbar || !extractedFooter) {
      const fallbackExtracted = extractNavbarAndFooter(homePage.html);
      if (!extractedNavbar) extractedNavbar = fallbackExtracted.navbarHtml;
      if (!extractedFooter) extractedFooter = fallbackExtracted.footerHtml;
    }
  }

  // 3. Generate SubPages using the AI Queue Manager (individual jobs for better tracking and load distribution)
  for (let idx = 0; idx < subPages.length; idx++) {
    const sub = subPages[idx];
    item.currentModel = `Enfileirando remasterização da página ${idx + 2} de ${totalPages} (${sub.name})...`;
    
    aiQueueManager.enqueue(
      projectId,
      'page_remaster',
      globalPrompt,
      sub.dbId,
      {
        customPrompt: sub.customPrompt,
        extractedNavbar,
        extractedFooter,
        optimizeTokens,
        provider: aiProvider || 'gemini',
        apiKey: customApiKey,
        model: customModel,
        proxyUrl: customProxyUrl,
        ollamaEndpoint: ollamaEndpoint,
        customSkills: customSkills
      }
    );
  }

  item.status = 'completed';
  item.currentModel = 'Páginas enfileiradas com sucesso!';
  
  // Update result payload so the UI knows we're done
  item.result = {
    explanation: `Home gerada e ${subPages.length} subpáginas enviadas para a fila com sucesso. Os arquivos originais foram mantidos no MinIO.`,
    _usedModel: customModel || 'default',
    _usedProvider: aiProvider || 'gemini'
  };
}
