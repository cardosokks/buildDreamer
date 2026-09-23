import { prisma } from '../db';
import { executeAIRequest } from './aiEngine';
import { executeSiteRemaster } from './siteRemasterWorker';
import {
  processPageAssets,
  extractNavbarAndFooter,
  ensureAndDeduplicateGlobalElements,
  buildFallbackSubpageHtml,
  generateAutomaticClientTheme,
  generateGlobalThemeElements
} from './siteRemaster';
import { buildStructuredSitePrompt } from '../../front-end/src/utils/promptEngine';

export interface AIQueueItem {
  id: string;
  projectId: string;
  type: 'chat_edit' | 'page_remaster' | 'site_remaster' | 'site_generation';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  pageId?: string;
  currentModel?: string;
  error?: string;
  retryCount?: number;
  result?: {
    action_type?: string;
    explanation: string;
    html?: string;
    css?: string;
    js?: string;
    navigation?: any;
    settings?: any;
    _usedModel?: string;
    _usedProvider?: string;
    updatedPages?: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }>;
  };
  scope?: 'single' | 'all';
  createdAt: Date;
  updatedAt: Date;
  options?: any;
}

export function parsePageSections(html: string): { wrapperOpen: string; sections: string[]; wrapperClose: string } {
  let innerHtml = html.trim();
  let wrapperOpen = '';
  let wrapperClose = '';

  // Detect and extract outer wrapper
  const wrapperRegex = /^(<div\s+[^>]*id=["'](?:page-wrapper|canvas-root)["'][^>]*>)([\s\S]*)(<\/div>)$/i;
  const match = innerHtml.match(wrapperRegex);
  if (match) {
    wrapperOpen = match[1];
    innerHtml = match[2].trim();
    wrapperClose = match[3];
  } else {
    // If not matching completely with start/end, try a simpler regex search for wrapper start
    const wrapperStartRegex = /^(<div\s+[^>]*id=["'](?:page-wrapper|canvas-root)["'][^>]*>)/i;
    const startMatch = innerHtml.match(wrapperStartRegex);
    if (startMatch) {
      wrapperOpen = startMatch[1];
      innerHtml = innerHtml.slice(wrapperOpen.length).trim();
      if (innerHtml.endsWith('</div>')) {
        wrapperClose = '</div>';
        innerHtml = innerHtml.slice(0, -6).trim();
      }
    }
  }

  // Split innerHtml into top-level tags
  const sections: string[] = [];
  let index = 0;
  
  // A simple and bulletproof scanner for top-level tags
  while (index < innerHtml.length) {
    // Find next non-whitespace char
    const char = innerHtml[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (char === '<') {
      // Find the tag name
      const tagStart = index;
      const nextSpaceOrClose = innerHtml.indexOf(' ', tagStart);
      const nextClose = innerHtml.indexOf('>', tagStart);
      
      let tagEndIndex = nextClose;
      if (nextSpaceOrClose !== -1 && nextSpaceOrClose < nextClose) {
        tagEndIndex = nextSpaceOrClose;
      }
      
      if (tagEndIndex === -1) {
        // Corrupted HTML, just grab remainder
        sections.push(innerHtml.slice(tagStart));
        break;
      }

      const tagName = innerHtml.slice(tagStart + 1, tagEndIndex).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // If it's a comment or doctype, skip or grab it
      if (tagName.startsWith('!') || tagName.startsWith('?')) {
        const commentEnd = innerHtml.indexOf('-->', tagStart);
        if (commentEnd !== -1) {
          index = commentEnd + 3;
        } else {
          index = innerHtml.length;
        }
        continue;
      }

      // We need to find the matching closing tag for this tagName at the top level
      // By keeping track of nested same-name tags
      let depth = 1;
      let scanIndex = nextClose + 1;
      const openTagPattern = new RegExp(`<${tagName}\\b`, 'i');
      const closeTagPattern = new RegExp(`</${tagName}>`, 'i');

      while (scanIndex < innerHtml.length && depth > 0) {
        // Check if there is an open or close tag next
        const remaining = innerHtml.slice(scanIndex);
        const nextOpen = remaining.search(openTagPattern);
        const nextCloseTag = remaining.search(closeTagPattern);

        if (nextCloseTag === -1) {
          // No closing tag found, grab until the end
          scanIndex = innerHtml.length;
          break;
        }

        if (nextOpen !== -1 && nextOpen < nextCloseTag) {
          depth++;
          scanIndex += nextOpen + tagName.length + 1;
        } else {
          depth--;
          scanIndex += nextCloseTag + tagName.length + 3;
        }
      }

      const sectionContent = innerHtml.slice(tagStart, scanIndex);
      if (sectionContent.trim()) {
        sections.push(sectionContent);
      }
      index = scanIndex;
    } else {
      // Plain text or text node at top level (e.g. text between sections)
      const nextTag = innerHtml.indexOf('<', index);
      if (nextTag !== -1) {
        const textNode = innerHtml.slice(index, nextTag).trim();
        if (textNode) {
          sections.push(`<div>${textNode}</div>`); // Wrap it safely
        }
        index = nextTag;
      } else {
        const textNode = innerHtml.slice(index).trim();
        if (textNode) {
          sections.push(`<div>${textNode}</div>`);
        }
        break;
      }
    }
  }

  // Fallback if no sections were parsed
  if (sections.length === 0 && innerHtml) {
    sections.push(innerHtml);
  }

  return { wrapperOpen, sections, wrapperClose };
}

class ProjectQueue {
  projectId: string;
  items: AIQueueItem[] = [];
  processing: boolean = false;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  enqueue(item: AIQueueItem) {
    this.items.push(item);
    this.processNext();
  }

  cancel(itemId: string) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      if (item.status === 'pending') {
        item.status = 'cancelled';
        item.updatedAt = new Date();
      } else if (item.status === 'processing') {
        // Can mark as cancelled, though the actual request might still be running in the background.
        // The worker will handle cleanup upon finishing.
        item.status = 'cancelled';
        item.updatedAt = new Date();
      }
    }
  }

  clear() {
    // Keep pending and processing items, clear completed/failed/cancelled
    this.items = this.items.filter(i => i.status === 'pending' || i.status === 'processing');
  }

  async processNext() {
    if (this.processing) return;

    const nextItem = this.items.find(item => item.status === 'pending');
    if (!nextItem) return;

    this.processing = true;
    nextItem.status = 'processing';
    nextItem.updatedAt = new Date();

    try {
      console.log(`[AIQueueManager] Iniciando processamento do item ${nextItem.id} (tipo: ${nextItem.type}) para o projeto ${this.projectId}`);
      await this.executeItem(nextItem);
      
      // Se foi cancelado enquanto rodava, não mude para completed
      if (nextItem.status === 'processing') {
        nextItem.status = 'completed';
      }
    } catch (err: any) {
      console.error(`[AIQueueManager] Erro no item ${nextItem.id} para o projeto ${this.projectId}:`, err);
      
      const isTransient = /503|429|500|502|504|high demand|temporary|econnreset|etimedout/i.test(err.message || '');
      const currentRetry = nextItem.retryCount || 0;

      // Se for erro temporário de API ou rede e ainda tiver retentativas
      if ((nextItem.status as string) !== 'cancelled' && isTransient && currentRetry < 2) {
        nextItem.retryCount = currentRetry + 1;
        nextItem.status = 'pending';
        console.warn(`[AIQueueManager] Re-agendando item ${nextItem.id} (tentativa ${nextItem.retryCount}/2) após erro temporário da API.`);
      } else if ((nextItem.status as string) !== 'cancelled') {
        nextItem.status = 'failed';
        nextItem.error = err.message || 'Erro imprevisto ao processar a requisição de IA.';
      }
    } finally {
      nextItem.updatedAt = new Date();
      this.processing = false;
      // Pequeno delay antes de rodar o próximo
      setTimeout(() => this.processNext(), 200);
    }
  }

  private async executeItem(item: AIQueueItem) {
    if (item.type === 'chat_edit') {
      await this.executeChatEdit(item);
    } else if (item.type === 'page_remaster') {
      await this.executePageRemaster(item);
    } else if (item.type === 'site_remaster') {
      await executeSiteRemaster(item);
    } else if (item.type === 'site_generation') {
      await this.executeSiteGeneration(item);
    } else {
      throw new Error(`Tipo de tarefa desconhecido: ${item.type}`);
    }
  }

  private async resolveApiKeyAndSettings(projectId: string, customApiKey?: string) {
    // 1. Tentar buscar a chave salva no banco de dados do dono do projeto primeiro
    try {
      const proj = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true }
      });
      if (proj?.ownerId) {
        const user = await prisma.user.findUnique({
          where: { id: proj.ownerId },
          select: { geminiApiKey: true }
        });
        if (user?.geminiApiKey) {
          const dbKey = user.geminiApiKey.trim();
          if (dbKey.length > 5 && dbKey !== 'undefined' && dbKey !== 'null') {
            return dbKey;
          }
        }
      }
    } catch {}

    // 2. Se não houver no banco, usar o customApiKey passado (desde que válido e não string 'undefined'/'null')
    if (customApiKey) {
      const rawKey = customApiKey.trim();
      if (rawKey.length > 5 && rawKey !== 'undefined' && rawKey !== 'null') {
        return rawKey;
      }
    }

    // 3. Fallback para variável de ambiente
    return process.env.GEMINI_API_KEY;
  }

  private async executeSiteGeneration(item: AIQueueItem) {
    const { projectId, prompt, options = {} } = item;
    if (!projectId) throw new Error('ID do projeto é obrigatório para geração de site.');

    const {
      customApiKey,
      customModel,
      registeredModels,
      customProxyUrl,
      customSkills,
      aiProvider,
      ollamaEndpoint,
      lowSpecMode,
      pagesToGenerate = [],
      businessName,
      segment,
      visualStyle,
      colorPalette,
      heroLayout,
      sectionTransitions,
      digitalFeatures,
      extraInstructions
    } = options;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { leads: true }
    });

    const attachedLead = (project?.leads && project.leads.length > 0) ? project.leads[0] : null;
    const leadInfo = attachedLead ? {
      phone: attachedLead.phone || undefined,
      address: attachedLead.address || undefined,
      openingHours: 'Segunda a Sábado: 08:00 - 20:00',
      rating: attachedLead.rating || '5.0',
      reviewsCount: 128,
      website: attachedLead.website || undefined,
      email: attachedLead.email || undefined
    } : undefined;

    const resolvedApiKey = await this.resolveApiKeyAndSettings(projectId, customApiKey);
    const resolvedBusinessName = (businessName || '').trim() || attachedLead?.name || project?.name || 'Sua Empresa';
    const resolvedSegment = (segment || '').trim() || attachedLead?.company || 'Serviços Profissionais';

    // SÍNTESE AUTOMÁTICA DE TEMA INTELIGENTE BASEADO NO CLIENTE E SEGMENTO
    const autoTheme = generateAutomaticClientTheme(resolvedBusinessName, resolvedSegment, project?.description || '');

    const resolvedStyle = (visualStyle || '').trim() || autoTheme.visualStyle;
    const resolvedPalette = (colorPalette || '').trim() || project?.colorPalette || autoTheme.colorPalette;

    let brandDirective = "";
    if (project) {
      brandDirective = `
\n[REGRAS CRÍTICAS DE IDENTIDADE DA MARCA E DESIGN SYSTEM AUTORAL AUTOMÁTICO]
Você DEVE aplicar rigorosamente o tema derivado automaticamente para "${project.name}" (Segmento: ${resolvedSegment}):
- Nome da Marca / Site: "${project.name}"
${project.logoUrl ? `- Logotipo Oficial: "${project.logoUrl}" (Insira a imagem de forma responsiva nos cabeçalhos e navbar: <img src="${project.logoUrl}" referrerPolicy="no-referrer" alt="${project.name}" class="h-8 md:h-10 object-contain tracking-tight">)` : '- Logotipo: Use um logotipo baseado em texto/tipografia estilizada com o nome do site'}
- Contatos Oficiais: Telefone / WhatsApp "${attachedLead?.phone || project.contacts || 'Não especificado'}" | E-mail: "${attachedLead?.email || project.email || 'Não especificado'}"

- TEMA AUTOMÁTICO SINTETIZADO PARA O CLIENTE (${autoTheme.name}):
  • Estilo Visual: ${resolvedStyle}
  • Paleta de Cores Recomendada: ${resolvedPalette}
  • Tipografia Recomendada: ${autoTheme.typography}
  • Diretrizes de UI: Crie uma hierarquia visual sofisticada com fundo imersivo (${autoTheme.bgGradient}), superfícies translúcidas em Glassmorphism, badges em tom (${autoTheme.badgeStyle}) e botões de ação em destaque com brilho sutil (${autoTheme.accentGlow}).
`;
    }

    // 1. Obter todas as páginas existentes no banco de dados para o projeto
    let existingPages = await prisma.page.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' }
    });

    // Se pagesToGenerate foi fornecido, cria no banco quaisquer páginas que ainda não existam
    if (Array.isArray(pagesToGenerate) && pagesToGenerate.length > 0) {
      for (let i = 0; i < pagesToGenerate.length; i++) {
        const p = pagesToGenerate[i];
        const isHome = !!p.isHomepage || p.slug === 'index' || i === 0;
        const pageSlug = p.slug || (isHome ? 'index' : (p.name ? p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `page-${i + 1}`));
        const pageName = p.name || (isHome ? 'Home' : `Página ${i + 1}`);

        const alreadyExists = existingPages.some(ep => ep.slug === pageSlug || (isHome && ep.isHomepage));
        if (!alreadyExists) {
          const created = await prisma.page.create({
            data: {
              projectId,
              name: pageName,
              slug: pageSlug,
              title: pageName,
              isHomepage: isHome,
              html: '<div class="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8"><h2 class="text-2xl font-bold mb-2">Gerando página...</h2><p class="text-slate-400 text-sm">Construindo layout profissional com IA.</p></div>',
              css: 'body { margin: 0; font-family: sans-serif; }',
              js: ''
            }
          });
          existingPages.push(created);
        }
      }
    }

    if (existingPages.length === 0) {
      const home = await prisma.page.create({
        data: {
          projectId,
          name: 'Home',
          slug: 'index',
          title: 'Home',
          isHomepage: true,
          html: '<div class="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8"><h2 class="text-2xl font-bold mb-2">Gerando página...</h2><p class="text-slate-400 text-sm">Construindo layout profissional com IA.</p></div>',
          css: 'body { margin: 0; font-family: sans-serif; }',
          js: ''
        }
      });
      existingPages.push(home);
    }

    // Garantir que qualquer geração de site crie uma arquitetura completa com subpáginas (Sobre Nós, Serviços, Contato, FAQ)
    if (existingPages.length <= 1) {
      const defaultSubpages = [
        { name: 'Sobre Nós', slug: 'sobre', title: 'Sobre Nós' },
        { name: 'Serviços', slug: 'servicos', title: 'Serviços' },
        { name: 'Contato', slug: 'contato', title: 'Contato' },
        { name: 'FAQ', slug: 'faq', title: 'FAQ' }
      ];

      for (const sp of defaultSubpages) {
        const alreadyExists = existingPages.some(ep => ep.slug === sp.slug);
        if (!alreadyExists) {
          const created = await prisma.page.create({
            data: {
              projectId,
              name: sp.name,
              slug: sp.slug,
              title: sp.title,
              isHomepage: false,
              html: '<div class="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8"><h2 class="text-2xl font-bold mb-2">Gerando página...</h2><p class="text-slate-400 text-sm">Construindo layout profissional com IA.</p></div>',
              css: 'body { margin: 0; font-family: sans-serif; }',
              js: ''
            }
          });
          existingPages.push(created);
        }
      }
    }

    const homePage = existingPages.find(p => p.isHomepage || p.slug === 'index') || existingPages[0];
    const subPages = existingPages.filter(p => p.id !== homePage.id);
    const totalPages = 1 + subPages.length;

    item.scope = totalPages > 1 ? 'all' : 'single';
    item.currentModel = `Iniciando geração do site (${totalPages} página${totalPages > 1 ? 's' : ''})...`;

    // 2. Mapeamento de rotas de navegação para interligação perfeita entre páginas
    const navigationRoutes = [
      { name: homePage.name || 'Home', href: 'index.html', slug: homePage.slug },
      ...subPages.map(p => ({ name: p.name, href: `${p.slug}.html`, slug: p.slug }))
    ];
    const navLinksDoc = navigationRoutes.map(r => `- "${r.name}" -> href="${r.href}"`).join('\n');

    // 3. CONSTRUÇÃO DO PROMPT MESTRE ESTRUTURADO (SE NÃO FOR PRÉ-COMPILADO)
    let masterStructuredPrompt = prompt;
    if (!masterStructuredPrompt || !masterStructuredPrompt.includes('SISTEMA MESTRE DE GERAÇÃO')) {
      masterStructuredPrompt = buildStructuredSitePrompt({
        businessName: resolvedBusinessName,
        segment: resolvedSegment,
        visualStyle: resolvedStyle,
        colorPalette: resolvedPalette,
        heroLayout: (heroLayout as any) || 'auto',
        sectionTransitions: (sectionTransitions as any) || 'auto',
        pagesList: existingPages.map(p => ({
          name: p.name,
          slug: p.slug,
          isHomepage: p.isHomepage
        })),
        digitalFeatures: Array.isArray(digitalFeatures) && digitalFeatures.length > 0
          ? digitalFeatures
          : ['swiper_3d', 'realtime_status', 'floating_whatsapp', 'pricing_toggle', 'animated_counters', 'faq_search', 'lead_confetti', 'interactive_map'],
        extraInstructions: extraInstructions || prompt,
        leadInfo
      });
    }

    // 4. SÍNTESE DEDICADA DOS ELEMENTOS GLOBAIS NO TEMA PROPOSTO (NAVBAR, FOOTER E ITENS GLOBAIS) EM REQUISIÇÕES SEPARADAS
    item.currentModel = `Sintetizando elementos globais no tema proposto (Navbar, Footer, Widgets)...`;
    const globalElements = await generateGlobalThemeElements({
      businessName: resolvedBusinessName,
      theme: resolvedPalette || autoTheme,
      logoUrl: project?.logoUrl || undefined,
      contacts: attachedLead?.phone || project?.contacts || undefined,
      email: attachedLead?.email || project?.email || undefined,
      segment: resolvedSegment,
      visualStyle: resolvedStyle,
      navigationRoutes,
      aiProvider: (aiProvider as any) || 'gemini',
      apiKey: resolvedApiKey,
      model: customModel,
      registeredModels,
      proxyUrl: customProxyUrl,
      ollamaEndpoint,
      lowSpecMode
    });

    const navbarHtml = globalElements.navbarHtml;
    const footerHtml = globalElements.footerHtml;
    const globalItemsHtml = globalElements.globalItemsHtml;

    // 5. GERAÇÃO DA HOME (PÁGINA 1 - ESCOPO DEDICADO)
    item.currentModel = `Construindo Página Inicial (1/${totalPages})...`;

    const homePrompt = `
Você é um Arquiteto de Software Frontend de Elite e Designer UI/UX Master (nível Webflow, Framer, Tailwind UI).
Sua missão é projetar o CONTEÚDO PRINCIPAL da PÁGINA INICIAL (HOME) para "${resolvedBusinessName}".

${masterStructuredPrompt}

[ELEMENTOS GLOBAIS JÁ SINTETIZADOS NO TEMA DO PROJETO]:
A Navbar, o Footer e os Widgets globais já foram gerados com as características e cores do tema do site em requisições separadas e serão anexados automaticamente.
Foque a geração no CONTEÚDO PRINCIPAL dentro da tag <main class="flex-grow"> (Hero impactante, Seção de Recursos/Bento Grid, Prova Social, Preços/Planos, FAQ e CTA de conversão).

ROTAS DE NAVEGAÇÃO DO SITE:
${navLinksDoc}

SAÍDA TÉCNICA OBRIGATÓRIA (JSON VÁLIDO COM SEPARAÇÃO ESTRITA):
Retorne EXCLUSIVAMENTE um objeto JSON no formato:
{
  "html": "<!-- APENAS estrutura HTML sem tags <style> ou <script>. Adicione a classe 'gsap-reveal' nos blocos e cards para animação de scroll -->",
  "css": "/* Todo CSS customizado, regras @keyframes de animação, gradientes glow e variáveis aqui. NUNCA coloque tags <style> */",
  "js": "// Todo JavaScript funcional aqui. NUNCA coloque tags <script>. Inclua código ativo para: (1) Animações GSAP ScrollTrigger para elementos .gsap-reveal; (2) Sliders Swiper 3D; (3) Ícones Lucide (lucide.createIcons()); (4) Menu mobile responsivo; (5) FAQ accordions; (6) Contadores animados; (7) Confetti. IMPORTANTE: Execute imediatamente se document.readyState !== 'loading' para garantir animações ativas no canvas.",
  "explanation": "Resumo do que foi construído nesta página inicial."
}
${brandDirective}
`;

    let homeAiResponse: any = null;

    try {
      homeAiResponse = await executeAIRequest(
        homePrompt,
        { html: homePage.html, css: homePage.css, js: homePage.js },
        {
          provider: (aiProvider as any) || 'gemini',
          apiKey: resolvedApiKey,
          model: customModel,
          registeredModels,
          proxyUrl: customProxyUrl,
          ollamaEndpoint,
          lowSpecMode,
          customSkills,
          onProgress: (info) => {
            item.currentModel = `Home: ${info.model || info.status}`;
          }
        }
      );
    } catch (homeAiErr: any) {
      console.warn(`[AIQueueManager] Chamada de IA para a Home falhou (${homeAiErr.message}). Interrompendo processo.`);
      throw homeAiErr;
    }

    if ((item.status as string) === 'cancelled') return;

    let updatedHomeHtml = homeAiResponse.html || homePage.html;

    // Garantir que a Home possui obrigatoriamente Navbar no topo, Footer no rodapé e Itens Globais, 100% no tema proposto
    updatedHomeHtml = ensureAndDeduplicateGlobalElements(
      updatedHomeHtml,
      navbarHtml,
      footerHtml,
      'index',
      navigationRoutes,
      globalItemsHtml
    );

    const updatedHomeCss = homeAiResponse.css || homePage.css;
    const updatedHomeJs = homeAiResponse.js || homePage.js;

    await prisma.page.update({
      where: { id: homePage.id },
      data: {
        html: updatedHomeHtml,
        css: updatedHomeCss,
        js: updatedHomeJs
      }
    });

    const updatedPagesList: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }> = [
      {
        id: homePage.id,
        name: homePage.name,
        slug: homePage.slug,
        html: updatedHomeHtml,
        css: updatedHomeCss,
        js: updatedHomeJs
      }
    ];

    // 4. GERAÇÃO SEQUENCIAL DAS SUBPÁGINAS (CADA PÁGINA COM SEU ESCOPO DEDICADO DE REQUISIÇÃO IA)
    for (let idx = 0; idx < subPages.length; idx++) {
      if ((item.status as string) === 'cancelled') return;

      const sub = subPages[idx];
      const pageNum = idx + 2;
      item.currentModel = `Construindo ${sub.name} (${pageNum}/${totalPages}) - Escopo Dedicado...`;

      let subpageScopeInstructions = '';
      const lowerSubName = (sub.name + ' ' + sub.slug).toLowerCase();

      if (lowerSubName.includes('sobre') || lowerSubName.includes('about') || lowerSubName.includes('quem')) {
        subpageScopeInstructions = `
ESTRUTURA DENSE E COMPLETA DA PÁGINA SOBRE NÓS:
1. HERO INSTITUCIONAL: Manifesto inspirador, propósito e história de fundação da ${resolvedBusinessName}.
2. LINHA DO TEMPO / EVOLUÇÃO HISTÓRICA: Marcos de crescimento, anos de atuação e conquistas do negócio.
3. PILARES & VALORES FUNDAMENTAIS: 4 cards com ícones Lucide glowing e descrições detalhadas.
4. CORPO EXECUTIVO E EQUIPE: Cards de liderança com imagens de alta definição (Unsplash), nomes, cargos e minibios.
5. CONQUISTAS & MÉTRICAS EM NÚMEROS: +10k clientes, 99.8% satisfação, cobertura nacional.
6. CHAMADA PARA AÇÃO (CTA SOBRE): Concatenação para entrar em contato ou explorar nossos serviços.
        `;
      } else if (lowerSubName.includes('servi') || lowerSubName.includes('service') || lowerSubName.includes('solu')) {
        subpageScopeInstructions = `
ESTRUTURA DENSE E COMPLETA DA PÁGINA DE SERVIÇOS & SOLUÇÕES:
1. HERO DE SERVIÇOS: Título de alto impacto focado nos problemas resolvidos e entregáveis para o cliente.
2. CATÁLOGO COMPLETO DE SERVIÇOS: Grade rica de cartões detalhados contendo ícones, tags de categoria, descrição profunda, lista de entregáveis (✓) e botão para solicitar orçamento.
3. METODOLOGIA EM 4 ETAPAS ("Como Funciona"): Diagnóstico -> Planejamento -> Execução -> Resultados.
4. TABELA DE DIFERENCIAIS TÉCNICOS & GARANTIA DE QUALIDADE.
5. CTA COMERCIAL DEDICADO: Formulário rápido ou botão direto para proposta comercial personalizada.
        `;
      } else if (lowerSubName.includes('contat') || lowerSubName.includes('contact') || lowerSubName.includes('fale') || lowerSubName.includes('local')) {
        subpageScopeInstructions = `
ESTRUTURA DENSE E COMPLETA DA PÁGINA DE CONTATO & ATENDIMENTO:
1. HERO DE CONTATO: "Canais oficiais de atendimento e suporte humanizado".
2. FORMULÁRIO INTERATIVO DE CONTATO COMPLETO: Campos para Nome, E-mail, Telefone/WhatsApp, Assunto e Mensagem com validação JS e feedback de envio.
3. CARDS DE ATENDIMENTO DIRETO: Botão em destaque para WhatsApp (wa.me), Telefone comercial, E-mail oficial, Endereço físico e Horário de funcionamento.
4. EMBED DE MAPA INTERATIVO / LOCALIZAÇÃO VISUAL.
5. FAQ RÁPIDO DE ATENDIMENTO.
        `;
      } else if (lowerSubName.includes('faq') || lowerSubName.includes('duvid') || lowerSubName.includes('ajuda')) {
        subpageScopeInstructions = `
ESTRUTURA DENSE E COMPLETA DA PÁGINA DE FAQ & CENTRAL DE AJUDA:
1. HERO DE SUPORTE: Barra de pesquisa interativa em JS para filtragem de perguntas em tempo real.
2. ACCORDION COMPLETO DE PERGUNTAS & RESPOSTAS: Categorizado por seções (Geral, Serviços, Prazos, Pagamentos).
3. SCRIPT JS DE ACCORDION INTERATIVO: Abertura e fechamento fluido das respostas com rotação do ícone.
4. BANNER DE SUPORTE DIRETO: Link para atendimento via WhatsApp com consultor.
        `;
      } else {
        subpageScopeInstructions = `
ESTRUTURA DENSE E COMPLETA DA PÁGINA "${sub.name}":
1. HERO EXCLUSIVO COM TÍTULO E SUBTÍTULO IMPACTANTE.
2. CONTEÚDO RICO EM SEÇÕES BENTO GRID, CARDS INFORMATIVOS E ILUSTRAÇÕES DE ALTA QUALIDADE.
3. RECURSOS DEDICADOS E TABELAS/LISTAS RELEVANTES PARA "${sub.name}".
4. CHAMADA PARA AÇÃO (CTA) PERSUASIVA AO FINAL.
        `;
      }

      const subPrompt = `
Você é o Arquiteto Frontend Líder do projeto "${resolvedBusinessName}".
Sua missão é gerar O CONTEÚDO CORPO EXCLUSIVO, COMPLETO E APROFUNDADO da página "${sub.name}" (slug: /${sub.slug}).

ATENÇÃO ABSOLUTA ÀS INSTRUÇÕES DE ESCOPO E DENSIDADE:
- Concentre 100% da sua capacidade de tokens na geração do CONTEÚDO ESPECÍFICO RICO da página (entre o Header e o Footer).
- NÃO GERE a Navbar e NÃO GERE o Footer no HTML. A plataforma injetará automaticamente a Navbar e o Footer mestre oficiais do projeto ao redor do seu código.

ESTILO VISUAL & PALETA DA MARCA:
${resolvedStyle} | ${resolvedPalette}

DIRETRIZ MANDATÓRIA DE ANTI-LAYOUT RETO EM 100% DAS SEÇÕES:
- É PROIBIDO utilizar seções com divisões quadradas, retas ou blocos planos simples!
- CADA UMA DAS SEÇÕES DESTA PÁGINA (Hero da subpágina, Conteúdos, Galeria, Cards, Tabela, FAQ, CTA, etc.) DEVE OBRIGATORIAMENTE utilizar elementos de quebra de layout reto: divisores SVG de transição orgânica (ondas "wave", cortes diagonais slants ou curvas fluídas), cartões flutuantes sobrepostos (-mt-12 sm:-mt-20 relative z-20) e Bento Grids com cantos arredondados (rounded-2xl/3xl) e luzes radiais em gradiente.

REQUISITOS E CONTEÚDO OBRIGATÓRIO DESTA PÁGINA:
${subpageScopeInstructions}

ROTAS DE NAVEGAÇÃO DO SITE PARA CONTEXTO:
${navLinksDoc}

SAÍDA TÉCNICA OBRIGATÓRIA (JSON VÁLIDO COM SEPARAÇÃO ESTRITA):
Retorne EXCLUSIVAMENTE um objeto JSON no formato:
{
  "html": "<!-- APENAS estrutura HTML com classes Tailwind. NUNCA coloque tags <style> ou <script> aqui. Adicione a classe 'gsap-reveal' nos blocos e cards para animação de scroll -->",
  "css": "/* Todo CSS customizado, regras @keyframes de animação, gradientes glow e variáveis aqui. NUNCA coloque tags <style> */",
  "js": "// Todo JavaScript funcional aqui. NUNCA coloque tags <script>. Inclua código ativo para: (1) Animações GSAP ScrollTrigger para elementos .gsap-reveal; (2) Sliders Swiper 3D; (3) Ícones Lucide (lucide.createIcons()); (4) Menu mobile responsivo; (5) FAQ accordions; (6) Contadores animados; (7) Confetti. IMPORTANTE: Execute imediatamente se document.readyState !== 'loading' para garantir animações ativas no canvas.",
  "explanation": "Resumo do que foi construído nesta subpágina."
}
${brandDirective}
`;

      try {
        const subAiResponse = await executeAIRequest(
          subPrompt,
          { html: sub.html, css: updatedHomeCss, js: updatedHomeJs },
          {
            provider: (aiProvider as any) || 'gemini',
            apiKey: resolvedApiKey,
            model: customModel,
            registeredModels,
            proxyUrl: customProxyUrl,
            ollamaEndpoint,
            lowSpecMode,
            customSkills,
            onProgress: (info) => {
              item.currentModel = `${sub.name}: ${info.model || info.status}`;
            }
          }
        );

        if ((item.status as string) === 'cancelled') return;

        let updatedSubHtml = subAiResponse.html || sub.html;

        // INJEÇÃO DINÂMICA E AUTOMÁTICA DOS ELEMENTOS GLOBAIS MESTRES (Navbar com ativo, Footer e Widgets)
        updatedSubHtml = ensureAndDeduplicateGlobalElements(
          updatedSubHtml,
          navbarHtml,
          footerHtml,
          sub.slug,
          navigationRoutes,
          globalItemsHtml
        );

        const updatedSubCss = [updatedHomeCss, subAiResponse.css || ''].filter(Boolean).join('\n\n');
        const updatedSubJs = [updatedHomeJs, subAiResponse.js || ''].filter(Boolean).join('\n\n');

        await prisma.page.update({
          where: { id: sub.id },
          data: {
            html: updatedSubHtml,
            css: updatedSubCss,
            js: updatedSubJs
          }
        });

        updatedPagesList.push({
          id: sub.id,
          name: sub.name,
          slug: sub.slug,
          html: updatedSubHtml,
          css: updatedSubCss,
          js: updatedSubJs
        });
      } catch (subErr: any) {
        console.warn(`[AIQueueManager] Erro na IA da subpágina ${sub.name} (${subErr.message}). Utilizando layout fallback para garantir subpágina gerada.`);
        
        const fallbackSubHtml = buildFallbackSubpageHtml(
          sub.name,
          resolvedBusinessName,
          navbarHtml,
          footerHtml,
          globalItemsHtml
        );
        const updatedSubCss = updatedHomeCss;
        const updatedSubJs = updatedHomeJs;

        await prisma.page.update({
          where: { id: sub.id },
          data: {
            html: fallbackSubHtml,
            css: updatedSubCss,
            js: updatedSubJs
          }
        });

        updatedPagesList.push({
          id: sub.id,
          name: sub.name,
          slug: sub.slug,
          html: fallbackSubHtml,
          css: updatedSubCss,
          js: updatedSubJs
        });
      }
    }

    // 5. REGISTRAR VERSÃO DE BACKUP COMPLETA
    await prisma.version.create({
      data: {
        name: `Geração Completa Multi-páginas (${totalPages} pág)`,
        description: `Site profissional gerado com IA para "${resolvedBusinessName}": ${prompt.slice(0, 100)}`,
        projectId,
        snapshot: {
          pages: updatedPagesList
        }
      }
    });

    item.result = {
      explanation: `Site profissional para "${resolvedBusinessName}" com ${totalPages} página(s) gerado com sucesso!`,
      html: updatedHomeHtml,
      css: updatedHomeCss,
      js: updatedHomeJs,
      _usedModel: homeAiResponse._usedModel,
      _usedProvider: homeAiResponse._usedProvider,
      updatedPages: updatedPagesList
    };
  }

  private async executeChatEdit(item: AIQueueItem) {
    const { pageId, prompt, options = {} } = item;
    if (!pageId) throw new Error('ID da página é obrigatório para edição por chat.');

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: { include: { pages: true } } }
    });

    if (!page) throw new Error('Página não encontrada no banco de dados.');

    const project = page.project;
    let brandDirective = "";
    if (project) {
      brandDirective = `
\n[REGRAS DE IDENTIDADE DA MARCA E DESIGN SYSTEM]
Sempre use e incorpore rigorosamente as seguintes informações oficiais e paleta de cores para manter a consistência de marca:
- Nome da Marca / Site: "${project.name}"
${project.logoUrl ? `- Imagem da Logomarca (URL): "${project.logoUrl}" (Use exatamente este link de logo caso precise renderizar ou atualizar um logotipo, ex: <img src="${project.logoUrl}" referrerPolicy="no-referrer" alt="${project.name}" class="h-8 md:h-10 object-contain">)` : '- Logotipo: Use um logotipo moderno baseado em texto/tipografia estilizada com o nome do site'}
- Contatos de Telefone / WhatsApp comercial: "${project.contacts || 'Não especificado'}"
- E-mail oficial de contato: "${project.email || 'Não especificado'}"

${project.colorPalette ? `- DIRETRIZ CRÍTICA DE CORES (PALETA): "${project.colorPalette}". Todas as alterações, novas seções, cores de botões e planos de fundo devem seguir, preencher ou manter rigorosamente esta paleta de cores.` : ''}
`;
    }

    const resolvedApiKey = await this.resolveApiKeyAndSettings(page.projectId, options.customApiKey || options.apiKey);

    const projectPages = page.project?.pages || [page];
    let pagesToProcess: typeof projectPages = [];

    const applyToAll = !!item.options?.applyToAll;
    const targetPageIds = item.options?.targetPageIds;

    if (targetPageIds && Array.isArray(targetPageIds) && targetPageIds.length > 0) {
      pagesToProcess = projectPages.filter(p => targetPageIds.includes(p.id));
      if (pagesToProcess.length === 0) pagesToProcess = [page];
    } else if (applyToAll && projectPages.length > 1) {
      pagesToProcess = projectPages;
    } else {
      pagesToProcess = [page];
    }

    const isMultiPage = pagesToProcess.length > 1;
    item.scope = isMultiPage ? 'all' : 'single';
    item.currentModel = isMultiPage 
      ? `${options.model || 'gemini-2.0-flash'} (Processando ${pagesToProcess.length} páginas...)`
      : options.model || 'gemini-2.0-flash';

    if (isMultiPage) {
      const updatedPages: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }> = [];
      let finalExplanation = '';

      for (let i = 0; i < pagesToProcess.length; i++) {
        // Se foi cancelado entre as iterações das páginas
        if (item.status === 'cancelled') return;

        const currentPage = pagesToProcess[i];
        item.currentModel = `[${i + 1}/${pagesToProcess.length}] Processando imagens da página: "${currentPage.name}"`;

        let pageHtml = currentPage.html || '<div></div>';
        try {
          const rewrittenHtml = await processPageAssets(
            pageHtml,
            '',
            new Map<string, string>(),
            page.project?.ownerId || undefined,
            page.projectId
          );
          if (rewrittenHtml !== pageHtml) {
            pageHtml = rewrittenHtml;
            await prisma.page.update({
              where: { id: currentPage.id },
              data: { html: rewrittenHtml }
            });
            currentPage.html = rewrittenHtml;
          }
        } catch (assetErr) {
          console.warn(`[executeChatEdit] Erro ao reescrever assets da página ${currentPage.name}:`, assetErr);
        }

        item.currentModel = `[${i + 1}/${pagesToProcess.length}] Atualizando página: "${currentPage.name}"`;

        const context = {
          html: pageHtml,
          css: currentPage.css || '',
          js: currentPage.js || ''
        };

        const pageSpecificPrompt = `${prompt}\n\n[INSTRUÇÃO IMPORTANTE]: Você está atualizando a página "${currentPage.name}" (slug: /${currentPage.slug}) do projeto. Mantenha a identidade visual e o design global sincronizado com as demais páginas.\n${brandDirective}`;

        const res = await executeAIRequest(pageSpecificPrompt, context, {
          ...options,
          apiKey: resolvedApiKey,
          onProgress: (info) => {
            item.currentModel = `[${i + 1}/${pagesToProcess.length}] ${currentPage.name}: ${info.model || ''}`;
          }
        });

        // Se foi cancelado após a chamada do modelo
        if ((item.status as string) === 'cancelled') return;

        let finalHtml = res.html || pageHtml;
        let finalCss = res.css || currentPage.css || '';
        let finalJs = res.js || currentPage.js || '';

        if (res.action_type === 'question_only') {
          finalHtml = pageHtml;
          finalCss = currentPage.css || '';
          finalJs = currentPage.js || '';
        } else if (res.action_type === 'update_style_only') {
          finalHtml = pageHtml;
          finalCss = res.css || currentPage.css || '';
          finalJs = res.js || currentPage.js || '';
        }

        if (res.action_type !== 'question_only') {
          await prisma.page.update({
            where: { id: currentPage.id },
            data: {
              html: finalHtml,
              css: finalCss,
              js: finalJs
            }
          });
        }

        updatedPages.push({
          id: currentPage.id,
          name: currentPage.name,
          slug: currentPage.slug,
          html: finalHtml,
          css: finalCss,
          js: finalJs
        });

        if (i === 0) finalExplanation = res.explanation;
      }

      const activeUpdated = updatedPages.find(p => p.id === pageId) || updatedPages[0];
      const isQuestion = updatedPages.length > 0 && finalExplanation;

      item.result = {
        explanation: isQuestion ? finalExplanation : `Todas as ${updatedPages.length} páginas selecionadas foram processadas.\n\n${finalExplanation}`,
        html: activeUpdated?.html,
        css: activeUpdated?.css,
        js: activeUpdated?.js,
        _usedModel: options.model || 'gemini-2.0-flash',
        _usedProvider: options.provider || 'gemini',
        updatedPages
      };
    } else {
      let pageHtml = page.html || '<div></div>';
      item.currentModel = `Processando imagens da página: "${page.name}"...`;
      try {
        const rewrittenHtml = await processPageAssets(
          pageHtml,
          '',
          new Map<string, string>(),
          page.project?.ownerId || undefined,
          page.projectId
        );
        if (rewrittenHtml !== pageHtml) {
          pageHtml = rewrittenHtml;
          await prisma.page.update({
            where: { id: page.id },
            data: { html: rewrittenHtml }
          });
          page.html = rewrittenHtml;
        }
      } catch (assetErr) {
        console.warn(`[executeChatEdit] Erro ao reescrever assets da página ${page.name}:`, assetErr);
      }

      const targetSectionIndex = options.targetSectionIndex;
      const targetSectionLabel = options.targetSectionLabel || (targetSectionIndex !== undefined ? `Seção #${targetSectionIndex + 1}` : undefined);
      const targetSectionHtml = options.targetSectionHtml;

      let result;
      let finalHtml = pageHtml;
      let finalCss = page.css || '';
      let finalJs = page.js || '';

      if (targetSectionIndex !== undefined && targetSectionHtml) {
        // MODO EDIÇÃO DE SEÇÃO ESPECÍFICA
        console.log(`[AIQueueManager] Iniciando edição direcionada para a seção index ${targetSectionIndex}: ${targetSectionLabel}`);
        
        const sectionPrompt = `
Você é o Arquiteto Frontend Master e Designer UI/UX de Elite responsável pelo site.
Sua missão é atualizar EXCLUSIVAMENTE a seção "${targetSectionLabel}" na página "${page.name}".

==============================================================================
ATENÇÃO E REGRAS RÍGIDAS DE EDIÇÃO CIRÚRGICA
==============================================================================
1. Retorne um objeto JSON estrito no formato:
   {
     "html": "...",
     "css": "...",
     "js": "...",
     "explanation": "..."
   }
   Onde o campo "html" DEVE conter APENAS o código HTML atualizado desta seção isolada. Não retorne a página inteira nem containers wrappers externos da página.
2. Inicie o HTML retornado pela tag raiz da própria seção (ex: <section ...>, <header ...>, <footer ...> ou <div ...>) mantendo suas classes ID e estrutura base, aplicando as alterações solicitadas.
3. Não remova logos, links oficiais ou textos existentes, a menos que o pedido do usuário solicite expressamente a substituição.
4. Se o usuário pedir novos efeitos visuais ou interatividade, aplique classes Tailwind adicionais e retorne as regras CSS ou scripts JS correspondentes nos campos "css" e "js" (que serão mesclados ao projeto).

PEDIDO DE ALTERAÇÃO DO USUÁRIO PARA ESTA SEÇÃO:
"""
${prompt}
"""

${brandDirective}

CÓDIGO HTML ATUAL DESTA SEÇÃO:
"""
${targetSectionHtml}
"""

CONTEXTO DE DESIGN SYSTEM E ESTILOS GLOBAIS DA PÁGINA (Use como referência de cores, fontes e padrões):
- HTML Completo da Página:
"""
${pageHtml}
"""
- CSS Global da Página:
"""
${page.css || ''}
"""
        `;

        const context = {
          html: targetSectionHtml,
          css: page.css || '',
          js: page.js || ''
        };

        result = await executeAIRequest(sectionPrompt, context, {
          ...options,
          apiKey: resolvedApiKey,
          onProgress: (info) => {
            item.currentModel = `${info.model || 'Processando'} (Seção: ${targetSectionLabel})`;
          }
        });

        if (item.status === 'cancelled') return;

        if (result.action_type === 'question_only') {
          // Apenas responde, sem mesclar
          finalHtml = pageHtml;
          console.log(`[AIQueueManager] Modo question_only detectado (seção).`);
        } else if (result.action_type === 'update_style_only') {
          // Atualiza apenas CSS
          finalHtml = pageHtml;
          console.log(`[AIQueueManager] Modo update_style_only detectado (seção).`);
        } else {
          // Fazer a mesclagem cirúrgica do HTML da seção modificada de volta na página original
          const { wrapperOpen, sections, wrapperClose } = parsePageSections(pageHtml);
          if (targetSectionIndex >= 0 && targetSectionIndex < sections.length) {
            sections[targetSectionIndex] = result.html || sections[targetSectionIndex];
            finalHtml = `${wrapperOpen}${sections.join('\n\n')}${wrapperClose}`;
            console.log(`[AIQueueManager] Seção index ${targetSectionIndex} substituída com sucesso!`);
          } else {
            // Fallback se o index estiver fora do intervalo (ex: página mudou no meio)
            // Tenta substituir por correspondência exata do HTML original
            const matchedIndex = sections.findIndex(s => s.trim() === targetSectionHtml.trim());
            if (matchedIndex !== -1) {
              sections[matchedIndex] = result.html || sections[matchedIndex];
              finalHtml = `${wrapperOpen}${sections.join('\n\n')}${wrapperClose}`;
            } else {
              console.warn(`[AIQueueManager] Seção index ${targetSectionIndex} não encontrada na árvore atual de ${sections.length} seções. Salvando alteração direta.`);
              finalHtml = result.html || pageHtml;
            }
          }
        }

        // Mesclar CSS e JS
        if (result.css && result.css.trim() && !finalCss.includes(result.css.trim())) {
          finalCss = `${finalCss}\n\n/* Estilos adicionados via IA para ${targetSectionLabel} */\n${result.css.trim()}`;
        }
        if (result.js && result.js.trim() && !finalJs.includes(result.js.trim())) {
          finalJs = `${finalJs}\n\n// Funcionalidades adicionadas via IA para ${targetSectionLabel}\n${result.js.trim()}`;
        }

      } else {
        // MODO PÁGINA INTEIRA (Comportamento Legado)
        const context = {
          html: pageHtml,
          css: page.css || '',
          js: page.js || ''
        };

        const fullPrompt = `${prompt}\n${brandDirective}`;

        result = await executeAIRequest(fullPrompt, context, {
          ...options,
          apiKey: resolvedApiKey,
          onProgress: (info) => {
            item.currentModel = info.model;
          }
        });

        if (item.status === 'cancelled') return;

        if (result.action_type === 'question_only' || result.action_type === 'navigate') {
          // Não atualiza HTML, CSS e JS da página
          finalHtml = pageHtml;
          finalCss = page.css || '';
          finalJs = page.js || '';
          console.log(`[AIQueueManager] Modo ${result.action_type} detectado, preservando estrutura da página.`);
        } else if (result.action_type === 'settings') {
          finalHtml = pageHtml;
          finalCss = page.css || '';
          finalJs = page.js || '';
          if (result.settings) {
            console.log(`[AIQueueManager] Modo settings detectado:`, result.settings);
            if (result.settings.seoTitle || result.settings.seoDescription) {
              await prisma.page.update({
                where: { id: page.id },
                data: {
                  ...(result.settings.seoTitle ? { seoTitle: result.settings.seoTitle } : {}),
                  ...(result.settings.seoDescription ? { seoDescription: result.settings.seoDescription } : {})
                }
              });
            }
          }
        } else if (result.action_type === 'update_style_only') {
          finalHtml = pageHtml; // Preserva o HTML atual
          finalCss = result.css || page.css || '';
          finalJs = result.js || page.js || '';
          console.log(`[AIQueueManager] Modo update_style_only detectado.`);
        } else {
          finalHtml = result.html || pageHtml;
          finalCss = result.css || '';
          finalJs = result.js || '';
        }
      }

      // Se for apenas pergunta, navegação ou settings simples sem alteração de código HTML
      if (result.action_type === 'update_page' || result.action_type === 'update_style_only') {
        await prisma.page.update({
          where: { id: page.id },
          data: {
            html: finalHtml,
            css: finalCss,
            js: finalJs
          }
        });
      }

      item.result = {
        explanation: result.explanation,
        html: finalHtml,
        css: finalCss,
        js: finalJs,
        navigation: result.navigation,
        settings: result.settings,
        _usedModel: result._usedModel,
        _usedProvider: result._usedProvider,
        action_type: result.action_type
      };
    }
  }

  private async executePageRemaster(item: AIQueueItem) {
    const { pageId, prompt, options = {} } = item;
    if (!pageId) throw new Error('ID da página é obrigatório para remasterização.');

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: true }
    });

    if (!page) throw new Error('Página não encontrada para remasterização.');

    item.currentModel = 'Preparando página para melhoramento inteligente...';
    item.scope = 'single';

    // Antes de carregar no melhoramento, substitui links originais por links baixados
    let pageHtml = page.html || '';
    try {
      item.currentModel = 'Baixando imagens originais para o servidor local...';
      const rewrittenHtml = await processPageAssets(
        pageHtml,
        '',
        new Map<string, string>(),
        page.project?.ownerId || undefined,
        page.projectId
      );
      if (rewrittenHtml !== pageHtml) {
        pageHtml = rewrittenHtml;
        await prisma.page.update({
          where: { id: pageId },
          data: { html: rewrittenHtml }
        });
        page.html = rewrittenHtml;
        console.log(`[executePageRemaster] Sucesso: Imagens baixadas e referenciadas localmente na página ${page.name}.`);
      }
    } catch (assetErr) {
      console.warn(`[executePageRemaster] Erro ao processar imagens originais antes do melhoramento:`, assetErr);
    }

    item.currentModel = options.model || 'gemini-2.0-flash';

    // Otimização de Tokens: Se solicitado, não enviamos CSS e JS inteiros, pois o Tailwind irá recriar
    const optimizeTokens = options.optimizeTokens !== false;
    const cssContent = optimizeTokens ? (page.css ? '/* CSS omitido para economizar tokens, refaça usando Tailwind */' : '') : page.css;
    const jsContent = optimizeTokens ? (page.js ? '// JS omitido, crie as interatividades necessárias' : '') : page.js;

    const remasterPrompt = `
      Você é o Arquiteto Frontend Master.
      Estamos aprimorando o design e layout da página "${page.name}" (${page.slug}).

      DIRETRIZ DE MELHORIA DO USUÁRIO:
      """
      ${prompt || 'Melhore o layout e estilo com Tailwind CSS de forma moderna, elegante e responsiva.'}
      """
      ${options.customPrompt ? `\nDIRETRIZ ESPECÍFICA DESTA PÁGINA:\n"""\n${options.customPrompt}\n"""\n` : ''}

      HTML ORIGINAL DA PÁGINA:
      """
      ${pageHtml}
      """
      ${options.extractedNavbar ? `\nUSE ESTA NAVBAR EXATAMENTE COMO ESTÁ (Se houver navbar):\n"""\n${options.extractedNavbar}\n"""\n` : ''}
      ${options.extractedFooter ? `\nUSE ESTE FOOTER EXATAMENTE COMO ESTÁ (Se houver footer):\n"""\n${options.extractedFooter}\n"""\n` : ''}

      ${!optimizeTokens ? `
      CSS ORIGINAL:
      """
      ${cssContent}
      """

      JS ORIGINAL:
      """
      ${jsContent}
      """
      ` : ''}

      REGRAS OBRIGATÓRIAS E INEGOCIÁVEIS:
      1. NÃO REFAÇA DO ZERO E NÃO INVENTE TEXTOS FAKE. Mantenha integralmente todas as frases originais, slogans, títulos, parágrafos, contatos, telefones e mídias.
      2. MANTENHA TODAS AS IMAGENS E MÍDIAS: Preserve fielmente as tags <img src="..."> e URLs de imagem.
      3. DESIGN PREMIUM COM TAILWIND CSS: Reestruture as seções em um layout moderno, responsivo e limpo.
      4. RETORNO LIMPO: Retorne apenas HTML em "html", CSS em "css" e JS em "js".
    `;

    const context = {
      html: pageHtml,
      css: cssContent || '',
      js: jsContent || ''
    };

    const aiResponse = await executeAIRequest(
      remasterPrompt,
      context,
      {
        ...options,
        onProgress: (info) => {
          item.currentModel = info.model;
        }
      }
    );

    if (item.status === 'cancelled') return;

    const updatedHtml = aiResponse.html || pageHtml;
    const updatedCss = aiResponse.css || page.css;
    const updatedJs = aiResponse.js || page.js;

    await prisma.page.update({
      where: { id: pageId },
      data: {
        html: updatedHtml,
        css: updatedCss,
        js: updatedJs
      }
    });

    item.result = {
      explanation: aiResponse.explanation || 'Remasterização concluída com sucesso!',
      html: updatedHtml,
      css: updatedCss,
      js: updatedJs,
      _usedModel: aiResponse._usedModel,
      _usedProvider: aiResponse._usedProvider
    };
  }
}

