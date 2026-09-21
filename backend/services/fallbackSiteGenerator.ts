export interface PageDefinition {
  name: string;
  slug: string;
  isHomepage?: boolean;
}

export interface FallbackSiteOptions {
  businessName: string;
  segment: string;
  visualStyle?: string;
  colorPalette?: string;
  prompt?: string;
  pages: PageDefinition[];
}

export interface GeneratedPageOutput {
  id?: string;
  name: string;
  slug: string;
  isHomepage: boolean;
  html: string;
  css: string;
  js: string;
}

interface SegmentPreset {
  badge: string;
  heroTitle: (name: string) => string;
  heroSub: string;
  accentGradient: string;
  accentBg: string;
  primaryColor: string;
  stats: Array<{ value: string; label: string }>;
  features: Array<{ icon: string; title: string; desc: string }>;
  faqs: Array<{ question: string; answer: string }>;
  services: Array<{ title: string; desc: string; items: string[]; badge: string }>;
  testimonial: { quote: string; author: string; role: string };
}

function getSegmentPreset(segment: string, businessName: string): SegmentPreset {
  const seg = (segment || '').toLowerCase();

  // 1. Saúde / Clínica / Odontologia / Medicina
  if (seg.includes('saud') || seg.includes('medic') || seg.includes('clinic') || seg.includes('odont') || seg.includes('dent') || seg.includes('psic') || seg.includes('estet')) {
    return {
      badge: '✦ Atendimento Humanizado & Especializado em Saúde',
      heroTitle: (name) => `Cuidado Médico e Bem-Estar de Excelência na <span class="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">${name}</span>`,
      heroSub: 'Sua saúde e de quem você ama em primeiro lugar. Corpo clínico altamente qualificado, infraestrutura moderna e tecnologia de ponta.',
      accentGradient: 'from-teal-600 to-emerald-600',
      accentBg: 'bg-teal-950/80',
      primaryColor: '#0d9488',
      stats: [
        { value: '+10.000', label: 'Pacientes Atendidos' },
        { value: '15+ Anos', label: 'de Tradição Médica' },
        { value: '4.9/5 ⭐', label: 'Avaliações de Clientes' },
        { value: '100%', label: 'Conforto e Segurança' }
      ],
      features: [
        { icon: '🩺', title: 'Consultas Especializadas', desc: 'Diagnósticos precisos e planos de tratamento preventivos e curativos sob medida.' },
        { icon: '🔬', title: 'Exames e Tecnologia', desc: 'Equipamentos de última geração para exames ágeis e resultados confiáveis.' },
        { icon: '🤝', title: 'Acompanhamento VIP', desc: 'Suporte médico contínuo, lembretes de retorno e atendimento acolhedor.' }
      ],
      faqs: [
        { question: 'Quais convênios médicos vocês aceitam?', answer: 'Atendemos os principais planos de saúde do país, além de consultas particulares com condições facilitadas.' },
        { question: 'Como faço para agendar uma consulta?', answer: 'Você pode agendar diretamente pelo formulário em nosso site ou clicando no botão do WhatsApp no canto da tela.' },
        { question: 'Qual o horário de funcionamento da clínica?', answer: 'Atendemos de Segunda a Sexta, das 08h às 19h, e aos Sábados, das 08h às 13h.' }
      ],
      services: [
        { title: 'Check-Up Preventivo Geral', desc: 'Avaliação clínica completa para manutenção da saúde e prevenção de doenças.', items: ['Exames laboratoriais inclusos', 'Consulta com especialista', 'Relatório completo de saúde'], badge: 'Mais Procurado' },
        { title: 'Tratamento Especializado', desc: 'Acompanhamento médico contínuo focado na sua rápida recuperação e qualidade de vida.', items: ['Plano individualizado', 'Atendimento prioritário', 'Retorno em até 30 dias'], badge: 'Recomendado' },
        { title: 'Procedimentos e Estética', desc: 'Cuidado avançado unindo saúde, bem-estar e autoestima com máxima segurança.', items: ['Profissionais certificados', 'Produtos de alta pureza', 'Ambiente esterilizado'], badge: 'Exclusivo' }
      ],
      testimonial: { quote: 'Atendimento impecável! Toda a equipe da clínica foi extremamente acolhedora e atenciosa.', author: 'Dra. Patricia Lima', role: 'Paciente Mensal' }
    };
  }

  // 2. Tecnologia / SaaS / Software / Inovação
  if (seg.includes('tech') || seg.includes('saas') || seg.includes('softw') || seg.includes('ti') || seg.includes('digital') || seg.includes('sist') || seg.includes('app')) {
    return {
      badge: '✦ Plataforma Digital de Alta Performance & IA',
      heroTitle: (name) => `Acelere seu Crescimento com a Tecnologia da <span class="bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">${name}</span>`,
      heroSub: 'Infraestrutura em nuvem segura, automação inteligente e análises em tempo real para escalar seu negócio sem limites.',
      accentGradient: 'from-purple-600 to-indigo-600',
      accentBg: 'bg-purple-950/80',
      primaryColor: '#9333ea',
      stats: [
        { value: '99.99%', label: 'Uptime Garantido' },
        { value: '+50M', label: 'Requisições / Dia' },
        { value: '< 50ms', label: 'Latência Global' },
        { value: '24/7', label: 'Suporte DevOps' }
      ],
      features: [
        { icon: '🚀', title: 'Automação Inteligente', desc: 'Elimine tarefas repetitivas e aumente a produtividade da sua equipe com fluxos automatizados.' },
        { icon: '🔒', title: 'Segurança End-to-End', desc: 'Criptografia de ponta a ponta e conformidade total com LGPD e normas internacionais.' },
        { icon: '📊', title: 'Analytics em Tempo Real', desc: 'Dashboards visuais e relatórios preditivos para tomadas de decisão baseadas em dados.' }
      ],
      faqs: [
        { question: 'É fácil integrar a plataforma aos meus sistemas atuais?', answer: 'Sim! Possuímos APIs RESTful e Webhooks documentados, além de conectores nativos para as principais ferramentas do mercado.' },
        { question: 'Existe período de teste gratuito?', answer: 'Oferecemos 14 dias de teste grátis sem necessidade de cartão de crédito para você testar todos os recursos.' },
        { question: 'Como funciona o suporte técnico?', answer: 'Nosso time de engenharia está disponível 24 horas por dia, 7 dias por semana, via chat ao vivo e e-mail.' }
      ],
      services: [
        { title: 'Plano Starter / PME', desc: 'Ideal para startups e pequenas empresas acelerarem seus processos com baixo investimento.', items: ['Até 5 usuários inclusos', 'Automação básica', 'Suporte por e-mail'], badge: 'Iniciante' },
        { title: 'Plano Pro Scaler', desc: 'O pacote perfeito para empresas em fase de crescimento acelerado e demanda por métricas.', items: ['Usuários ilimitados', 'APIs e Webhooks completos', 'Suporte prioritário 24/7'], badge: 'Mais Popular' },
        { title: 'Plano Enterprise VIP', desc: 'Soluções customizadas, servidor dedicado e SLA exclusivo para grandes corporações.', items: ['Cluster dedicado', 'Gerente de contas VIP', 'Customizações de IA'], badge: 'Enterprise' }
      ],
      testimonial: { quote: 'Reduzimos nosso tempo de operação em 60% nas primeiras duas semanas usando o sistema.', author: 'Marcos Andrade', role: 'CTO na TechNext' }
    };
  }

  // 3. Direito / Advocacia / Jurídico
  if (seg.includes('advog') || seg.includes('direit') || seg.includes('jurid') || seg.includes('lei') || seg.includes('tribut') || seg.includes('trabalh')) {
    return {
      badge: '✦ Advocacia de Alta Precisão e Defesa Estratégica',
      heroTitle: (name) => `Segurança Jurídica e Proteção de Patrimônio com a <span class="bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-200 bg-clip-text text-transparent">${name}</span>`,
      heroSub: 'Atuação ética, firme e personalizada para defender seus interesses e garantir a melhor solução jurídica para você ou sua empresa.',
      accentGradient: 'from-amber-600 to-amber-800',
      accentBg: 'bg-amber-950/80',
      primaryColor: '#d97706',
      stats: [
        { value: '+98%', label: 'Taxa de Sucesso' },
        { value: '20+ Anos', label: 'de Atuação Jurídica' },
        { value: '+3.500', label: 'Causas Solucionadas' },
        { value: '100%', label: 'Confidencialidade' }
      ],
      features: [
        { icon: '⚖️', title: 'Consultoria Preventiva', desc: 'Blindagem jurídica estratégica para evitar passivos e riscos regulatórios antes que ocorram.' },
        { icon: '📜', title: 'Defesa em Litígios', desc: 'Acompanhamento rigoroso em processos judiciais e arbitrais em todas as instâncias.' },
        { icon: '💼', title: 'Direito Empresarial', desc: 'Assessoria completa para contratos, fusões, tributário e reestruturação corporativa.' }
      ],
      faqs: [
        { question: 'Como agendar uma consulta com um advogado responsável?', answer: 'Entre em contato pelo nosso telefone, formulário do site ou pelo WhatsApp para agendarmos seu atendimento presencial ou online.' },
        { question: 'Vocês atendem fora do estado?', answer: 'Sim, atuamos em todo o território nacional através do processo eletrônico e audiências virtuais.' },
        { question: 'Qual a importância da consultoria preventiva?', answer: 'A consultoria preventiva evita demandas judiciais dispendiosas, garantindo conformidade e economia financeira real.' }
      ],
      services: [
        { title: 'Assessoria Jurídica Empresarial', desc: 'Suporte continuado para contratos, trabalhista e compliance do seu negócio.', items: ['Análise e elaboração de contratos', 'Prevenção de passivos trabalhistas', 'Consultoria fiscal e tributária'], badge: 'Essencial' },
        { title: 'Defesa do Consumidor e Cível', desc: 'Atuação firme na garantia dos seus direitos constitucionais e reparação de danos.', items: ['Ações indenizatórias', 'Direito imobiliário e família', 'Atendimento direto com sócios'], badge: 'Recomendado' },
        { title: 'Planejamento Sucessório e Patrimonial', desc: 'Proteção jurídica para preservação do patrimônio familiar e transição de bens.', items: ['Criação de Holdings familiares', 'Testamentos e doações', 'Isenções e eficiência tributária'], badge: 'VIP' }
      ],
      testimonial: { quote: 'A assessoria jurídica do escritório foi fundamental para a segurança e expansão do nosso grupo empresarial.', author: 'Roberto Fontes', role: 'Diretor do Grupo Fontes' }
    };
  }

  // Preset Padrão Corporate
  return {
    badge: `✦ Soluções Especializadas em ${segment || 'Geral'}`,
    heroTitle: (name) => `Elevando o Padrão de Excelência em <span class="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">${name}</span>`,
    heroSub: `Oferecemos uma experiência completa e personalizada em ${segment || 'Serviços'} para transformar seus resultados com máxima eficiência e qualidade.`,
    accentGradient: 'from-purple-600 to-indigo-600',
    accentBg: 'bg-purple-950/80',
    primaryColor: '#8b5cf6',
    stats: [
      { value: '+99%', label: 'Satisfação dos Clientes' },
      { value: '+5.000', label: 'Projetos Entregues' },
      { value: '24/7', label: 'Atendimento Rápido' },
      { value: '5 Estrelas', label: 'Avaliação Média ⭐' }
    ],
    features: [
      { icon: '⚡', title: 'Agilidade & Precisão', desc: 'Processos otimizados para entregar resultados expressivos no menor tempo e com alto rigor técnico.' },
      { icon: '🛡️', title: 'Garantia & Segurança', desc: 'Compromisso total com a conformidade, qualidade garantida e segurança de todos os procedimentos.' },
      { icon: '💎', title: 'Atendimento Premium', desc: 'Acompanhamento humanizado, consultoria especializada e suporte proativo em todas as etapas.' }
    ],
    faqs: [
      { question: `Como funciona o atendimento da ${businessName}?`, answer: 'Iniciamos com uma análise detalhada das suas necessidades, definimos o plano sob medida e executamos com transparência e relatórios constantes.' },
      { question: 'Quais são os prazos de entrega e valores?', answer: 'Nossos orçamentos são personalizados de acordo com a complexidade de cada projeto, sempre com preços justos e prazos cumpridos.' },
      { question: 'Como posso solicitar um orçamento inicial?', answer: 'Basta clicar no botão "Fale Conosco" ou no ícone do WhatsApp no canto da tela para falar diretamente com um de nossos especialistas.' }
    ],
    services: [
      { title: 'Diagnóstico & Consultoria', desc: 'Mapeamento completo de oportunidades e planejamento tático personalizado para seu negócio.', items: ['Análise técnica inicial', 'Relatório detalhado', 'Acompanhamento de metas'], badge: 'Essencial' },
      { title: 'Plano Integrado Completo', desc: 'Execução ponta a ponta com acompanhamento contínuo e métricas claras de resultado.', items: ['Execução ponta a ponta', 'Suporte prioritário VIP', 'Relatórios mensais'], badge: 'Mais Vendido' },
      { title: 'Atendimento Corporativo VIP', desc: 'Projetos sob demanda e personalizados para grandes operações com suporte exclusivo.', items: ['Atendimento dedicado', 'Garantia contratual de SLA', 'Consultoria executiva'], badge: 'Enterprise' }
    ],
    testimonial: { quote: 'Trabalhar com a equipe da empresa foi divisor de águas no nosso crescimento corporativo.', author: 'Camila Vasconcelos', role: 'Gestora de Projetos' }
  };
}

