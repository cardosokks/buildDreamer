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

export function generateFallbackMultiPageSite(options: FallbackSiteOptions): GeneratedPageOutput[] {
  const businessName = (options.businessName || '').trim() || 'Sua Empresa';
  const segment = (options.segment || '').trim() || 'Serviços Especializados';
  const visualStyle = (options.visualStyle || '').trim() || 'Moderno e Profissional';
  const colorPalette = (options.colorPalette || '').trim() || 'Personalizada';
  const customPrompt = (options.prompt || '').trim() || 'Site institucional de alta conversão';

  const rawPages = (options.pages && options.pages.length > 0) 
    ? options.pages 
    : [{ name: 'Início', slug: 'index', isHomepage: true }];

  // Garante que a primeira página seja a Home (index)
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

  // CSS Global dinâmico baseado no visualStyle e colorPalette escolhidos pelo usuário
  const globalCss = `/* BuildDreamer Custom Design System - ${visualStyle} */
@keyframes pulse-glow {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.animate-pulse-glow {
  animation: pulse-glow 3s ease-in-out infinite;
}
.glass-panel {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.gradient-text {
  background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 50%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.custom-identity-badge {
  /* Estilo customizado: ${visualStyle} | Paleta: ${colorPalette} */
  border-left: 3px solid #8b5cf6;
}`;

  // JavaScript comum interativo (Menu mobile, Accordions de FAQ, envio de formulários)
  const globalJs = `// BuildDreamer Runtime Interactivity
document.addEventListener('DOMContentLoaded', () => {
  // 1. Menu Mobile Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // 2. Accordions de FAQ
  const accordionButtons = document.querySelectorAll('.faq-accordion-btn');
  accordionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.nextElementSibling;
      const icon = btn.querySelector('.faq-icon');
      if (content) {
        content.classList.toggle('hidden');
      }
      if (icon) {
        icon.classList.toggle('rotate-180');
      }
    });
  });

  // 3. Formulário de Contato / Lead
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

  // Gerador de Navbar Compartilhada
  const createNavbar = (currentSlug: string) => `
  <header class="sticky top-0 z-50 glass-panel border-b border-slate-800/80">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-20">
        <!-- Logo -->
        <a href="index.html" class="flex items-center gap-3 group">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
            ${businessName.charAt(0).toUpperCase()}
          </div>
          <span class="text-xl font-bold tracking-tight text-white group-hover:text-purple-300 transition-colors">
            ${businessName}
          </span>
        </a>

        <!-- Desktop Navigation Links -->
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

        <!-- CTA Button -->
        <div class="hidden md:flex items-center gap-4">
          <a href="contato.html" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all">
            Fale Conosco
          </a>
        </div>

        <!-- Mobile Menu Button -->
        <div class="flex md:hidden">
          <button id="mobile-menu-btn" type="button" class="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 focus:outline-none" aria-label="Abrir Menu">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Dropdown Menu -->
    <div id="mobile-menu" class="hidden md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 pt-3 pb-6 space-y-2">
      ${navLinks.map(link => `
        <a href="${link.href}" class="block px-3 py-2.5 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800/80 hover:text-white">
          ${link.name}
        </a>
      `).join('')}
      <div class="pt-3">
        <a href="contato.html" class="block w-full text-center py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-md">
          Solicitar Atendimento
        </a>
      </div>
    </div>
  </header>`;

  // Gerador de Rodapé Compartilhado
  const createFooter = () => `
  <footer class="bg-[#0b0813] border-t border-slate-800 text-slate-400 py-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        <div class="space-y-4 md:col-span-1">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
              ${businessName.charAt(0).toUpperCase()}
            </div>
            <span class="text-lg font-bold text-white">${businessName}</span>
          </div>
          <p class="text-sm text-slate-400 leading-relaxed">
            Excelência e compromisso no segmento de ${segment}. Oferecendo soluções de alto impacto com tecnologia e atendimento personalizado.
          </p>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Navegação</h4>
          <ul class="space-y-2.5 text-sm">
            ${navLinks.map(l => `<li><a href="${l.href}" class="hover:text-purple-400 transition-colors">${l.name}</a></li>`).join('')}
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Contato</h4>
          <ul class="space-y-2 text-sm text-slate-300">
            <li class="flex items-center gap-2"><span>📍</span> Atendimento Nacional e Regional</li>
            <li class="flex items-center gap-2"><span>📞</span> (11) 99999-8888</li>
            <li class="flex items-center gap-2"><span>✉️</span> contato@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br</li>
            <li class="flex items-center gap-2"><span>⏰</span> Seg - Sex: 08h às 18h</li>
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Fique Atualizado</h4>
          <p class="text-xs text-slate-400 mb-3">Receba nossas novidades e ofertas exclusivas por e-mail.</p>
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
  <a href="https://wa.me/5511999998888?text=Ol%C3%A1,%20gostaria%20de%20um%20or%C3%A7amento%20com%20${encodeURIComponent(businessName)}" target="_blank" rel="noopener noreferrer" class="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-400 text-white p-3.5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center gap-2 group" title="Falar no WhatsApp">
    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.771.82 2.79.82h.001c3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.77-5.768zm3.364 8.163c-.144.405-.837.774-1.17.825-.312.048-.718.077-2.146-.514-1.22-.505-1.996-1.748-2.057-1.829-.06-.08-1.429-1.901-1.429-3.626 0-1.724.903-2.571 1.225-2.923.322-.352.704-.442.939-.442.235 0 .47 0 .677.011.22.01.512-.084.8.608.298.718 1.015 2.478 1.104 2.658.089.18.149.392.03.628-.119.236-.179.383-.353.587-.174.204-.367.456-.525.612-.175.174-.358.363-.153.714.205.352.913 1.503 1.96 2.434 1.348 1.198 2.484 1.57 2.836 1.745.352.175.558.146.764-.09.206-.235.882-1.028 1.117-1.38.235-.353.47-.294.793-.176.323.118 2.057.971 2.41 1.147.353.176.587.264.675.411.088.147.088.852-.056 1.257z"></path></svg>
    <span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-bold pr-1">Fale Conosco</span>
  </a>`;

  // Gera o HTML de cada página
  return normalizedPages.map(page => {
    let mainContent = '';

    if (page.isHomepage || page.slug === 'index') {
      mainContent = `
      <!-- Hero Section -->
      <section class="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-[#0a0612] to-[#0a0612] -z-10"></div>
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-300 text-xs font-semibold mb-8 shadow-sm">
            <span class="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
            ✦ Soluções Especializadas em ${segment}
          </div>

          <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 max-w-4xl mx-auto leading-tight">
            Elevando o Padrão de Excelência em <span class="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">${businessName}</span>
          </h1>

          <p class="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Oferecemos uma experiência completa e personalizada para transformar seus resultados com máxima eficiência, segurança e inovação.
          </p>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-16">
            <a href="servicos.html" class="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-[1.02] transition-all">
              Conhecer Nossos Serviços
            </a>
            <a href="contato.html" class="w-full sm:w-auto px-8 py-4 rounded-xl glass-panel text-white hover:bg-slate-800 font-semibold border border-slate-700/80 transition-all">
              Solicitar Orçamento
            </a>
          </div>

          <!-- Trust Proof / Estatísticas -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-slate-800/80">
            <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div class="text-3xl font-black text-purple-400 mb-1">+99%</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider">Satisfação</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div class="text-3xl font-black text-indigo-400 mb-1">+5.000</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider">Clientes Atendidos</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div class="text-3xl font-black text-pink-400 mb-1">24/7</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider">Suporte Ágil</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div class="text-3xl font-black text-emerald-400 mb-1">5 Estrelas</div>
              <div class="text-xs text-slate-400 uppercase tracking-wider">Avaliação Média ⭐</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Bento Grid / Diferenciais -->
      <section class="py-20 bg-[#0d0918]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-2xl mx-auto mb-16">
            <h2 class="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Nossos Diferenciais</h2>
            <h3 class="text-3xl sm:text-4xl font-extrabold text-white">Por que escolher ${businessName}?</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-purple-500/40 transition-all hover:-translate-y-1">
              <div class="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center text-2xl mb-6">⚡</div>
              <h4 class="text-xl font-bold text-white mb-3">Agilidade & Precisão</h4>
              <p class="text-sm text-slate-400 leading-relaxed">Processos otimizados para entregar resultados expressivos no menor tempo e com alto rigor técnico.</p>
            </div>

            <div class="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all hover:-translate-y-1">
              <div class="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-2xl mb-6">🛡️</div>
              <h4 class="text-xl font-bold text-white mb-3">Garantia & Segurança</h4>
              <p class="text-sm text-slate-400 leading-relaxed">Compromisso total com a conformidade, qualidade garantida e segurança de todos os procedimentos.</p>
            </div>

            <div class="p-8 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-pink-500/40 transition-all hover:-translate-y-1">
              <div class="w-12 h-12 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center text-2xl mb-6">💎</div>
              <h4 class="text-xl font-bold text-white mb-3">Atendimento Premium</h4>
              <p class="text-sm text-slate-400 leading-relaxed">Acompanhamento humanizado, consultoria especializada e suporte proativo em todas as etapas.</p>
            </div>
          </div>
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
            <div class="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
              <button type="button" class="faq-accordion-btn w-full p-5 text-left font-semibold text-white flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                <span>Como funciona o atendimento de ${businessName}?</span>
                <span class="faq-icon text-purple-400 transition-transform">▼</span>
              </button>
              <div class="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                Iniciamos com uma análise detalhada das suas necessidades, definimos o plano sob medida e executamos com transparência e relatórios constantes.
              </div>
            </div>

            <div class="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
              <button type="button" class="faq-accordion-btn w-full p-5 text-left font-semibold text-white flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                <span>Quais são os prazos de entrega e valores?</span>
                <span class="faq-icon text-purple-400 transition-transform">▼</span>
              </button>
              <div class="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3 hidden">
                Nossos orçamentos são personalizados de acordo com a complexidade de cada projeto, sempre com preços justos e prazos rigorosamente cumpridos.
              </div>
            </div>

            <div class="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">
              <button type="button" class="faq-accordion-btn w-full p-5 text-left font-semibold text-white flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                <span>Como posso solicitar um orçamento inicial?</span>
                <span class="faq-icon text-purple-400 transition-transform">▼</span>
              </button>
              <div class="px-5 pb-5 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3 hidden">
                Basta clicar no botão "Fale Conosco" ou no ícone do WhatsApp no canto da tela para falar diretamente com um de nossos especialistas.
              </div>
            </div>
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
            <div class="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 transition-all flex flex-col justify-between">
              <div>
                <span class="text-xs font-bold text-purple-400 uppercase tracking-widest bg-purple-950/80 px-3 py-1 rounded-full border border-purple-500/30">Pacote Essencial</span>
                <h3 class="text-2xl font-bold text-white mt-4 mb-3">Consultoria e Diagnóstico</h3>
                <p class="text-sm text-slate-400 mb-6">Mapeamento completo de oportunidades e planejamento tático personalizado.</p>
                <ul class="space-y-2 text-xs text-slate-300 mb-8">
                  <li class="flex items-center gap-2"><span>✓</span> Análise preliminar detalhada</li>
                  <li class="flex items-center gap-2"><span>✓</span> Relatório técnico de recomendações</li>
                  <li class="flex items-center gap-2"><span>✓</span> Suporte durante a implementação</li>
                </ul>
              </div>
              <a href="contato.html" class="w-full py-3 text-center rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors">Solicitar Proposta</a>
            </div>

            <div class="p-8 rounded-2xl bg-slate-900/90 border-2 border-purple-500 relative flex flex-col justify-between shadow-xl shadow-purple-600/20">
              <span class="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full shadow-md">Mais Popular</span>
              <div>
                <span class="text-xs font-bold text-pink-400 uppercase tracking-widest bg-pink-950/80 px-3 py-1 rounded-full border border-pink-500/30">Execução Completa</span>
                <h3 class="text-2xl font-bold text-white mt-4 mb-3">Solução Integrada Premium</h3>
                <p class="text-sm text-slate-400 mb-6">Execução ponta a ponta com acompanhamento contínuo e métricas de desempenho.</p>
                <ul class="space-y-2 text-xs text-slate-300 mb-8">
                  <li class="flex items-center gap-2"><span>✓</span> Tudo do plano essencial</li>
                  <li class="flex items-center gap-2"><span>✓</span> Implementação completa e dedicada</li>
                  <li class="flex items-center gap-2"><span>✓</span> Atendimento prioritário e suporte VIP</li>
                </ul>
              </div>
              <a href="contato.html" class="w-full py-3 text-center rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm shadow-md">Contratar Agora</a>
            </div>

            <div class="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between">
              <div>
                <span class="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-500/30">Corporativo</span>
                <h3 class="text-2xl font-bold text-white mt-4 mb-3">Plano Enterprise</h3>
                <p class="text-sm text-slate-400 mb-6">Projetos sob demanda para grandes operações e demandas de alta escala.</p>
                <ul class="space-y-2 text-xs text-slate-300 mb-8">
                  <li class="flex items-center gap-2"><span>✓</span> SLA garantido de atendimento</li>
                  <li class="flex items-center gap-2"><span>✓</span> Gerente de contas exclusivo</li>
                  <li class="flex items-center gap-2"><span>✓</span> Customizações avançadas</li>
                </ul>
              </div>
              <a href="contato.html" class="w-full py-3 text-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors">Falar com Consultor</a>
            </div>
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
            <!-- Informações -->
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

            <!-- Formulário -->
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

                <button type="submit" class="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all">
                  Enviar Mensagem Agora
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>`;
    } else {
      // Página genérica / personalizada
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
            <a href="contato.html" class="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all">
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
