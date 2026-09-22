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
  recommendedHero: 'bento' | 'splitscreen_3d' | 'parallax' | 'saas_mockup' | 'editorial';
}

export interface DigitalFeatureOption {
  id: string;
  label: string;
  description: string;
  category: 'interaction' | 'conversion' | 'visual' | 'social';
  enabled: boolean;
}

export interface SitePageDefinition {
  name: string;
  slug: string;
  isHomepage?: boolean;
  purpose?: string;
  sections?: string[];
}

export interface PromptBuildParams {
  businessName: string;
  segment: string;
  visualStyle?: string;
  colorPalette?: string;
  heroLayout?: 'auto' | 'bento' | 'splitscreen_3d' | 'parallax' | 'saas_mockup' | 'editorial';
  sectionTransitions?: 'waves' | 'slants' | 'curves' | 'overlapping_cards' | 'gradient_glows' | 'auto';
  pagesList?: SitePageDefinition[];
  digitalFeatures?: string[];
  extraInstructions?: string;
  leadInfo?: {
    phone?: string;
    address?: string;
    openingHours?: string;
    rating?: string;
    reviewsCount?: number;
    website?: string;
    instagram?: string;
    email?: string;
  };
}

export const DIGITAL_DESIGN_SOLUTIONS: DigitalFeatureOption[] = [
  {
    id: 'swiper_3d',
    label: 'Carrossel 3D de Avaliações (Swiper.js)',
    description: 'Depoimentos autênticos no estilo Google Maps com efeito 3D Cards / Coverflow e estrelas glowing.',
    category: 'social',
    enabled: true
  },
  {
    id: 'realtime_status',
    label: 'Status em Tempo Real ("🟢 Aberto Agora")',
    description: 'Badge dinâmico calculado via JS com base no horário comercial atual do estabelecimento.',
    category: 'conversion',
    enabled: true
  },
  {
    id: 'floating_whatsapp',
    label: 'Widget Flutuante de WhatsApp Interativo',
    description: 'Botão pulsante com balão de boas-vindas, avatar e link direto preenchido para wa.me.',
    category: 'conversion',
    enabled: true
  },
  {
    id: 'pricing_toggle',
    label: 'Tabela de Preços com Seletor Mensal / Anual',
    description: 'Seletor dinâmico com desconto de 20%, plano em destaque iluminado e comparativo de recursos.',
    category: 'interaction',
    enabled: true
  },
  {
    id: 'animated_counters',
    label: 'Contadores de Estatísticas Animados (GSAP)',
    description: 'Números de impacto (+10k clientes, 99.8% satisfação) com contagem fluída ativada ao rolar a página.',
    category: 'visual',
    enabled: true
  },
  {
    id: 'faq_search',
    label: 'FAQ Accordion com Busca Instantânea',
    description: 'Acordeão interativo com campo de pesquisa em tempo real para filtrar dúvidas frequentes.',
    category: 'interaction',
    enabled: true
  },
  {
    id: 'before_after',
    label: 'Slider Interativo Antes e Depois',
    description: 'Comparador visual arrastável de fotos (ideal para estética, reformas, odontologia, design).',
    category: 'visual',
    enabled: false
  },
  {
    id: 'spline_3d',
    label: 'Objetos 3D Interativos (Spline Viewer)',
    description: 'Cenas 3D renderizadas em WebGL com rotação ao mover o mouse ou tocar na tela.',
    category: 'visual',
    enabled: false
  },
  {
    id: 'lead_confetti',
    label: 'Formulário com Efeito Confete (Canvas Confetti)',
    description: 'Disparo de partículas comemorativas ao submeter formulários de orçamento ou contato com sucesso.',
    category: 'conversion',
    enabled: true
  },
  {
    id: 'interactive_map',
    label: 'Card Interativo de Localização & Traçar Rota',
    description: 'Card integrado com mapa estilizado e botão "Traçar Rota no Google Maps".',
    category: 'conversion',
    enabled: true
  }
];