export function generateFallbackMultiPageSite(options: FallbackSiteOptions): GeneratedPageOutput[] {
  const businessName = (options.businessName || '').trim() || 'Sua Empresa';
  const segment = (options.segment || '').trim() || 'Serviços Especializados';
  const visualStyle = (options.visualStyle || '').trim() || 'Moderno e Profissional';
  const colorPalette = (options.colorPalette || '').trim() || 'Personalizada';

  const preset = getSegmentPreset(segment, businessName);

  const rawPages = (options.pages && options.pages.length > 0) 
    ? options.pages 
    : [{ name: 'Início', slug: 'index', isHomepage: true }];

  const normalizedPages = rawPages.map((p, idx) => ({
    name: p.name || (idx === 0 ? 'Início' : `Página ${idx + 1}`),
    slug: p.slug || (idx === 0 ? 'index' : `pagina-${idx + 1}`),
    isHomepage: p.isHomepage !== undefined ? p.isHomepage : (idx === 0 || p.slug === 'index')
  }));

  const navLinks = normalizedPages.map(p => ({
    name: p.name,
    href: p.isHomepage ? 'index.html' : `${p.slug}.html`,
    slug: p.slug
  }));

  const globalCss = `/* BuildDreamer Design System - ${visualStyle} */
@keyframes pulse-glow {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
}
.glass-panel {
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.gradient-text {
  background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 50%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}`;

  const globalJs = `// BuildDreamer Runtime Interactivity
document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // FAQ Accordion
  const accordionButtons = document.querySelectorAll('.faq-accordion-btn');
  accordionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.nextElementSibling;
      const icon = btn.querySelector('.faq-icon');
      if (content) content.classList.toggle('hidden');
      if (icon) icon.classList.toggle('rotate-180');
    });
  });

  // Contact Form Submission Feedback
  const contactForms = document.querySelectorAll('form');
  contactForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '✓ Mensagem Enviada com Sucesso!';
        submitBtn.classList.add('bg-emerald-600', 'text-white');
        setTimeout(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.classList.remove('bg-emerald-600');
          form.reset();
        }, 4000);
      }
    });
  });
});`;

  const createNavbar = (currentSlug: string) => `
  <header class="sticky top-0 z-50 glass-panel border-b border-slate-800/80">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-20">
        <!-- Logo -->
        <a href="index.html" class="flex items-center gap-3 group">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr ${preset.accentGradient} flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-105 transition-transform">
            ${businessName.charAt(0).toUpperCase()}
          </div>
          <span class="text-xl font-bold tracking-tight text-white group-hover:text-purple-300 transition-colors">
            ${businessName}
          </span>
        </a>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center space-x-1 lg:space-x-2">
          ${navLinks.map(link => {
            const isActive = link.slug === currentSlug;
            return `
            <a href="${link.href}" class="px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
              isActive 
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }">
              ${link.name}
            </a>`;
          }).join('')}
        </nav>

        <!-- CTA -->
        <div class="hidden md:flex items-center gap-4">
          <a href="contato.html" class="px-5 py-2.5 rounded-xl bg-gradient-to-r ${preset.accentGradient} text-white text-sm font-semibold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
            Fale Conosco
          </a>
        </div>

        <!-- Mobile Menu Trigger -->
        <div class="flex md:hidden">
          <button id="mobile-menu-btn" type="button" class="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white" aria-label="Abrir Menu">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          </button>
        </div>
      </div>
    </div>

    <div id="mobile-menu" class="hidden md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 pt-3 pb-6 space-y-2">
      ${navLinks.map(link => `
        <a href="${link.href}" class="block px-3 py-2.5 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800">
          ${link.name}
        </a>
      `).join('')}
      <div class="pt-3">
        <a href="contato.html" class="block w-full text-center py-3 rounded-xl bg-gradient-to-r ${preset.accentGradient} text-white font-semibold">
          Solicitar Atendimento
        </a>
      </div>
    </div>
  </header>`;

  const createFooter = () => `
  <footer class="bg-[#0b0813] border-t border-slate-800 text-slate-400 py-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        <div class="space-y-4 md:col-span-1">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr ${preset.accentGradient} flex items-center justify-center text-white font-bold">
              ${businessName.charAt(0).toUpperCase()}
            </div>
            <span class="text-lg font-bold text-white">${businessName}</span>
          </div>
          <p class="text-sm text-slate-400 leading-relaxed">
            Excelência e compromisso no segmento de ${segment}. Soluções inovadoras de alto impacto com atendimento personalizado.
          </p>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Navegação</h4>
          <ul class="space-y-2.5 text-sm">
            ${navLinks.map(l => `<li><a href="${l.href}" class="hover:text-purple-400 transition-colors">${l.name}</a></li>`).join('')}
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contato Oficial</h4>
          <ul class="space-y-2 text-sm text-slate-300">
            <li class="flex items-center gap-2"><span>📍</span> Atendimento Presencial & Remoto</li>
            <li class="flex items-center gap-2"><span>📞</span> (11) 99999-8888</li>
            <li class="flex items-center gap-2"><span>✉️</span> contato@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br</li>
            <li class="flex items-center gap-2"><span>⏰</span> Seg - Sex: 08h às 18h</li>
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Inscreva-se</h4>
          <p class="text-xs text-slate-400 mb-3">Receba novidades e atualizações por e-mail.</p>
          <form class="flex gap-2">
            <input type="email" placeholder="Seu melhor e-mail" required class="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500" />
            <button type="submit" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shrink-0">Assinar</button>
          </form>
        </div>
      </div>

      <div class="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© ${new Date().getFullYear()} ${businessName}. Todos os direitos reservados.</p>
        <p class="flex gap-4">
          <a href="#" class="hover:text-slate-400">Termos de Uso</a>
          <a href="#" class="hover:text-slate-400">Política de Privacidade</a>
        </p>
      </div>
    </div>
  </footer>

  <!-- Botão Flutuante do WhatsApp -->
  <a href="https://wa.me/5511999998888?text=Ol%C3%A1,%20gostaria%20de%20saber%20mais%20sobre%20${encodeURIComponent(businessName)}" target="_blank" rel="noopener noreferrer" class="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-white p-3.5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center gap-2 group" title="Falar no WhatsApp">
    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.771.82 2.79.82h.001c3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.77-5.768zm3.364 8.163c-.144.405-.837.774-1.17.825-.312.048-.718.077-2.146-.514-1.22-.505-1.996-1.748-2.057-1.829-.06-.08-1.429-1.901-1.429-3.626 0-1.724.903-2.571 1.225-2.923.322-.352.704-.442.939-.442.235 0 .47 0 .677.011.22.01.512-.084.8.608.298.718 1.015 2.478 1.104 2.658.089.18.149.392.03.628-.119.236-.179.383-.353.587-.174.204-.367.456-.525.612-.175.174-.358.363-.153.714.205.352.913 1.503 1.96 2.434 1.348 1.198 2.484 1.57 2.836 1.745.352.175.558.146.764-.09.206-.235.882-1.028 1.117-1.38.235-.353.47-.294.793-.176.323.118 2.057.971 2.41 1.147.353.176.587.264.675.411.088.147.088.852-.056 1.257z"></path></svg>
    <span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold pr-1">Falar no WhatsApp</span>
  </a>`;

  return normalizedPages.map(page => {
    let mainContent = '';

    if (page.isHomepage || page.slug === 'index') {
      mainContent = `
      <!-- Hero Section -->
      <section class="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-[#0a0612] to-[#0a0612] -z-10"></div>
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${preset.accentBg} border border-purple-500/40 text-purple-300 text-xs font-semibold mb-8 shadow-sm">
            <span class="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
            ${preset.badge}
          </div>

          <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-tight">
            ${preset.heroTitle(businessName)}
          </h1>

          <p class="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            ${preset.heroSub}
          </p>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-16">
            <a href="servicos.html" class="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r ${preset.accentGradient} text-white font-bold shadow-xl hover:scale-[1.02] transition-all">
              Conhecer Serviços
            </a>
            <a href="contato.html" class="w-full sm:w-auto px-8 py-4 rounded-xl glass-panel text-white hover:bg-slate-800 font-semibold border border-slate-700/80 transition-all">
              Solicitar Orçamento
            </a>
          </div>

          <!-- Trust Proof / Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-slate-800/80">
            ${preset.stats.map(s => `
            <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div class="text-3xl font-black text-purple-300 mb-1">${s.value}</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider font-medium">${s.label}</div>
            </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Diferenciais / Features Grid -->
      <section class="py-20 bg-[#0d0918]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-2xl mx-auto mb-16">
            <h2 class="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Nossos Diferenciais</h2>
            <h3 class="text-3xl sm:text-4xl font-extrabold text-white">Por que escolher ${businessName}?</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            ${preset.features.map(f => `
            <div class="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition-all hover:-translate-y-1">
              <div class="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center text-2xl mb-6">${f.icon}</div>
              <h4 class="text-xl font-bold text-white mb-3">${f.title}</h4>
              <p class="text-sm text-slate-400 leading-relaxed">${f.desc}</p>
            </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Depoimento Destaque -->
      <section class="py-16 bg-[#0a0612] border-y border-slate-800/60">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div class="text-3xl text-purple-400 mb-4">“</div>
          <blockquote class="text-xl md:text-2xl font-medium text-slate-200 italic mb-6">
            "${preset.testimonial.quote}"
          </blockquote>
          <div class="font-bold text-white">${preset.testimonial.author}</div>
          <div class="text-xs text-purple-400 uppercase tracking-wider mt-1">${preset.testimonial.role}</div>
        </div>
      </section>

      <!-- Seção FAQ Interativo -->
      <section class="py-20 bg-[#0a0612]">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center mb-12">
            <h2 class="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Tire Suas Dúvidas</h2>
            <h3 class="text-3xl font-extrabold text-white">Perguntas Frequentes</h3>
          </div>

          <div class="space-y-4">
            ${preset.faqs.map((faq, i) => `
            <div class="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
              <button type="button" class="faq-accordion-btn w-full p-5 text-left font-semibold text-white flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                <span>${faq.question}</span>
                <span class="faq-icon text-purple-400 transition-transform ${i === 0 ? 'rotate-180' : ''}">▼</span>
              </button>
              <div class="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3 ${i === 0 ? '' : 'hidden'}">
                ${faq.answer}
              </div>
            </div>
            `).join('')}
          </div>
        </div>
      </section>`;
    } else if (page.slug === 'sobre' || page.name.toLowerCase().includes('sobre')) {
      mainContent = `
      <section class="py-20 md:py-28 bg-[#0a0612]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="max-w-3xl mx-auto text-center mb-16">
            <h1 class="text-4xl sm:text-5xl font-extrabold text-white mb-6">Sobre a ${businessName}</h1>
            <p class="text-lg text-slate-300 leading-relaxed">
              Conheça a história, a missão e a equipe apaixonada por entregar excelência em ${segment}.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
            <div class="space-y-6 text-slate-300 leading-relaxed">
              <h2 class="text-2xl font-bold text-white">Nossa Trajetória</h2>
              <p>Fundada com a missão de transformar o mercado, a ${businessName} nasceu unindo inovação técnica, ética inegociável e compromisso com os resultados dos nossos parceiros.</p>
              <p>Ao longo dos anos, consolidamos nossa presença como referência no setor de ${segment}, sempre priorizando a satisfação e o crescimento dos nossos clientes.</p>
            </div>
            <div class="p-8 rounded-2xl bg-gradient-to-br from-purple-950/50 to-indigo-950/40 border border-purple-500/30 space-y-6">
              <h3 class="text-xl font-bold text-white mb-4">Nossos Pilares Fundamentais</h3>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <span class="text-purple-400 font-bold">✓</span>
                  <div><strong class="text-white">Missão:</strong> Entregar valor real e soluções de alto padrão.</div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-indigo-400 font-bold">✓</span>
                  <div><strong class="text-white">Visão:</strong> Ser a marca mais confiável e recomendada em ${segment}.</div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-pink-400 font-bold">✓</span>
                  <div><strong class="text-white">Valores:</strong> Integridade, agilidade, inovação e transparência.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
    } else if (page.slug === 'servicos' || page.name.toLowerCase().includes('serviço') || page.name.toLowerCase().includes('recurso') || page.name.toLowerCase().includes('catalogo')) {
      mainContent = `
      <section class="py-20 md:py-28 bg-[#0a0612]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h1 class="text-4xl sm:text-5xl font-extrabold text-white mb-6">Nossos Serviços & Soluções</h1>
            <p class="text-lg text-slate-300 leading-relaxed">
              Soluções completas e customizadas para suprir todas as necessidades de ${segment}.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            ${preset.services.map((svc, idx) => `
            <div class="p-8 rounded-2xl bg-slate-900/80 border ${idx === 1 ? 'border-2 border-purple-500 shadow-xl shadow-purple-600/20' : 'border-slate-800'} hover:border-purple-500/50 transition-all flex flex-col justify-between">
              <div>
                <span class="text-xs font-bold text-purple-300 uppercase tracking-widest bg-purple-950/80 px-3 py-1 rounded-full border border-purple-500/30">${svc.badge}</span>
                <h3 class="text-2xl font-bold text-white mt-4 mb-3">${svc.title}</h3>
                <p class="text-sm text-slate-400 mb-6">${svc.desc}</p>
                <ul class="space-y-2 text-xs text-slate-300 mb-8">
                  ${svc.items.map(item => `<li class="flex items-center gap-2"><span class="text-emerald-400 font-bold">✓</span> ${item}</li>`).join('')}
                </ul>
              </div>
              <a href="contato.html" class="w-full py-3 text-center rounded-xl bg-gradient-to-r ${preset.accentGradient} text-white font-semibold text-sm transition-all hover:scale-[1.02]">Solicitar Proposta</a>
            </div>
            `).join('')}
          </div>
        </div>
      </section>`;
    } else if (page.slug === 'contato' || page.name.toLowerCase().includes('contato')) {
      mainContent = `
      <section class="py-20 md:py-28 bg-[#0a0612]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h1 class="text-4xl sm:text-5xl font-extrabold text-white mb-6">Entre em Contato Conosco</h1>
            <p class="text-lg text-slate-300 leading-relaxed">
              Estamos prontos para entender seu projeto e oferecer a melhor solução para você.
            </p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">
            <div class="lg:col-span-5 space-y-6">
              <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
                <h3 class="text-lg font-bold text-white mb-4">Informações de Atendimento</h3>
                <div class="space-y-4 text-sm text-slate-300">
                  <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">📞</span>
                    <div>
                      <div class="font-semibold text-white">Telefone & WhatsApp</div>
                      <div class="text-slate-400">(11) 99999-8888</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">✉️</span>
                    <div>
                      <div class="font-semibold text-white">E-mail Comercial</div>
                      <div class="text-slate-400">contato@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center">📍</span>
                    <div>
                      <div class="font-semibold text-white">Localização</div>
                      <div class="text-slate-400">Atendimento presencial e remoto em todo o Brasil</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="lg:col-span-7">
              <form class="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <h3 class="text-xl font-bold text-white mb-2">Envie uma Mensagem</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">Seu Nome *</label>
                    <input type="text" required placeholder="Ex: João da Silva" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-400 mb-1">WhatsApp / Telefone *</label>
                    <input type="tel" required placeholder="(11) 99999-9999" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">Seu E-mail *</label>
                  <input type="email" required placeholder="joao@empresa.com.br" class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-400 mb-1">Mensagem ou Detalhes do Projeto *</label>
                  <textarea rows="4" required placeholder="Conte-nos como podemos lhe ajudar..." class="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 resize-none"></textarea>
                </div>

                <button type="submit" class="w-full py-4 bg-gradient-to-r ${preset.accentGradient} text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.01]">
                  Enviar Mensagem Agora
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>`;
    } else {
      mainContent = `
      <section class="py-20 md:py-28 bg-[#0a0612]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-3xl mx-auto mb-16">
            <h1 class="text-4xl sm:text-5xl font-extrabold text-white mb-6">${page.name}</h1>
            <p class="text-lg text-slate-300 leading-relaxed">
              Conteúdo exclusivo e informações detalhadas sobre ${page.name} na ${businessName}.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
            <div class="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 class="text-xl font-bold text-white">Destaques e Detalhes</h3>
              <p class="text-sm text-slate-300 leading-relaxed">
                Desenvolvemos metodologias comprovadas para garantir que cada detalhe do nosso atendimento em ${segment} atenda aos mais rigorosos padrões de qualidade.
              </p>
            </div>
            <div class="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h3 class="text-xl font-bold text-white">Atendimento Dedicado</h3>
              <p class="text-sm text-slate-300 leading-relaxed">
                Nossa equipe está à disposição para tirar qualquer dúvida e construir soluções sob medida para sua necessidade.
              </p>
            </div>
          </div>

          <div class="text-center">
            <a href="contato.html" class="inline-block px-8 py-4 bg-gradient-to-r ${preset.accentGradient} text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all">
              Fale com um Especialista
            </a>
          </div>
        </div>
      </section>`;
    }

    const fullHtml = `
<div id="canvas-root" class="min-h-screen bg-[#07030e] text-white flex flex-col justify-between font-sans selection:bg-purple-500 selection:text-white">
  ${createNavbar(page.slug)}
  <main class="flex-grow">
    ${mainContent}
  </main>
  ${createFooter()}
</div>`;

    return {
      name: page.name,
      slug: page.slug,
      isHomepage: !!page.isHomepage,
      html: fullHtml,
      css: globalCss,
      js: globalJs
    };
  });
}
