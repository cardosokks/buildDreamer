import { prisma } from '../db';
import { executeAIRequest } from './aiEngine';
import { executeSiteRemaster } from './siteRemasterWorker';
import { processPageAssets, extractNavbarAndFooter } from './siteRemaster';

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
      colorPalette
    } = options;

    const resolvedApiKey = await this.resolveApiKeyAndSettings(projectId, customApiKey);
    const resolvedBusinessName = (businessName || '').trim() || 'Sua Empresa';
    const resolvedSegment = (segment || '').trim() || 'Serviços Profissionais';
    const resolvedStyle = (visualStyle || '').trim() || 'Ultra Moderno, Dark Luxury ou Clean Tech com alto contraste e elegância';
    const resolvedPalette = (colorPalette || '').trim() || 'Paleta refinada com gradientes sutis e harmônicos';

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

    // 3. GERAÇÃO DA HOME (PÁGINA 1)
    item.currentModel = `Construindo Página Inicial (1/${totalPages})...`;

    const homePrompt = `
Você é um Arquiteto de Software Frontend de Elite e Designer Master (especialista em Webflow, Tailwind UI, Framer e v0).
Sua missão é criar a PÁGINA INICIAL (HOME) de altíssimo impacto e nível internacional para a empresa "${resolvedBusinessName}".

DADOS DO PROJETO:
- Nome do Negócio: ${resolvedBusinessName}
- Segmento / Ramo de Atuação: ${resolvedSegment}
- Estilo Visual Solicitado: ${resolvedStyle || 'Livre & Exclusivo por IA'} | ${resolvedPalette || 'Sintetizada por IA'}
- Instruções Específicas do Usuário: ${prompt}

DIRETRIZES CRÍTICAS DE ESTILOS CSS POR SEGMENTO (PROIBIDO TEMAS HARDCODED OU REPETITIVOS):
1. INJEÇÃO DE ESTILOS CSS BASEADOS INTEIRAMENTE NO SEGMENTO "${resolvedSegment}":
   - É ESTRITAMENTE PROIBIDO reutilizar variáveis hardcoded estáticas ou cores padrão (como bg-slate-900 engessado em todos os sites)!
   - Toda a identidade estética (cores de fundo, cartões, realces glow, gradientes, bordas e tipografia do Google Fonts) DEVE ser sintetizada sob medida com base no segmento "${resolvedSegment}".
   - No início do campo "css", declare variáveis nativas no bloco :root especificamente para a marca "${resolvedBusinessName}":
     :root {
       --brand-primary: [Cor primária gerada para o nicho de ${resolvedSegment}];
       --brand-accent: [Cor de acento/glow para botões e destaques do nicho];
       --brand-bg: [Cor de fundo adequada ao segmento - clara, escura ou de tom pastel/terroso];
       --brand-card: [Cor de fundo de cartões e painéis com glassmorphism do nicho];
       --brand-text: [Cor dos textos principais];
       --brand-border: [Cor das bordas com transparência adequada];
       --font-heading: [Nome da fonte do Google Fonts selecionada para títulos do segmento];
       --font-body: [Nome da fonte do Google Fonts selecionada para leitura do segmento];
     }
2. ADAPTAÇÃO VISUAL AO PÚBLICO DO SEGMENTO:
   - Se Saúde/Médico/Clínica: cores assépticas (branco, ciano, azul-royal, verde-menta ou rosé), tipografia limpa humanista.
   - Se Tecnologia/SaaS: cores futuristas (obsidian, indigo/ciano néon, violeta), tipografia geométrica em Bento Grid.
   - Se Gastronomia/Artesanal: cores quentes (terracota, creme, café, verde-oliva), tipografia serifada aconchegante.
   - Se Barbearia/Balada/Luxo: cores noturnas (obsidian, âmbar, dourado, vidro escuro), tipografia imponente.
   - Se Esportes/Academia: alto contraste (preto profundo, amarelo-limão/néon), tipografia display em caixa alta.

ROTAS DE NAVEGAÇÃO DO SITE (OBRIGATÓRIO incluir na Navbar e no Footer):
${navLinksDoc}

ESTRUTURA COMPLETA E OBRIGATÓRIA DA PÁGINA INICIAL:
1. HEADER / NAVBAR STICKY:
   - Fundo translúcido com blur (ex: backdrop-blur-md bg-slate-900/80 border-b border-slate-800).
   - Logomarca moderna com ícone estilizado e tipografia expressiva de ${resolvedBusinessName}.
   - Links de navegação apontando EXATAMENTE para as rotas acima: ${navigationRoutes.map(r => `<a href="${r.href}">${r.name}</a>`).join(', ')}.
   - Botão de Ação CTA em destaque no canto direito (ex: "Fale Conosco" / "Comece Agora" / "Solicitar Orçamento").
   - Botão de menu mobile hambúrguer responsivo com interatividade funcional no JS.
2. HERO SECTION MASTERPIECE:
   - Eyebrow Badge (ex: "✨ Líder em ${resolvedSegment}" ou "✦ Soluções Inovadoras").
   - Título imponente de alto contraste com gradiente sutil no texto (bg-clip-text).
   - Subtítulo claro, persuasivo e focado na transformação do cliente.
   - 2 Botões de CTA (Primário com gradiente pulsante + Secundário com contorno elegante e ícone).
   - Prova social imediata: Avaliação 4.9/5 estrelas ⭐, avatares sobrepostos de clientes e estatística impactante (ex: "+5.000 clientes atendidos").
   - Card/Mockup visual de alta definição com efeito de profundidade, glassmorphism e iluminação sutil.
3. BARRA DE AUTORIDADE / CONFIANÇA (TRUST BAR):
   - "Empresas e parceiros que confiam em nossa excelência" com logos/badges minimalistas.
4. DIFERENCIAIS & RECURSOS (BENTO GRID MODERNO):
   - 3 ou 4 cards assimétricos com hover animado, ícones expressivos, bordas com gradiente sutil e métricas destacadas.
5. VITRINE DE SERVIÇOS / PRODUTOS:
   - Cards detalhados dos principais serviços de ${resolvedBusinessName} com tags de categoria, lista de benefícios (✓) e link direcionando para "servicos.html" ou WhatsApp.
6. SEÇÃO SOBRE & AUTORIDADE:
   - Resumo da trajetória e missão de ${resolvedBusinessName}, pilares de valor e contadores numéricos (ex: 99.8% Satisfação, +10 Anos de Mercado). Link para "sobre.html".
7. PROVA SOCIAL & DEPOIMENTOS:
   - Grade de depoimentos com fotos circulares em alta qualidade (Unsplash), 5 estrelas douradas, nome, cargo e depoimento persuasivo.
8. PERGUNTAS FREQUENTES (FAQ ACCORDION INTERATIVO):
   - 4 ou 5 dúvidas essenciais do segmento de ${resolvedBusinessName}. O clique deve abrir/fechar suavemente via JavaScript funcional com rotação do chevron!
9. CHAMADA FINAL PARA AÇÃO (CTA) & NEWSLETTER:
   - Banner envolvente de fechamento incentivando contato imediato via formulário ou WhatsApp.
10. BOTÃO FLUTUANTE DO WHATSAPP:
    - Botão fixo no canto inferior direito com animação de pulso e link direto (href="https://wa.me/5511999999999?text=Ol%C3%A1,%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es").
11. FOOTER MULTICOLUNAS COMPLETO:
    - Bio da empresa, links organizados para todas as páginas (${navigationRoutes.map(r => r.name).join(', ')}), redes sociais, aviso legal e copyright.

REGRAS TÉCNICAS E ARQUITETURA:
- O retorno DEVE ser um objeto JSON estrito com as chaves: "html", "css", "js", "explanation".
- HTML: apenas classes Tailwind semânticas. NUNCA coloque tags <style> ou <script> dentro do HTML.
- CSS: defina o bloco :root no início com as variáveis da marca do segmento, mais regras extras de animação (@keyframes, glows, custom scrollbar).
- JS: código puro com handlers de clique para abrir/fechar o menu mobile, abrir/fechar os accordions do FAQ, validação de envio de formulário com feedback visual, e contadores animados de números.
`;

    let homeAiResponse: any = null;
    let usedFallback = false;

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
      console.warn(`[AIQueueManager] Chamada de IA para a Home falhou (${homeAiErr.message}). Interrompendo processo de geração.`);
      throw homeAiErr;
    }

    if ((item.status as string) === 'cancelled') return;

    const updatedHomeHtml = homeAiResponse.html || homePage.html;
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

    // Extrair Navbar e Footer da Home para reaproveitamento padronizado nas subpáginas
    const { navbarHtml, footerHtml } = extractNavbarAndFooter(updatedHomeHtml);

    // 4. GERAÇÃO SEQUENCIAL DAS SUBPÁGINAS (SE HOUVER)
    for (let idx = 0; idx < subPages.length; idx++) {
      if ((item.status as string) === 'cancelled') return;

      const sub = subPages[idx];
      const pageNum = idx + 2;
      item.currentModel = `Construindo ${sub.name} (${pageNum}/${totalPages})...`;

      let subpageContextGuidance = '';
      const lowerSubName = (sub.name + ' ' + sub.slug).toLowerCase();

      if (lowerSubName.includes('sobre') || lowerSubName.includes('about') || lowerSubName.includes('quem')) {
        subpageContextGuidance = `
Esta é a PÁGINA SOBRE NÓS / INSTITUCIONAL.
Estrutura obrigatória das seções centrais (entre a Navbar e o Rodapé):
1. Hero Institucional com propósito, missão e visão inspiradora da ${resolvedBusinessName}.
2. Linha do Tempo / História: Trajetória de evolução e marcos históricos.
3. Nossos Pilares e Valores: 4 cards com ícones e princípios inegociáveis.
4. Equipe Executiva / Liderança: Fotos profissionais de liderança (Unsplash), nomes, cargos e mini-bios.
5. Certificações, Prêmios e Estatísticas de Impacto no Mercado.
6. Seção de CTA convidando para conhecer os serviços ou agendar uma reunião.
        `;
      } else if (lowerSubName.includes('servi') || lowerSubName.includes('service') || lowerSubName.includes('solu')) {
        subpageContextGuidance = `
Esta é a PÁGINA DE SERVIÇOS & SOLUÇÕES.
Estrutura obrigatória das seções centrais:
1. Hero de Serviços: Título focado em resolver dores e acelerar resultados para o cliente de ${resolvedBusinessName}.
2. Catálogo Completo de Serviços: Grade rica com cards detalhados, cada um contendo ícone, descrição aprofundada, tags de recursos, entregáveis inclusos (✓) e botão de contratação/orçamento.
3. Processo em 4 Etapas ("Como Funciona / Metodologia"): Diagnóstico -> Planejamento -> Execução -> Resultados.
4. Tabela de Comparação ou Diferenciais Técnicos em relação ao mercado.
5. Garantia de Qualidade e Segurança.
6. CTA final para solicitar proposta comercial personalizada.
        `;
      } else if (lowerSubName.includes('prec') || lowerSubName.includes('pric') || lowerSubName.includes('plan')) {
        subpageContextGuidance = `
Esta é a PÁGINA DE PREÇOS & PLANOS.
Estrutura obrigatória das seções centrais:
1. Hero de Preços: Clareza e transparência no investimento em ${resolvedBusinessName}.
2. Seletor Interativo Mensal / Anual (com desconto de 20%) funcionando com script JavaScript.
3. Tabela Comparativa de 3 Planos (ex: Básico, Pro / Mais Popular com destaque luminoso, Enterprise).
4. Checklist completo de recursos incluídos em cada plano.
5. FAQ sobre pagamentos, cancelamento, garantia de 30 dias e emissão de nota fiscal.
6. Banner de Segurança e Suporte Dedicado.
        `;
      } else if (lowerSubName.includes('contat') || lowerSubName.includes('contact') || lowerSubName.includes('fale') || lowerSubName.includes('local')) {
        subpageContextGuidance = `
Esta é a PÁGINA DE CONTATO & ATENDIMENTO.
Estrutura obrigatória das seções centrais:
1. Hero de Contato: "Estamos prontos para atender você".
2. Formulário Interativo Completo (Nome, E-mail, Telefone/WhatsApp, Assunto, Mensagem) com validação e feedback de envio no JS.
3. Informações de Atendimento Direto: Botão grande de WhatsApp com clique direto, telefone comercial, e-mail de suporte, endereço físico e horários de funcionamento.
4. Card Visual Interativo de Localização / Mapa.
5. FAQ Rápido de Atendimento.
        `;
      } else if (lowerSubName.includes('faq') || lowerSubName.includes('duvid') || lowerSubName.includes('ajuda')) {
        subpageContextGuidance = `
Esta é a PÁGINA DE FAQ & CENTRAL DE AJUDA.
Estrutura obrigatória das seções centrais:
1. Hero de Suporte com barra de pesquisa interativa em JS para filtrar perguntas.
2. Accordion Completo de Dúvidas dividido por categorias (Geral, Contratação, Pagamento, Prazos).
3. Botão de Suporte Humano via WhatsApp ou Ticket caso a dúvida não seja respondida.
        `;
      } else if (lowerSubName.includes('port') || lowerSubName.includes('case') || lowerSubName.includes('galer')) {
        subpageContextGuidance = `
Esta é a PÁGINA DE PORTFÓLIO & CASOS DE SUCESSO.
Estrutura obrigatória das seções centrais:
1. Hero de Portfólio: Vitrine dos melhores projetos e resultados gerados por ${resolvedBusinessName}.
2. Filtros de Categoria interativos com JavaScript.
3. Grade de Projetos com imagens em alta resolução, métricas de resultado alcançadas e depoimento do cliente.
4. CTA para iniciar um novo projeto com a empresa.
        `;
      } else {
        subpageContextGuidance = `
Esta é a subpágina "${sub.name}".
Desenvolva uma página rica, altamente detalhada e relevante para "${sub.name}", com hero exclusivo, seções informativas com cards modernos, ilustrações/mídias em alta qualidade e chamadas para ação.
        `;
      }

      const subPrompt = `
Você é o Arquiteto Frontend Líder do site "${resolvedBusinessName}".
Sua tarefa é gerar o código completo da subpágina "${sub.name}" (slug: ${sub.slug}).

ESTILO VISUAL & PALETA DO PROJETO:
${resolvedStyle} | ${resolvedPalette}

CSS DA PÁGINA HOME (PRINCIPAL) - REUTILIZE TODAS AS VARIÁVEIS E FONTES:
Você DEVE utilizar exatamente as mesmas variáveis de estilo (:root) e fontes definidas para a Home. NÃO crie novas cores ou fontes!
Aqui está o CSS original da Home para sua referência obrigatória:
\`\`\`css
${updatedHomeCss}
\`\`\`

DIRETRIZES DE IDENTIDADE VISUAL E REAPROVEITAMENTO:
1. A subpágina DEVE utilizar integralmente o mesmo esquema visual e variáveis CSS (:root) do segmento "${resolvedSegment}" criados para a Home e listados no CSS acima.
2. É ESTRITAMENTE PROIBIDO inventar uma nova paleta de cores ou redefinir as variáveis do :root com cores diferentes das que estão no bloco acima. Toda e qualquer classe customizada ou cor deve beber diretamente das variáveis como var(--brand-primary), var(--brand-accent), etc.
3. NAVBAR E FOOTER:
   - Utilize a mesma estrutura de Navbar e Footer da Home abaixo.
   - Na Navbar, destaque o link "${sub.name}" com classe ativa (ex: text-[var(--brand-accent)] font-bold ou border-b-2 border-[var(--brand-accent)]).
${navbarHtml ? `\nNAVBAR BASE DA HOME:\n${navbarHtml}\n` : ''}
${footerHtml ? `\nFOOTER BASE DA HOME:\n${footerHtml}\n` : ''}

LINKS DE NAVEGAÇÃO ENTRE AS PÁGINAS DO SITE:
${navLinksDoc}

CONTEÚDO OBRIGATÓRIO DESTA SUBPÁGINA:
${subpageContextGuidance}

REGRAS MANDATÓRIAS:
- Retorne JSON estrito: { "html": "...", "css": "...", "js": "...", "explanation": "..." }
- HTML limpo com classes Tailwind semânticas. NUNCA coloque tags <style> ou <script> dentro do HTML.
- Insira o botão flutuante de WhatsApp no canto inferior direito.
- No JS, inclua os handlers de menu mobile, acordeões e validações de formulário.
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

        const updatedSubHtml = subAiResponse.html || sub.html;
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
        console.warn(`[AIQueueManager] Erro na IA da subpágina ${sub.name} (${subErr.message}). Interrompendo processo.`);
        throw subErr;
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

        const pageSpecificPrompt = `${prompt}\n\n[INSTRUÇÃO IMPORTANTE]: Você está atualizando a página "${currentPage.name}" (slug: /${currentPage.slug}) do projeto. Mantenha a identidade visual e o design global sincronizado com as demais páginas.`;

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
Você é o Arquiteto Frontend Master.
Sua missão é atualizar EXCLUSIVAMENTE a seção "${targetSectionLabel}" dentro da página "${page.name}".

ATENÇÃO EXTREMA:
1. Retorne um JSON no qual o campo "html" contenha APENAS o código HTML atualizado para esta seção selecionada. Não retorne a página inteira nem o container wrapper externo.
2. Comece o HTML retornado pela mesma tag raiz (por exemplo, <section ...>, <header ...>, ou <div ...>) correspondente à seção atual se possível, aplicando as modificações solicitadas pelo usuário.
3. Se o usuário pedir para adicionar novos estilos ou comportamentos, você pode incluí-los como classes Tailwind adicionais no HTML, ou retornar regras customizadas no campo "css" e "js" (estes serão anexados globalmente).
4. Mantenha os textos originais, logomarcas, mídias e imagens originais da seção, a menos que o pedido diga explicitamente para trocá-los.

PEDIDO DE ALTERAÇÃO DO USUÁRIO PARA ESTA SEÇÃO:
"""
${prompt}
"""

CÓDIGO HTML ATUAL DESTA SEÇÃO:
"""
${targetSectionHtml}
"""

CONTEXTO GERAL DO DESIGN SYSTEM E DEMAIS PARTES DA PÁGINA (Use apenas para referência de cores, estilos, fontes e design global):
- HTML Completo:
"""
${pageHtml}
"""
- CSS Atual:
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

        result = await executeAIRequest(prompt, context, {
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