export const VISUAL_STYLE_PRESETS = [
  {
    id: 'dark_cyber_luxury',
    name: 'Dark Luxury & Neon Glow',
    tagline: 'Obsidiana profunda, roxo e ciano néon, glassmorphism sofisticado',
    previewColors: ['#080c14', '#8b5cf6', '#06b6d4', '#f8fafc'],
    description: 'Perfeito para SaaS, tecnologia, agências digitais, estética de alto padrão e vida noturna.'
  },
  {
    id: 'clean_modern_saas',
    name: 'Clean Modern SaaS (Stripe/Linear)',
    tagline: 'Fundo claro off-white, azul cobalto, sombras suaves e precisão suíça',
    previewColors: ['#f8fafc', '#2563eb', '#64748b', '#0f172a'],
    description: 'Ideal para empresas de software, finanças, consultorias executivas e plataformas B2B.'
  },
  {
    id: 'haute_gold_couture',
    name: 'High-End Gold & Onyx',
    tagline: 'Preto ônix, ouro champanhe, tipografia serifada e arcos editoriais',
    previewColors: ['#0c0a09', '#d97706', '#f59e0b', '#fafaf9'],
    description: 'Ideal para advocacia de elite, clínicas premium, joalherias, gastronomia fina e arquitetura.'
  },
  {
    id: 'vibrant_creative_studio',
    name: 'Vibrant Creative Studio',
    tagline: 'Gradientes ousados, laranja solar, rosa elétrico e grids assimétricos',
    previewColors: ['#0f172a', '#f97316', '#ec4899', '#ffffff'],
    description: 'Perfeito para marcas jovens, estúdios de design, entretenimento, eventos e marketing.'
  },
  {
    id: 'emerald_health_wellness',
    name: 'Emerald Health & Eco Balance',
    tagline: 'Verde esmeralda, tons orgânicos, serenidade e frescor natural',
    previewColors: ['#064e3b', '#10b981', '#a7f3d0', '#ffffff'],
    description: 'Excelente para clínicas médicas, spas, nutrição, odontologia, sustentabilidade e bem-estar.'
  }
];

