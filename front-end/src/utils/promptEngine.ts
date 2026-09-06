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
 * Seleção dinâmica de paleta de cores e tipografia baseada no segmento ou estilo do cliente
 */
export function mapSegmentToTheme(segment: string, userStyle: string = '', userPalette: string = ''): ThemeConfig {
  const seg = (segment || '').toLowerCase();
  const style = (userStyle || '').toLowerCase();
  const palette = (userPalette || '').toLowerCase();

  // 1. Dark Luxe: Barbearias, Bares, Baladas, Pubs, Tabacarias, Gastronomia Noturna, Luxo
  if (
    seg.includes('barb') || seg.includes('bar') || seg.includes('pub') || seg.includes('balada') ||
    seg.includes('tabac') || seg.includes('drinks') || seg.includes('steak') || seg.includes('luxe') ||
    seg.includes('noite') || style.includes('dark luxe') || palette.includes('dark-luxury') || palette.includes('gold')
  ) {
    return {
      id: 'dark_luxe',
      name: 'Dark Luxe Premium',
      description: 'Estética noturna luxuosa com fundo obsidian, detalhes dourados/âmbar, vidro fosco e atmosfera refinada.',
      colors: {
        bg: '#0b0813',
        cardBg: '#130f24',
        accent: '#d97706',
        accentGlow: 'rgba(217, 119, 6, 0.25)',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        border: 'rgba(217, 119, 6, 0.2)'
      },
      typography: {
        headingFont: 'Cinzel, Playfair Display, serif',
        bodyFont: 'Plus Jakarta Sans, sans-serif',
        styleDescription: 'Títulos imponentes em caixa alta ou serif refinada com espaçamento elegante (tracking-wide), contrastando com corpo legível.'
      },
      recommendedHero: 'splitscreen_3d'
    };
  }

  // 2. Clean Medical / Clinical / Estética: Clínicas, Médicos, Estética, Odontologia, Saúde, Dermato
  if (
    seg.includes('clinic') || seg.includes('clínica') || seg.includes('médic') || seg.includes('dentis') ||
    seg.includes('odonto') || seg.includes('estétic') || seg.includes('saúde') || seg.includes('saude') ||
    seg.includes('dermato') || seg.includes('psico') || seg.includes('fisio') || seg.includes('spa') ||
    style.includes('clean medical') || palette.includes('medical')
  ) {
    return {
      id: 'clean_medical',
      name: 'Clean Medical & Clinical',
      description: 'Design limpo, translúcido e acolhedor com tons de ciano/azul royal, verde menta ou rosé suave e máxima legibilidade.',
      colors: {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        accent: '#0284c7',
        accentGlow: 'rgba(2, 132, 199, 0.15)',
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        border: '#e2e8f0'
      },
      typography: {
        headingFont: 'Plus Jakarta Sans, Outfit, sans-serif',
        bodyFont: 'Inter, sans-serif',
        styleDescription: 'Tipografia moderna, limpa, humanizada e acolhedora, transmitindo segurança, higiene e profissionalismo.'
      },
      recommendedHero: 'parallax'
    };
  }

  // 3. High Contrast / Performance: Academias, Crossfit, Personal, Lutas, Esportes
  if (
    seg.includes('academ') || seg.includes('crossfit') || seg.includes('fit') || seg.includes('personal') ||
    seg.includes('treino') || seg.includes('esporte') || seg.includes('luta') || seg.includes('suplement') ||
    style.includes('high contrast') || style.includes('performance') || palette.includes('high-contrast')
  ) {
    return {
      id: 'high_contrast',
      name: 'High Contrast Performance',
      description: 'Fundo escuro profundo com acentos de alto impacto (amarelo limão/verde néon), numerais gigantes e energia extrema.',
      colors: {
        bg: '#050505',
        cardBg: '#121212',
        accent: '#eab308',
        accentGlow: 'rgba(234, 179, 8, 0.3)',
        textPrimary: '#ffffff',
        textSecondary: '#a3a3a3',
        border: '#262626'
      },
      typography: {
        headingFont: 'Chakra Petch, Oswald, sans-serif',
        bodyFont: 'Montserrat, sans-serif',
        styleDescription: 'Títulos em fonte pesada/display, numerais gigantes estilizados para métricas e badges em caixa alta com alto contraste.'
      },
      recommendedHero: 'bento'
    };
  }

  // 4. Warm Natural / Artisanal: Cafés, Padarias, Bistrôs, Confeitarias, Restaurantes Orgânicos
  if (
    seg.includes('café') || seg.includes('cafe') || seg.includes('padaria') || seg.includes('bistrô') ||
    seg.includes('bistro') || seg.includes('confeitar') || seg.includes('pizzaria') || seg.includes('artesanal') ||
    seg.includes('orgânic') || seg.includes('gastronomia') || style.includes('warm natural') || palette.includes('warm')
  ) {
    return {
      id: 'warm_natural',
      name: 'Warm Natural & Artisanal',
      description: 'Tons acolhedores terrosos, creme macio, marrom café, verde oliva e textura artesanal.',
      colors: {
        bg: '#fdfbf7',
        cardBg: '#f5f0e6',
        accent: '#ea580c',
        accentGlow: 'rgba(234, 88, 12, 0.2)',
        textPrimary: '#271c19',
        textSecondary: '#635147',
        border: '#e7dfd3'
      },
      typography: {
        headingFont: 'Lora, Merriweather, serif',
        bodyFont: 'Plus Jakarta Sans, sans-serif',
        styleDescription: 'Títulos em serif artesanal quente e acolhedora, transmitindo sabor, tradição e carinho.'
      },
      recommendedHero: 'parallax'
    };
  }

  // 5. SaaS / Tech / Startup: Startups, Apps, Software, Agências
  if (
    seg.includes('saas') || seg.includes('tech') || seg.includes('software') || seg.includes('startup') ||
    seg.includes('app') || seg.includes('agência') || seg.includes('agencia') || seg.includes('digital')
  ) {
    return {
      id: 'saas_tech',
      name: 'Deep Space Tech & SaaS',
      description: 'Visual futurista em azul marinho/slate com gradientes violeta/cobre e cartões Bento Grid responsivos.',
      colors: {
        bg: '#0f172a',
        cardBg: '#1e293b',
        accent: '#8b5cf6',
        accentGlow: 'rgba(139, 92, 246, 0.3)',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        border: '#334155'
      },
      typography: {
        headingFont: 'Space Grotesk, Inter, sans-serif',
        bodyFont: 'Inter, sans-serif',
        styleDescription: 'Tipografia tecnológica contemporânea com peso marcante nos títulos e clareza no corpo de texto.'
      },
      recommendedHero: 'bento'
    };
  }

  // Fallback Padrão: Corporate Luxury
  return {
    id: 'corporate_luxury',
    name: 'Modern Corporate Luxury',
    description: 'Design contemporâneo sofisticado com fundo escuro elegante, acentos vibrantes e alta conversão.',
    colors: {
      bg: '#0a0c12',
      cardBg: '#121624',
      accent: '#6366f1',
      accentGlow: 'rgba(99, 102, 241, 0.25)',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      border: 'rgba(99, 102, 241, 0.2)'
    },
    typography: {
      headingFont: 'Plus Jakarta Sans, sans-serif',
      bodyFont: 'Inter, sans-serif',
      styleDescription: 'Design limpo, dinâmico e focado em alta conversão comercial.'
    },
    recommendedHero: 'splitscreen_3d'
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

  const customStyleDirective = visualStyle.trim()
    ? `APLIQUE RIGOROSAMENTE O ESTILO VISUAL SOLICITADO: "${visualStyle}". Garanta que a paleta de cores, gradientes neon/luxo, sombras brilhantes glow, vidros foscos e bordas semi-transparentes reflitam perfeitamente esse conceito.`
    : `Siga a paleta do Tema Mapeado [${theme.name}]: Fundo ${theme.colors.bg}, Cartões em ${theme.colors.cardBg}, Acento ${theme.colors.accent} com Glow ${theme.colors.accentGlow} e bordas ${theme.colors.border}.`;

  return `==============================================================================
PROMPT ESTRUTURADO DE ALTA FIDELIDADE — GERADOR DE SITES PROFISSIONAIS
==============================================================================

EMPRESA / NEGÓCIO: "${businessName}"
SEGMENTO DE ATUAÇÃO: "${segment}"
ESTRUTURA DE PÁGINAS (${pagesCount}): ${pagesFormatted}

------------------------------------------------------------------------------
DIRETRIZES OBRIGATÓRIAS DE DESIGN E COMPONENTES (ANTI-LAYOUT GENÉRICO)
------------------------------------------------------------------------------

1. ZERO LAYOUT GENÉRICO (ANTI-TEMPLATE):
   - É ESTRITAMENTE PROIBIDO criar seções padronizadas de 3 colunas simples com cartões idênticos!
   - Utilize Bento Grids com variações de colspans/rowspans (ex: col-span-2, row-span-2) com cartões de tamanhos e destaques variados.
   - Crie layouts assimétricos com profundidade visual, cartões em vidro fosco Glassmorphism (backdrop-blur-md bg-slate-900/60 border border-white/10), iluminação com gradientes radiais/glows e seções splitscreen dinâmicas.

2. HERO SECTION DE ALTO IMPACTO:
   - Elemento 3D / Glassmorphism Refinado: Inclua um objeto 3D interativo com a tag <spline-viewer url="https://prod.spline.design/6Wnt13RekM1bT46U/scene.splinecode"></spline-viewer> ou um container Hero com efeito Glassmorphism refinado (backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.2)]).
   - Tipografia Impactante com Google Fonts: Utilize famílias tipográficas modernas como 'Syne', 'Plus Jakarta Sans', 'Space Grotesk' ou 'Outfit' para títulos imponentes em destaque.
   - Badge Flutuante Interativo Duplo:
     a) Badge Google Maps: Exibindo Nota ${ratingStr} ★ (${reviewsCountNum} avaliações reais) com selo de verificação no Maps.
     b) Badge de Status em Tempo Real: Indicador LED pulsante "🟢 Aberto Agora" (calculado dinamicamente via JS).

3. ANIMAÇÕES E EFEITOS JS INLINE:
   - Lenis Smooth Scroll: Inicialize o Lenis JS para rolagem ultra-suave na página inteira.
   - GSAP ScrollTrigger: Aplique GSAP ScrollTrigger nos elementos (.gsap-reveal) para que as seções e cartões surjam suavemente com animação de fade-up e escala ao rolar a página.
   - Swiper.js 3D: Configure o Swiper.js com efeito de cards (effect: 'cards') ou coverflow (effect: 'coverflow') para as seções de depoimentos e galeria.
   - Microinterações de Hover: Botões com hover de brilho/glow (hover:shadow-[0_0_25px_var(--accent-glow)] hover:scale-105 transition-all duration-300) e cartões que se elevam ao passar o mouse (hover:-translate-y-2 hover:border-purple-500/50 transition-all duration-300).

4. FIDELIDADE RIGOROSA AO ESTILO VISUAL SOLICITADO:
   - ${customStyleDirective}

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

Siga rigorosamente todas as diretrizes acima, entregando o código completo com todas as seções e interatividades solicitadas.`;
}

