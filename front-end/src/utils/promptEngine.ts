export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  colors: {
    bg: string;
    cardBg: string;
    accent: string;
    accentGlow: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    styleDescription: string;
  };
  recommendedHero: 'bento' | 'splitscreen_3d' | 'parallax';
}

export interface PromptBuildParams {
  businessName: string;
  segment: string;
  visualStyle?: string;
  colorPalette?: string;
  heroLayout?: 'auto' | 'bento' | 'splitscreen_3d' | 'parallax';
  sectionTransitions?: 'waves' | 'slants' | 'curves' | 'overlapping_cards' | 'gradient_glows' | 'auto';
  pagesList?: Array<{ name: string; slug: string; isHomepage?: boolean }>;
  extraInstructions?: string;
  leadInfo?: {
    phone?: string;
    address?: string;
    openingHours?: string;
    rating?: string;
    reviewsCount?: number;
    website?: string;
  };
}

/**
 * Motor de Mapeamento de Temas (Theme Engine)
 * Gera recomendações abertas e flexíveis para a IA definir autonomamente a paleta de cores e tipografia
 */
export function mapSegmentToTheme(segment: string, userStyle: string = '', userPalette: string = ''): ThemeConfig {
  const seg = (segment || '').toLowerCase();
  const style = (userStyle || '').toLowerCase();

  return {
    id: 'ai_autonomous_theme',
    name: style.trim() ? `Estilo Personalizado: "${userStyle}"` : `Design Autônomo para ${segment || 'Geral'}`,
    description: 'Liberdade criativa total da IA para analisar o cliente, a logo/marca e criar uma paleta de cores, iluminação e tipografia 100% sob medida.',
    colors: {
      bg: '#080c14',
      cardBg: '#101726',
      accent: '#8b5cf6',
      accentGlow: 'rgba(139, 92, 246, 0.35)',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      border: 'rgba(139, 92, 246, 0.25)'
    },
    typography: {
      headingFont: 'Syne, Plus Jakarta Sans, Outfit, Space Grotesk',
      bodyFont: 'Inter, Plus Jakarta Sans, sans-serif',
      styleDescription: 'Seleção tipográfica dinâmica do Google Fonts perfeitamente alinhada à marca do cliente.'
    },
    recommendedHero: seg.includes('saas') || seg.includes('app') ? 'bento' : seg.includes('3d') || seg.includes('tech') ? 'splitscreen_3d' : 'splitscreen_3d'
  };
}

/**
 * Construtor do Prompt Final Estruturado para o Modal de Criação de Sites
 */