export const SITE_TYPE_PRESETS: Record<string, {
  name: string;
  description: string;
  defaultPages: SitePageDefinition[];
  recommendedHero: 'bento' | 'splitscreen_3d' | 'parallax' | 'saas_mockup' | 'editorial' | 'auto';
  recommendedTransitions: 'waves' | 'slants' | 'curves' | 'overlapping_cards' | 'gradient_glows' | 'auto';
  features: string[];
}> = {
  institutional: {
    name: 'Institucional & Negócio Local',
    description: 'Estrutura completa para empresas locais, comércio e prestadores de serviços de autoridade.',
    recommendedHero: 'splitscreen_3d',
    recommendedTransitions: 'overlapping_cards',
    features: ['swiper_3d', 'realtime_status', 'floating_whatsapp', 'interactive_map', 'faq_search', 'lead_confetti'],
    defaultPages: [
      { name: 'Início', slug: 'index', isHomepage: true, purpose: 'Apresentação impactante, diferenciais, depoimentos e CTAs principais' },
      { name: 'Sobre Nós', slug: 'sobre', purpose: 'História, missão, valores, pilares e equipe executiva' },
      { name: 'Serviços', slug: 'servicos', purpose: 'Catálogo detalhado de serviços com diferenciais e formulário de proposta' },
      { name: 'Depoimentos & Casos', slug: 'depoimentos', purpose: 'Prova social profunda com notas do Google Maps e histórias de clientes' },
      { name: 'Contato & Localização', slug: 'contato', purpose: 'Formulário completo, mapa interativo, WhatsApp e horários' },
      { name: 'FAQ', slug: 'faq', purpose: 'Perguntas frequentes e central de suporte' }
    ]
  },
  saas: {
    name: 'SaaS & Produto Digital',
    description: 'Arquitetura focada em conversão, métricas, demonstração de produto e planos de assinatura.',
    recommendedHero: 'bento',
    recommendedTransitions: 'gradient_glows',
    features: ['pricing_toggle', 'animated_counters', 'swiper_3d', 'floating_whatsapp', 'lead_confetti'],
    defaultPages: [
      { name: 'Início', slug: 'index', isHomepage: true, purpose: 'Hero bento grid com métricas, preview do software e CTA de teste gratuito' },
      { name: 'Recursos', slug: 'recursos', purpose: 'Detalhamento das funcionalidades, integrações e segurança' },
      { name: 'Preços & Planos', slug: 'precos', purpose: 'Tabela comparativa com alternador mensal/anual e checklist de recursos' },
      { name: 'Casos de Sucesso', slug: 'cases', purpose: 'Resultados e depoimentos de empresas que utilizam a solução' },
      { name: 'Contato & Demonstração', slug: 'contato', purpose: 'Agendamento de demonstração personalizada com especialista' }
    ]
  },
  health_clinic: {
    name: 'Clínica, Saúde & Estética',
    description: 'Design sofisticado que transmite confiança médica, higiene, acolhimento e agendamentos rápidos.',
    recommendedHero: 'editorial',
    recommendedTransitions: 'curves',
    features: ['before_after', 'swiper_3d', 'realtime_status', 'floating_whatsapp', 'interactive_map', 'lead_confetti'],
    defaultPages: [
      { name: 'Início', slug: 'index', isHomepage: true, purpose: 'Apresentação da clínica, procedimentos em destaque e agendamento' },
      { name: 'Procedimentos & Tratamentos', slug: 'procedimentos', purpose: 'Lista de tratamentos com explicações e indicações' },
      { name: 'Corpo Clínico & Especialistas', slug: 'doutores', purpose: 'Apresentação dos médicos/profissionais, formação e CRM' },
      { name: 'Resultados (Antes e Depois)', slug: 'resultados', purpose: 'Galeria de transformações reais com slider interativo' },
      { name: 'Agendar Consulta', slug: 'agendamento', purpose: 'Formulário de pré-agendamento e canal prioritário de WhatsApp' }
    ]
  },
  restaurant_gastro: {
    name: 'Restaurante & Gastronomia',
    description: 'Visual apetitoso, cardápio digital por categorias, reservas de mesas e horário em tempo real.',
    recommendedHero: 'parallax',
    recommendedTransitions: 'waves',
    features: ['realtime_status', 'swiper_3d', 'floating_whatsapp', 'interactive_map', 'lead_confetti'],
    defaultPages: [
      { name: 'Início', slug: 'index', isHomepage: true, purpose: 'Vídeo/Parallax hero, pratos assinatura, status de abertura e reservas' },
      { name: 'Cardápio Completo', slug: 'cardapio', purpose: 'Menu organizado em abas interativas com fotos, ingredientes e preços' },
      { name: 'Nossa História & Chef', slug: 'historia', purpose: 'Tradição gastronômica, ingredientes selecionados e perfil do Chef' },
      { name: 'Reservas de Mesa', slug: 'reservas', purpose: 'Formulário de reserva de mesa com seleção de data, horário e pessoas' },
      { name: 'Contato & Como Chegar', slug: 'contato', purpose: 'Localização, estacionamento, WhatsApp e traçar rota' }
    ]
  },
  real_estate: {
    name: 'Imobiliária & Construtora',
    description: 'Catálogo de imóveis e lançamentos com filtros avançados, tour visual e calculadoras.',
    recommendedHero: 'editorial',
    recommendedTransitions: 'overlapping_cards',
    features: ['animated_counters', 'swiper_3d', 'floating_whatsapp', 'interactive_map', 'lead_confetti'],
    defaultPages: [
      { name: 'Início', slug: 'index', isHomepage: true, purpose: 'Lançamentos em destaque, busca de imóveis e diferenciais' },
      { name: 'Empreendimentos & Imóveis', slug: 'imoveis', purpose: 'Vitrine com filtros por bairro, metragem, dormitórios e valor' },
      { name: 'Sobre a Empresa', slug: 'sobre', purpose: 'Solidez no mercado, metros quadrados construídos e prêmios' },
      { name: 'Fale com um Corretor', slug: 'contato', purpose: 'Atendimento via WhatsApp e agendamento de visita no decorado' }
    ]
  },
  ecommerce_catalog: {
    name: 'E-commerce & Catálogo de Produtos',
    description: 'Vitrine moderna de produtos com categorias, badges promocionais, avaliações e carrinho rápido.',
    recommendedHero: 'saas_mockup',
    recommendedTransitions: 'slants',
    features: ['swiper_3d', 'pricing_toggle', 'floating_whatsapp', 'lead_confetti', 'faq_search'],
    defaultPages: [
      { name: 'Início', slug: 'index', isHomepage: true, purpose: 'Banners promocionais, coleções em destaque e produtos mais vendidos' },
      { name: 'Catálogo de Produtos', slug: 'catalogo', purpose: 'Grade de produtos com filtros de preço, categoria e botão de compra' },
      { name: 'Sobre a Marca', slug: 'sobre', purpose: 'Propósito da marca, fabricação responsável e sustentabilidade' },
      { name: 'Dúvidas & Rastreamento', slug: 'faq', purpose: 'Políticas de frete, troca garantida e perguntas frequentes' },
      { name: 'Atendimento & SAC', slug: 'contato', purpose: 'Canais de suporte ao cliente e WhatsApp oficial' }
    ]
  },
  custom: {
    name: 'Personalizado / Sob Medida',
    description: 'Liberdade total para criar sua própria arquitetura de páginas e conjunto de recursos.',
    recommendedHero: 'auto',
    recommendedTransitions: 'auto',
    features: ['swiper_3d', 'realtime_status', 'floating_whatsapp', 'faq_search'],
    defaultPages: [
      { name: 'Início', slug: 'index', isHomepage: true, purpose: 'Página inicial completa de alto impacto' },
      { name: 'Sobre Nós', slug: 'sobre', purpose: 'História e diferenciais' },
      { name: 'Serviços', slug: 'servicos', purpose: 'Catálogo e soluções' },
      { name: 'Contato', slug: 'contato', purpose: 'Formulário e canais de contato' }
    ]
  }
};

