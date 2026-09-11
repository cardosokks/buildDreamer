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

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    const resolvedApiKey = await this.resolveApiKeyAndSettings(projectId, customApiKey);
    const resolvedBusinessName = (businessName || '').trim() || project?.name || 'Sua Empresa';
    const resolvedSegment = (segment || '').trim() || 'Serviços Profissionais';
    const resolvedStyle = (visualStyle || '').trim() || 'Ultra Moderno, Dark Luxury ou Clean Tech com alto contraste e elegância';
    const resolvedPalette = (colorPalette || '').trim() || project?.colorPalette || 'Paleta refinada com gradientes sutis e harmônicos';

    let brandDirective = "";
    if (project) {
      brandDirective = `
\n[REGRAS CRÍTICAS DE IDENTIDADE DA MARCA E DESIGN SYSTEM AUTORAL]
Você DEVE aplicar rigorosamente as informações oficiais da marca e o Design System abaixo:
- Nome da Marca / Site: "${project.name}"
${project.logoUrl ? `- Logotipo Oficial: "${project.logoUrl}" (Insira a imagem de forma responsiva e elegante nos cabeçalhos, navbar ou menus: <img src="${project.logoUrl}" referrerPolicy="no-referrer" alt="${project.name}" class="h-8 md:h-10 object-contain tracking-tight">)` : '- Logotipo: Use um logotipo elegante baseado em texto/tipografia estilizada com o nome do site'}
- Contatos Oficiais: Telefone / WhatsApp "${project.contacts || 'Não especificado'}" | E-mail: "${project.email || 'Não especificado'}"

- MOTOR DE DERIVAÇÃO ESTÉTICA E PALETA DE CORES:
  Paleta Solicitada/Configurada: "${project.colorPalette || resolvedPalette}".
  • PROIBIDO usar layouts monocromáticos cinza estéreis, preto puro \`#000000\` descontextualizado ou o padrão cyberpunk clichê (a menos que o segmento exija).
  • A IA deve adaptar a paleta ao nicho do negócio: crie uma hierarquia visual sofisticada com tom de base imersivo, cores de superfície translúcidas (Glassmorphic) e acentos vibrantes de alto contraste focados em guiagem visual e conversão (CTA Glow).
  • TIPOGRAFIA: Escolha e combine pelo menos 2 famílias do Google Fonts apropriadas ao tom da marca (ex: uma fonte imponente display/serifada para títulos e uma sans-serif ultra-legível para o corpo).
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
Você é um Arquiteto de Software Frontend de Elite e Designer UI/UX Master (especialista no nível Webflow, Framer, Tailwind UI e v0).
Sua missão é projetar a PÁGINA INICIAL (HOME) mestre de altíssimo impacto, responsiva, fluida e de padrão internacional para "${resolvedBusinessName}".

DADOS DO PROJETO:
- Nome do Negócio: ${resolvedBusinessName}
- Segmento / Ramo de Atuação: ${resolvedSegment}
- Estilo Visual & Paleta Pretendida: ${resolvedStyle} | ${resolvedPalette}
- Instruções Específicas do Usuário: ${prompt}

ROTAS DE NAVEGAÇÃO DO SITE (OBRIGATÓRIO incluir na Navbar e no Footer):
${navLinksDoc}

==============================================================================
ESTRUTURA COMPLETA E ASSIMÉTRICA DA PÁGINA INICIAL (ANTI-LAYOUT GENÉRICO)
==============================================================================

1. HEADER / NAVBAR FLUTUANTE (DYNAMIC FLOATING ISLAND):
   - Container flutuante com blur glassmorphism (ex: backdrop-blur-xl bg-slate-950/70 border border-white/10 rounded-full shadow-2xl).
   - Logomarca de ${resolvedBusinessName} integrada perfeitamente com altura proporcional.
   - Links de navegação apontando EXATAMENTE para as rotas acima com estado ativo e micro-hover. Links: ${navigationRoutes.map(r => `<a href="${r.href}">${r.name}</a>`).join(', ')}.
   - Botão de Ação CTA em destaque no canto direito com brilho sutil/glow.
   - Menu mobile hambúrguer responsivo com gaveta deslizante ou overlay totalmente interativo no JS.

2. HERO SECTION MASTERPIECE (SPLITSCREEN 3D OU COMPOSIÇÃO EDITORIAL):
   - Badge Flutuante Duplo Interativo:
     a) Badge de Autoridade/Google Reviews: "⭐ 4.9/5 (Avaliações Reais)" com selo de verificação.
     b) Badge de Status Vivo em Tempo Real: Elemento dinâmico calculado via JS com ID \`#realtime-status-badge\` ("🟢 ABERTO AGORA" ou "🔴 FECHADO NO MOMENTO").
   - Headline Imponente: Título de alto impacto visual com texto em gradiente semântico (bg-clip-text) e revelação dinâmica.
   - Subtítulo focado no benefício claro e na transformação do cliente.
   - CTAs Duplos de Alta Conversão: Primário com efeito Glow animado + Secundário transparente com ícone Lucide.
   - Container Visual em Destaque: Objeto 3D interativo via <spline-viewer> ou mockup visual translúcido em vidro fosco com iluminação radial (glow de fundo).

3. BARRA DE CONFIANÇA & AUTORIDADE (TRUST BAR):
   - Faixa minimalista estilizada: "Empresas e parceiros que confiam em nossa excelência", com logos translúcidos em grayscale hover-color.

4. BENTO GRID ASSIMÉTRICO DE DIFERENCIAIS (NADA DE 3 COLUNAS IGUAIS!):
   - Layout de 12 colunas com proporções variadas (ex: col-span-8, col-span-4, row-span-2).
   - Cartões translúcidos Glassmorphism, com bordas com brilho sutil ao passar o mouse, métricas destacadas, ícones Lucide glowing e overlays de imagem imersivos.

5. VITRINE DE SERVIÇOS / PRODUTOS INTERATIVA:
   - Apresentação dos principais produtos/serviços de ${resolvedBusinessName} com tags de categoria, lista de diferenciais (✓) e botões diretos para WhatsApp ou a página "servicos.html".

6. SEÇÃO SOBRE & PROPRIEDADE INTELECTUAL:
   - Narrativa envolvente sobre a missão e fundação de ${resolvedBusinessName}, alinhada com contadores numéricos de estatísticas (ex: 99.8% Satisfação, +10 Anos no Mercado). Link direcionando para "sobre.html".

7. PROVA SOCIAL & DEPOIMENTOS (CARROSSEL SWIPER.JS 3D):
   - Slider com efeito 3D (Cards ou Coverflow) contendo depoimentos autênticos com fotos de perfil em alta definição (Unsplash), estrelas glowing, nome, cargo e depoimento persuasivo.

8. PERGUNTAS FREQUENTES (FAQ ACCORDION INTERATIVO):
   - 4 a 6 perguntas estratégicas do segmento ${resolvedSegment}. O clique deve abrir/fechar o acordeão suavemente via JavaScript com rotação do ícone Chevron (+ / -).

9. CHAMADA FINAL PARA AÇÃO (CTA MASTER) & NEWSLETTER:
   - Seção de fechamento persuasiva incentivando agendamento ou contato imediato via formulário ou WhatsApp.

10. BOTÃO FLUTUANTE DE CONVERSÃO (WHATSAPP/RESERVA):
    - Botão fixo no canto inferior direito com pulso luminoso, tooltip e link direto wa.me preenchido.

11. FOOTER MULTICOLUNAS COMPLETO:
    - Bio da marca, links organizados para todas as rotas do site (${navigationRoutes.map(r => r.name).join(', ')}), dados de contato oficial, redes sociais com ícones e copyright.

==============================================================================
REGRAS TÉCNICAS E ARQUITETURA DE SAÍDA
==============================================================================
- DICA CRÍTICA DE LIMITES DE TOKENS: O layout exigido é gigante. Para evitar que a geração seja interrompida no meio (HTML cortado), seja conciso no preenchimento de textos, reduza o número de cards repetidos em listas/grids para no máximo 2 ou 3, e foque em entregar TODAS as seções até o Footer fechado (</footer>).
- Retorne EXCLUSIVAMENTE um objeto JSON válido no formato:
  {
    "html": "...",
    "css": "...",
    "js": "...",
    "explanation": "..."
  }
- HTML: Utilize apenas classes Tailwind CSS semânticas. NUNCA inclua tags <style> ou <script> dentro da string HTML.
- ANIMAÇÕES E REVEALS (GSAP): Adicione a classe 'gsap-reveal' nas seções principais, cabeçalhos, bento grids e cards para acionar as animações de scroll reveal controladas pela plataforma.
- CSS: Inclua no campo "css" estilos customizados necessários, como animações @keyframes customizadas, efeitos de profundidade, filtros de overlay e regras do Swiper.
- JS: Inclua no campo "js" JavaScript puro e funcional para os handlers da página: menu mobile responsive, acordeão interativo do FAQ, script do status em tempo real, inicialização do Swiper 3D e manipuladores dos botões de contato.

${brandDirective}
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
Sua missão é gerar o código completo, responsivo e exclusivo da subpágina "${sub.name}" (slug: ${sub.slug}).

ESTILO VISUAL & DESIGN SYSTEM DA MARCA:
${resolvedStyle} | ${resolvedPalette}

==============================================================================
DIRETRIZES RÍGIDAS DE COERÊNCIA VISUAL E REAPROVEITAMENTO
==============================================================================
1. A subpágina DEVE manter 100% de coerência visual com a Home (mesma tipografia, paleta de cores, arredondamentos e estilo de vidro/glassmorphism).
2. NAVBAR E FOOTER:
   - Utilize a mesma estrutura mestre fornecida abaixo.
   - Na Navbar, marque o link da subpágina atual "${sub.name}" com o indicador visual de classe ativa (ex: tom de destaque, borda inferior ou badge ativo).

NAVBAR BASE DA HOME:
${navbarHtml || 'Navbar base não disponível.'}

FOOTER BASE DA HOME:
${footerHtml || 'Footer base não disponível.'}

ROTAS DE NAVEGAÇÃO ENTRE AS PÁGINAS DO SITE:
${navLinksDoc}

CONTEÚDO ESPECÍFICO E OBRIGATÓRIO DESTA SUBPÁGINA:
${subpageContextGuidance}

==============================================================================
REGRAS MANDATÓRIAS E SAÍDA TÉCNICA
==============================================================================
- O retorno DEVE ser estritamente um JSON no formato:
  { 
    "html": "...", 
    "css": "...", 
    "js": "...", 
    "explanation": "..." 
  }
- HTML: Código semântico limpo usando Tailwind CSS. NUNCA insira tags <style> ou <script> no HTML.
- ANIMAÇÕES GSAP: Adicione obrigatoriamente a classe 'gsap-reveal' nos blocos principais, bento grids, tabelas/menus e cartões de destaque da subpágina para garantir a entrada animada fluida no scroll.
- JAVASCRIPT MODULAR (campo "js"): Escreva scripts específicos para esta subpágina (ex: formulário interativo de contato com popup interno de sucesso, alternador de abas/tabs para preços ou serviços, calculadoras ou acordeões).
- CSS ESPECÍFICO (campo "css"): Estilos customizados e keyframes necessários apenas para esta subpágina.
- Mantenha o botão flutuante de WhatsApp fixo no canto inferior direito.

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