class AIQueueManager {
  private queues = new Map<string, ProjectQueue>();

  private getQueue(projectId: string): ProjectQueue {
    let q = this.queues.get(projectId);
    if (!q) {
      q = new ProjectQueue(projectId);
      this.queues.set(projectId, q);
    }
    return q;
  }

  enqueue(
    projectId: string,
    type: 'chat_edit' | 'page_remaster' | 'site_remaster' | 'site_generation',
    prompt: string,
    pageId?: string,
    options?: any
  ): AIQueueItem {
    const queue = this.getQueue(projectId);
    
    const item: AIQueueItem = {
      id: `ai_job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      projectId,
      type,
      status: 'pending',
      prompt,
      pageId,
      createdAt: new Date(),
      updatedAt: new Date(),
      options
    };

    queue.enqueue(item);
    return item;
  }

  getQueueList(projectId: string): AIQueueItem[] {
    const queue = this.getQueue(projectId);
    return [...queue.items];
  }

  getItemStatus(projectId: string, itemId: string): AIQueueItem | undefined {
    const queue = this.getQueue(projectId);
    return queue.items.find(i => i.id === itemId);
  }

  cancelItem(projectId: string, itemId: string): boolean {
    const queue = this.getQueue(projectId);
    queue.cancel(itemId);
    return true;
  }

  clearQueue(projectId: string): boolean {
    const queue = this.getQueue(projectId);
    queue.clear();
    return true;
  }

  getItemStatusGlobally(itemId: string): AIQueueItem | undefined {
    for (const queue of this.queues.values()) {
      const item = queue.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return undefined;
  }

  // Find any active job (pending or processing) for a project or page
  getActiveJob(projectId?: string, pageId?: string): AIQueueItem | undefined {
    if (projectId) {
      const queue = this.getQueue(projectId);
      return queue.items.find(i => i.status === 'pending' || i.status === 'processing');
    }
    
    // Fallback search across all queues
    for (const queue of this.queues.values()) {
      const active = queue.items.find(i => 
        (i.status === 'pending' || i.status === 'processing') && 
        (!pageId || i.pageId === pageId)
      );
      if (active) return active;
    }
    return undefined;
  }
}

export const aiQueueManager = new AIQueueManager();