/**
 * Motor de Mapeamento de Temas (Theme Engine 2.0)
 */
export function mapSegmentToTheme(segment: string, userStyle: string = '', userPalette: string = ''): ThemeConfig {
  const seg = (segment || '').toLowerCase();
  const style = (userStyle || '').toLowerCase();

  let recommendedHero: 'bento' | 'splitscreen_3d' | 'parallax' | 'saas_mockup' | 'editorial' = 'splitscreen_3d';
  if (seg.includes('saas') || seg.includes('software') || seg.includes('app') || seg.includes('tech')) {
    recommendedHero = 'bento';
  } else if (seg.includes('restaurante') || seg.includes('hotel') || seg.includes('viagem') || seg.includes('gastro')) {
    recommendedHero = 'parallax';
  } else if (seg.includes('advoc') || seg.includes('luxo') || seg.includes('clini') || seg.includes('imob')) {
    recommendedHero = 'editorial';
  }

  return {
    id: 'ai_autonomous_theme',
    name: style.trim() ? `Estilo Personalizado: "${userStyle}"` : `Design Autônomo para ${segment || 'Geral'}`,
    description: 'Liberdade criativa total da IA para analisar o cliente, a logo/marca e criar uma paleta de cores, iluminação e tipografia 100% sob medida com design contemporâneo.',
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
      headingFont: 'Plus Jakarta Sans, Syne, Outfit, Space Grotesk',
      bodyFont: 'Inter, Plus Jakarta Sans, sans-serif',
      styleDescription: 'Seleção tipográfica de elite com Google Fonts alinhada à autoridade da marca.'
    },
    recommendedHero
  };
}