export function buildStructuredSitePrompt(params: PromptBuildParams): string {
  const {
    businessName,
    segment,
    visualStyle = '',
    colorPalette = '',
    heroLayout = 'auto',
    sectionTransitions = 'auto',
    pagesList = [{ name: 'Início', slug: 'index', isHomepage: true }],
    extraInstructions = '',
    leadInfo
  } = params;

  const theme = mapSegmentToTheme(segment, visualStyle, colorPalette);
  const activeHero = heroLayout === 'auto' ? theme.recommendedHero : heroLayout;

  const pagesCount = pagesList.length;
  const pagesFormatted = pagesList.map((p, i) => `${i + 1}. "${p.name}" (/${p.slug}.html)`).join(', ');

  const phoneStr = leadInfo?.phone || '(61) 99999-8888';
  const addressStr = leadInfo?.address || 'Endereço Principal, Centro';
  const openingHoursStr = leadInfo?.openingHours || 'Segunda a Sábado: 08:00 - 20:00';
  const ratingStr = leadInfo?.rating || '5.0';
  const reviewsCountNum = leadInfo?.reviewsCount || 128;

  return `==============================================================================
PROMPT ESTRUTURADO ORQUESTRADO EM PASSO A PASSO (GERAÇÃO AUTÔNOMA DE SITES POR IA)
==============================================================================

PASSO 1: ANÁLISE DO CLIENTE, LOGO E DEFINIÇÃO DA PALETA DE CORES / TEMA VISUAL (100% DEFINIDO PELA IA)
------------------------------------------------------------------------------
- DADOS DO CLIENTE PRESERVADOS INTEGRALMENTE (NUNCA OMITA ESTES DADOS EM NENHUMA PÁGINA):
  • Nome da Empresa/Negócio: "${businessName}"
  • Segmento / Categoria: "${segment}"
  • Telefone / WhatsApp: "${phoneStr}"
  • Endereço Físico: "${addressStr}"
  • Horário de Funcionamento: "${openingHoursStr}"
  • Avaliações e Prova Social: Nota ${ratingStr} ★ (${reviewsCountNum} avaliações reais no Google Maps)
  • Website / Link de Referência: "${leadInfo?.website || 'Disponível no site'}"

- DEFINIÇÃO AUTÔNOMA DA IDENTIDADE VISUAL & PALETA DE CORES:
  • Se o cliente enviou uma Logo ou imagem de referência anexada, VERIFIQUE e EXTRAIA as cores principais e o conceito da marca para definir a paleta visual do site.
  • Se não houver logo, A IA POSSUI 100% DE LIBERDADE CRIATIVA para definir a paleta de cores (primary, secondary, accent, bg, cardBg, text) e a atmosfera perfeita para o nicho de "${segment}".
  • É ESTRITAMENTE PROIBIDO UTILIZAR TEMAS PRÉ-DEFINIDOS ENGESSADOS OU LIMITADORES! Escolha livremente combinações de cores hexadecimais, gradientes, brilhos glow, cartões translúcidos (Glassmorphism) e tipografia moderna do Google Fonts alinhados ao estilo: "${visualStyle || 'Livre Criação por IA'}".

PASSO 2: ESTRUTURAÇÃO AUTÔNOMA DE PÁGINAS E ELEMENTOS GLOBAIS
------------------------------------------------------------------------------
- A IA define autonomamente a quantidade e a lista de páginas ideais para este negócio (${pagesCount} páginas configuradas): ${pagesFormatted}.
- CONSISTÊNCIA DO TEMA INICIAL: Todas as páginas geradas DEVEM seguir rigorosamente a mesma paleta de cores e identidade visual estabelecida no PASSO 1, garantindo unidade estética em todo o projeto.
- ELEMENTOS GLOBAIS MANDATÓRIOS EM TODAS AS PÁGINAS:
  1. Navbar / Header Global: Estrutura idêntica em todas as páginas, exibindo a marca/logo do cliente, menu de navegação responsivo com destaque visual para a página ativa e botão WhatsApp CTA.
  2. Footer / Rodapé Global: Multicolunas completo com contatos (${phoneStr}, ${addressStr}), horário de funcionamento (${openingHoursStr}), redes sociais e copyright.
  3. Botão Flutuante de WhatsApp: Acesso direto em todas as páginas.

PASSO 3: SINTETIZAÇÃO DO PROMPT COM TECNOLOGIAS DE ANIMAÇÃO, TRANSIÇÃO E DESIGN
------------------------------------------------------------------------------
- ANIMAÇÕES E INTERATIVIDADE DE ÚLTIMA GERAÇÃO:
  • GSAP ScrollTrigger: Elementos surgem com revelações fluidas em scroll (.gsap-reveal com fade-up, escala e stagger).
  • Lenis Smooth Scroll: Rolagem de página ultra-suave e luxuosa.
  • Swiper.js 3D: Carrossel de avaliações do Google Maps e galeria visual com efeito 3D Cards / Coverflow.
  • Spline 3D Viewer: Objetos 3D interativos no Hero Section.
  • Microinterações de Hover: Botões com brilho glow dinâmico e elevação de cartões em hover.

- TRANSIÇÕES DE SEÇÃO FLÚIDAS E ORGÂNICAS (ANTI-LAYOUT QUADRADO / ANTI-BLOCOS RETOS):
  • NUNCA empilhe seções em blocos retangulares planos e quadrados retos!
  • Alterne seções usando divisores em Ondas SVG, Cortes Diagonais (Slants), Arcos Curvos, Cartões Flutuantes Sobrepostos cruzando a fronteira de seções (-mt-12 relative z-20) e Linhas Néon com Glow.
  • Estilo de transição selecionado: [${sectionTransitions.toUpperCase()}].

------------------------------------------------------------------------------
INCLUSÃO OBRIGATÓRIA DE HEADERS, CDNS E GOOGLE FONTS NO <head>
------------------------------------------------------------------------------
O HTML gerado DEVE conter impreterivelmente no <head> todas as bibliotecas abaixo:

1. Tailwind CSS CDN:
   <script src="https://cdn.tailwindcss.com"></script>

2. Lucide Icons CDN:
   <script src="https://unpkg.com/lucide@latest"></script>

3. Google Fonts Import:
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Syne:wght@700;800&family=Space+Grotesk:wght@500;700&family=Outfit:wght@500;700;800&family=Inter:wght@300;400;600;800&family=Cinzel:wght@600;800&display=swap" rel="stylesheet">

4. GSAP & ScrollTrigger (Animações de entrada e scroll reveal):
   <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>

5. Lenis Smooth Scroll (Rolagem suave de luxo):
   <script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"></script>

6. Swiper.js (Sliders e Carrosséis 3D/Cards):
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css"/>
   <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>

7. Spline Viewer 3D (Elementos 3D Interativos):
   <script type="module" src="https://unpkg.com/@splinetool/viewer/build/spline-viewer.js"></script>

------------------------------------------------------------------------------
MOTOR DE INJEÇÃO DE COMPONENTES AVANÇADOS
------------------------------------------------------------------------------
A. HERO LAYOUT SELECIONADO: [${activeHero.toUpperCase()}]
   ${activeHero === 'bento' ? `
   - Bento Grid Hero Layout:
     Estrutura assimétrica em grid com cartões interativos. Inclua card de destaque principal com título de alto impacto, card de estatísticas com números animados, card com preview visual do serviço/produto e badges de alta conversão.
   ` : activeHero === 'splitscreen_3d' ? `
   - Splitscreen 3D Hero Layout:
     Coluna Esquerda: Copywriting persuasivo com badge animado, título com destaque em gradiente, lista de benefícios em bullet-points com ícones Lucide e botões duplos de CTA com efeito glow.
     Coluna Direita: Elemento 3D interativo utilizando a tag <spline-viewer url="https://prod.spline.design/6Wnt13RekM1bT46U/scene.splinecode"></spline-viewer> ou um container interativo Glassmorphism com flutuação 3D.
   ` : `
   - Parallax Header Hero Layout:
     Hero imersivo full-screen com imagem/vídeo de fundo em alta definição, overlay escuro com gradiente, efeito de movimento Parallax ativado pelo GSAP no scroll, título imponente centralizado e badges de verificação.
   `}

B. GALERIA & DEPOIMENTOS (SWIPER.JS 3D CARDS):
   - Crie um carrossel interativo Swiper.js configurado com efeito de efeito 3D Cards ou Coverflow (effect: 'cards' ou 'coverflow').
   - Exiba avaliações autênticas no formato Google Maps: Nota ${ratingStr} ⭐⭐⭐⭐⭐ (${reviewsCountNum} avaliações reais), foto de perfil do autor, selo de "Cliente Verificado no Maps" e comentário entusiasmado sobre os serviços de "${businessName}".
   - Galeria visual com fotos de alta qualidade do local/serviços usando Unsplash com referrerPolicy="no-referrer".

C. STATUS EM TEMPO REAL & BADGE DE FUNCIONAMENTO:
   - Módulo de script que calcula em tempo real com base na hora atual do dispositivo (new Date().getHours()) se o estabelecimento está aberto.
   - Se aberto: Exibe badge pulsante "🟢 ABERTO AGORA" com indicador LED verde em animação pulse.
   - Se fechado: Exibe badge "🔴 FECHADO NO MOMENTO" com indicação do próximo horário de atendimento (${openingHoursStr}).

D. CTAS DE ALTA CONVERSÃO DE CONEXÃO DIRETA:
   - Botão de WhatsApp Direto: Link direto wa.me com mensagem personalizada: https://wa.me/55${phoneStr.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de agendar um horário/orçamento na ${businessName}.`)}
   - Botão "Traçar Rota no Google Maps": Link direto https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${businessName} ${addressStr}`)}
   - Botão "Agendar Online / Reservar": Botão acionando um Modal Interativo de Agendamento embutido no código JS ou rolagem suave para o formulário de contato.

------------------------------------------------------------------------------
SCRIPT DE INICIALIZAÇÃO JS OBRIGATÓRIO (INCLUIR EM CADA PÁGINA)
------------------------------------------------------------------------------
<script>
  // 1. Inicializar Lucide Icons
  if (window.lucide) { lucide.createIcons(); }

  // 2. Inicializar Lenis Smooth Scroll
  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }

  // 3. Inicializar GSAP & ScrollTrigger Reveal
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    gsap.utils.toArray('.gsap-reveal').forEach((el) => {
      gsap.from(el, {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });
  }

  // 4. Inicializar Swiper.js com efeito 3D
  if (typeof Swiper !== 'undefined') {
    new Swiper('.maps-reviews-swiper', {
      effect: 'cards',
      grabCursor: true,
      pagination: { el: '.swiper-pagination', clickable: true },
      autoplay: { delay: 4000, disableOnInteraction: false }
    });
  }

  // 5. Módulo de Status em Tempo Real ("Aberto Agora")
  function updateBusinessStatus() {
    const statusEl = document.getElementById('realtime-status-badge');
    if (!statusEl) return;
    const hour = new Date().getHours();
    const isOpen = hour >= 8 && hour < 21;
    if (isOpen) {
      statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block mr-1.5"></span><span class="text-emerald-400 font-bold">🟢 Aberto Agora</span>';
    } else {
      statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 inline-block mr-1.5"></span><span class="text-rose-400 font-bold">🔴 Fechado • Abre às 08:00</span>';
    }
  }
  updateBusinessStatus();
</script>

------------------------------------------------------------------------------
INSTRUÇÕES ADICIONAIS DO USUÁRIO
------------------------------------------------------------------------------
${extraInstructions ? extraInstructions : 'Gere um design espetacular, 100% responsivo, com visual único de agência de alta tecnologia.'}

Siga rigorosamente os 3 PASSOS acima, entregando o código completo com todas as seções e interatividades solicitadas.`;
}