/**
 * Construtor do Prompt Final Estruturado para o Gerador de Sites Multi-páginas
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
    digitalFeatures = ['swiper_3d', 'realtime_status', 'floating_whatsapp', 'lead_confetti', 'interactive_map', 'faq_search'],
    extraInstructions = '',
    leadInfo
  } = params;

  const theme = mapSegmentToTheme(segment, visualStyle, colorPalette);
  const activeHero = heroLayout === 'auto' ? theme.recommendedHero : heroLayout;

  const pagesCount = pagesList.length;
  const pagesFormatted = pagesList.map((p, i) => `${i + 1}. "${p.name}" (/${p.slug}.html)${p.purpose ? ` — [Objetivo: ${p.purpose}]` : ''}`).join('\n  ');

  const phoneStr = leadInfo?.phone || '(61) 99999-8888';
  const addressStr = leadInfo?.address || 'Endereço Principal, Centro';
  const openingHoursStr = leadInfo?.openingHours || 'Segunda a Sábado: 08:00 - 20:00';
  const ratingStr = leadInfo?.rating || '5.0';
  const reviewsCountNum = leadInfo?.reviewsCount || 128;
  const instagramStr = leadInfo?.instagram || `@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const emailStr = leadInfo?.email || `contato@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`;

  // Enabled features details
  const activeFeaturesDetails = digitalFeatures.map(fId => {
    const feat = DIGITAL_DESIGN_SOLUTIONS.find(d => d.id === fId);
    return feat ? `• ${feat.label}: ${feat.description}` : null;
  }).filter(Boolean).join('\n  ');

  return `==============================================================================
SISTEMA MESTRE DE GERAÇÃO DE SITES MULTI-PÁGINAS COM IA (PADRÃO DIGITAL INTERNACIONAL)
==============================================================================

PASSO 1: IDENTIDADE DA MARCA, DADOS DO CLIENTE & PALETA VISUAL EXCLUSIVA
------------------------------------------------------------------------------
- DADOS OFICIAIS DO CLIENTE (MANDATÓRIO INCLUIR EM TODAS AS PÁGINAS DO SITE):
  • Nome da Empresa: "${businessName}"
  • Ramo / Segmento: "${segment}"
  • Telefone & WhatsApp: "${phoneStr}"
  • Endereço Físico: "${addressStr}"
  • Horário de Atendimento: "${openingHoursStr}"
  • E-mail Comercial: "${emailStr}"
  • Instagram / Redes: "${instagramStr}"
  • Prova Social do Google Maps: Nota ${ratingStr} ⭐ (${reviewsCountNum} avaliações reais 5 estrelas)
  • Website / Domínio: "${leadInfo?.website || 'Disponível no site'}"

- DIRETRIZES DE DESIGN SYSTEM & PALETA DE CORES (100% PERSONALIZADA PELA IA):
  • Estilo Visual Solicitado: "${visualStyle || 'Ultra Moderno, Tecnológico e Persuasivo'}"
  • Cores & Atmosfera: "${colorPalette || 'Paleta refinada sob medida com contraste nítido, sombras suaves e detalhes luminosos'}"
  • Tipografia Google Fonts: Plus Jakarta Sans para títulos impactantes e Inter / Plus Jakarta Sans para leitura clara no corpo.
  • É ESTRITAMENTE PROIBIDO utilizar templates genéricos, cores desbotadas ou layouts ultrapassados! Entregue uma experiência visual digna das melhores agências de design do mundo (Awwwards / Webflow Showcase).

PASSO 2: ARQUITETURA MULTI-PÁGINAS INTEGRADA COM ELEMENTOS GLOBAIS
------------------------------------------------------------------------------
- QUANTIDADE DE PÁGINAS PLANEJADAS: ${pagesCount} página(s) interligadas:
  ${pagesFormatted}

- CONSISTÊNCIA VISUAL ESTRITA EM TODAS AS PÁGINAS:
  • Todas as páginas geradas DEVEM compartilhar a exata mesma paleta de cores, tipografia, efeitos de vidro (Glassmorphism), estilos de botão e bordas arredondadas.
  • 1. HEADER / NAVBAR GLOBAL:
    - Barra de navegação elegante e flutuante no topo (ex: \`backdrop-blur-xl bg-slate-950/70 border border-white/10 rounded-full\`).
    - Exibe o logotipo de "${businessName}".
    - Links de navegação apontando precisamente para cada página: ${pagesList.map(p => `"${p.name}" (href="${p.slug}.html")`).join(', ')}.
    - Destaque visual nítido para o link da página ativa.
    - Botão de Ação CTA "Fale no WhatsApp" com brilho glow e menu mobile responsivo funcional.
  • 2. FOOTER / RODAPÉ GLOBAL:
    - Estrutura completa em 4 colunas: Apresentação da marca, links rápidos de todas as páginas, dados de contato oficiais (${phoneStr}, ${addressStr}, ${emailStr}) e horário de funcionamento (${openingHoursStr}).
    - Badges de segurança e copyright oficial.
  • 3. WIDGET FLUTUANTE DE CONVERSÃO:
    - Botão flutuante de WhatsApp fixo no canto inferior direito com indicador LED pulsante e mensagem pré-configurada.

PASSO 3: MOTOR DE RECURSOS DE DESIGN & SOLUÇÕES DIGITAIS DE PONTA
------------------------------------------------------------------------------
- RECURSOS DIGITAIS SELECIONADOS PARA ESTE PROJETO:
  ${activeFeaturesDetails || '• Todos os recursos de conversão e animação habilitados.'}

- ESTRUTURA DO HERO SECTION PRINCIPAL: [${activeHero.toUpperCase()}]
  ${activeHero === 'bento' ? `
  • Bento Grid 2.0: Layout assimétrico em grid de 12 colunas com cards dinâmicos: métricas com contadores animados, card de autoridade Google Maps, card de preview visual do produto/serviço e CTAs luminosos duplos.
  ` : activeHero === 'splitscreen_3d' ? `
  • Splitscreen 3D: Lado esquerdo com copywriting de alta conversão, badge duplo ("🟢 Aberto Agora" + "⭐ ${ratingStr} Maps"), headline imponente com gradiente e lista de benefícios com ícones Lucide. Lado direito com elemento visual 3D interativo ou Glassmorphism multicamadas com luz de fundo radial.
  ` : activeHero === 'parallax' ? `
  • Parallax Header Imersivo: Background com imagem/vídeo em alta resolução, efeito de rolagem Parallax controlado por GSAP, overlay em gradiente cinematográfico, headline centralizada e CTAs com microinteração.
  ` : activeHero === 'editorial' ? `
  • High-End Editorial: Tipografia nobre com espaçamento generoso, contrastes clássicos, fotos de catálogo de alta fidelidade (Unsplash) e selos de autenticidade.
  ` : `
  • SaaS Mockup Showcase: Headline clara focada em resolver dores, CTAs duplos e preview interativo de interface (mockup com abas ou navegador estilizado).
  `}

- TRANSIÇÕES DE SEÇÃO (ANTI-LAYOUT QUADRADO): [${sectionTransitions.toUpperCase()}]
  • Alterne as seções utilizando divisores em Ondas SVG orgânicas, Cortes Diagonais modernos (Slants), Cartões Flutuantes Sobrepostos cruzando a fronteira de seções (-mt-14 relative z-20) e Linhas Néon com Glow.

------------------------------------------------------------------------------
CDNS E BIBLIOTECAS OBRIGATÓRIAS NO <head> (INCLUÍDAS PELA PLATAFORMA):
------------------------------------------------------------------------------
- Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
- Lucide Icons CDN: <script src="https://unpkg.com/lucide@latest"></script>
- Google Fonts: Plus Jakarta Sans, Syne, Space Grotesk, Outfit, Inter, Cinzel.
- GSAP 3.12 & ScrollTrigger: Animações e scroll reveals (.gsap-reveal).
- Lenis Smooth Scroll 1.1: Rolagem suave de luxo.
- Swiper.js 11: Sliders e Carrosséis 3D (swiper-bundle.min.js & swiper-bundle.min.css).
- Spline Viewer 3D: <script type="module" src="https://unpkg.com/@splinetool/viewer/build/spline-viewer.js"></script>
- Canvas Confetti: <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>

------------------------------------------------------------------------------
INSTRUÇÕES ESPECÍFICAS ADICIONAIS:
------------------------------------------------------------------------------
${extraInstructions ? extraInstructions : 'Gere um site completo, 100% responsivo para desktop e mobile, com código limpo, semântico e interatividades ricas em JavaScript.'}

Siga com precisão cirúrgica a arquitetura acima, entregando o código completo com todas as seções e interações ativas.`;
}
