/**
 * Starter Templates para Páginas do Website Builder (HTML + CSS + JS)
 */

export interface StarterTemplate {
  html: string;
  css: string;
  js: string;
}

const COMMON_BASE_CSS = `/* Animações e Estilos Globais do Template */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

@keyframes floatSmooth {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

.animate-fade-in {
  animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-float {
  animation: floatSmooth 4s ease-in-out infinite;
}

.pulse-glow {
  animation: pulseGlow 3s ease-in-out infinite;
}

html {
  scroll-behavior: smooth;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #090d16;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
`;

const COMMON_BASE_JS = `// Interatividade Global e Inicializações
(function() {
  // 1. Rolagem Suave para Links Internos (#)
  document.addEventListener('click', function(e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
      const targetId = anchor.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  });

  // 2. Interatividade de Formulários com Feedback
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    if (form.getAttribute('data-bound')) return;
    form.setAttribute('data-bound', 'true');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn ? btn.innerHTML : '';
      
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ Enviando...';
      }

      setTimeout(() => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '✅ Mensagem Enviada!';
          btn.classList.add('bg-emerald-600');
        }
        form.reset();
        setTimeout(() => {
          if (btn) btn.innerHTML = originalText;
        }, 3000);
      }, 1000);
    });
  });

  // 3. Efeito Parallax/Revelação em Elementos de Tela
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('section, .p-6, .grid > div').forEach(el => observer.observe(el));
  }
})();
`;

export function getPageStarterTemplate(
  templateType: string,
  pageName: string,
  businessName: string = 'REAL PREMISE'
): StarterTemplate {
  const safeName = pageName || 'Nova Página';

  switch (templateType) {
    case 'landing':
      return {
        html: `
<section class="relative py-20 px-6 bg-slate-950 text-white overflow-hidden">
  <div class="max-w-6xl mx-auto text-center space-y-6">
    <span class="inline-block px-3 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-full text-xs font-semibold uppercase tracking-wider pulse-glow">
      Lançamento Exclusivo
    </span>
    <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
      Transforme Seus Resultados com <span class="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">${businessName}</span>
    </h1>
    <p class="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-light">
      Soluções modernas e inteligentes desenvolvidas para elevar a presença digital do seu negócio ao próximo nível.
    </p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
      <a href="#contato" class="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-2xl shadow-lg shadow-purple-600/30 transition-all transform hover:-translate-y-0.5">
        Começar Agora
      </a>
      <a href="#recursos" class="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold rounded-2xl transition-all">
        Saber Mais
      </a>
    </div>
  </div>
</section>

<section id="recursos" class="py-16 px-6 bg-slate-900 text-slate-100">
  <div class="max-w-6xl mx-auto space-y-12">
    <div class="text-center space-y-3">
      <h2 class="text-3xl font-bold text-white">Nossos Diferenciais</h2>
      <p class="text-sm text-slate-400 max-w-lg mx-auto">Tecnologia de ponta aliada ao design pensado para máxima conversão.</p>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 hover:border-purple-500/40 transition-all transform hover:-translate-y-1">
        <div class="w-12 h-12 bg-purple-950/60 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400 font-bold text-xl animate-float">⚡</div>
        <h3 class="text-lg font-bold text-white">Alta Velocidade</h3>
        <p class="text-xs text-slate-400 leading-relaxed">Páginas ultra-otimizadas com tempo de carregamento inferior a 1 segundo para o cliente final.</p>
      </div>

      <div class="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 hover:border-pink-500/40 transition-all transform hover:-translate-y-1">
        <div class="w-12 h-12 bg-pink-950/60 border border-pink-500/30 rounded-xl flex items-center justify-center text-pink-400 font-bold text-xl animate-float">🎯</div>
        <h3 class="text-lg font-bold text-white">Foco em Conversão</h3>
        <p class="text-xs text-slate-400 leading-relaxed">Layout projetado estrategicamente com gatilhos de vendas e formulários interativos.</p>
      </div>

      <div class="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 hover:border-indigo-500/40 transition-all transform hover:-translate-y-1">
        <div class="w-12 h-12 bg-indigo-950/60 border border-indigo-500/30 rounded-xl flex items-center justify-center text-indigo-400 font-bold text-xl animate-float">📱</div>
        <h3 class="text-lg font-bold text-white">100% Responsivo</h3>
        <p class="text-xs text-slate-400 leading-relaxed">Navegação perfeita adaptada para celulares, tablets, notebooks e telas ultra-wide.</p>
      </div>
    </div>
  </div>
</section>
        `,
        css: `${COMMON_BASE_CSS}\n/* Custom Landing Page Styles */\n.hero-gradient {\n  background: radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.15) 0%, transparent 70%);\n}`,
        js: `${COMMON_BASE_JS}\n// Landing Page Custom Interactivity`
      };

    case 'about':
      return {
        html: `
<section class="py-20 px-6 bg-slate-950 text-white">
  <div class="max-w-5xl mx-auto space-y-12">
    <div class="text-center space-y-4">
      <span class="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-950/50 border border-indigo-500/30 px-3 py-1 rounded-full">
        Conheça Nossa História
      </span>
      <h1 class="text-4xl font-extrabold tracking-tight">${safeName} - ${businessName}</h1>
      <p class="text-base text-slate-400 max-w-2xl mx-auto">
        Compromisso com a excelência, inovação constante e foco total no sucesso dos nossos parceiros e clientes.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-900 border border-slate-800 p-8 rounded-3xl">
      <div class="space-y-4">
        <h2 class="text-2xl font-bold text-white">Quem Somos</h2>
        <p class="text-xs text-slate-300 leading-relaxed">
          Fundada com o propósito de revolucionar o mercado local, oferecemos um atendimento humanizado e soluções tecnológicas customizadas para cada necessidade.
        </p>
        <p class="text-xs text-slate-400 leading-relaxed">
          Nossa equipe é formada por especialistas focados em resultados palpáveis e crescimento sustentável.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-4 text-center">
        <div class="p-5 bg-slate-950 rounded-2xl border border-slate-800 transform hover:scale-105 transition-all">
          <span class="text-3xl font-extrabold text-indigo-400 counter-stat" data-target="500">+500</span>
          <span class="block text-[11px] text-slate-400 mt-1">Clientes Atendidos</span>
        </div>
        <div class="p-5 bg-slate-950 rounded-2xl border border-slate-800 transform hover:scale-105 transition-all">
          <span class="text-3xl font-extrabold text-purple-400">99.8%</span>
          <span class="block text-[11px] text-slate-400 mt-1">Satisfação</span>
        </div>
        <div class="p-5 bg-slate-950 rounded-2xl border border-slate-800 transform hover:scale-105 transition-all">
          <span class="text-3xl font-extrabold text-pink-400">24/7</span>
          <span class="block text-[11px] text-slate-400 mt-1">Suporte Dedicado</span>
        </div>
        <div class="p-5 bg-slate-950 rounded-2xl border border-slate-800 transform hover:scale-105 transition-all">
          <span class="text-3xl font-extrabold text-emerald-400">10+</span>
          <span class="block text-[11px] text-slate-400 mt-1">Anos de Experiência</span>
        </div>
      </div>
    </div>
  </div>
</section>
        `,
        css: `${COMMON_BASE_CSS}\n/* Custom About Styles */`,
        js: `${COMMON_BASE_JS}\n// About Page Interactivity`
      };

    case 'services':
      return {
        html: `
<section class="py-20 px-6 bg-slate-950 text-slate-100">
  <div class="max-w-6xl mx-auto space-y-12">
    <div class="text-center space-y-3">
      <span class="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-950/40 border border-cyan-500/30 px-3 py-1 rounded-full">
        Soluções Completas
      </span>
      <h1 class="text-4xl font-extrabold text-white">Nossos Serviços Especializados</h1>
      <p class="text-sm text-slate-400 max-w-xl mx-auto">Descubra como podemos ajudar a alavancar a sua empresa com nossos pacotes customizados.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 hover:border-cyan-500/40 transition-all flex flex-col justify-between transform hover:-translate-y-1">
        <div class="space-y-3">
          <span class="text-2xl animate-float inline-block">💼</span>
          <h3 class="text-xl font-bold text-white">Consultoria Estratégica</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Mapeamento de gargalos, diagnóstico de processos e plano de ação estruturado para otimizar operações.</p>
        </div>
        <a href="#contato" class="w-full py-2.5 text-center bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold transition-all">
          Solicitar Orçamento
        </a>
      </div>

      <div class="p-6 bg-slate-900 border border-cyan-500/40 rounded-3xl space-y-4 shadow-xl shadow-cyan-950/30 flex flex-col justify-between relative transform hover:-translate-y-1">
        <span class="absolute -top-3 right-6 bg-gradient-to-r from-cyan-500 to-purple-500 text-slate-950 text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase">
          Mais Procurado
        </span>
        <div class="space-y-3">
          <span class="text-2xl animate-float inline-block">🚀</span>
          <h3 class="text-xl font-bold text-white">Desenvolvimento Sob Medida</h3>
          <p class="text-xs text-slate-300 leading-relaxed">Criação de sistemas web, landing pages e integrações exclusivas focadas em performance e segurança.</p>
        </div>
        <a href="#contato" class="w-full py-2.5 text-center bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-md">
          Contratar Agora
        </a>
      </div>

      <div class="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 hover:border-cyan-500/40 transition-all flex flex-col justify-between transform hover:-translate-y-1">
        <div class="space-y-3">
          <span class="text-2xl animate-float inline-block">📈</span>
          <h3 class="text-xl font-bold text-white">Gestão & Manutenção</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Acompanhamento contínuo, backups automatizados, relatórios de dados e suporte prioritário.</p>
        </div>
        <a href="#contato" class="w-full py-2.5 text-center bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold transition-all">
          Solicitar Orçamento
        </a>
      </div>
    </div>
  </div>
</section>
        `,
        css: `${COMMON_BASE_CSS}\n/* Custom Services Styles */`,
        js: `${COMMON_BASE_JS}\n// Services Page Interactivity`
      };

    case 'contact':
      return {
        html: `
<section id="contato" class="py-20 px-6 bg-slate-950 text-white">
  <div class="max-w-5xl mx-auto space-y-12">
    <div class="text-center space-y-3">
      <span class="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-full">
        Fale Conosco
      </span>
      <h1 class="text-4xl font-extrabold">Entre em Contato</h1>
      <p class="text-xs text-slate-400 max-w-md mx-auto">Estamos prontos para atender você. Envie uma mensagem e responderemos em breve.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
      <div class="md:col-span-5 space-y-6 bg-slate-900 p-6 rounded-3xl border border-slate-800">
        <h3 class="text-lg font-bold text-white">Informações de Atendimento</h3>
        
        <div class="space-y-4 text-xs">
          <div class="flex items-start gap-3">
            <div class="p-2 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-500/30">📍</div>
            <div>
              <strong class="block text-white">Endereço:</strong>
              <span class="text-slate-400">Atendimento presencial e online</span>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="p-2 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-500/30">📞</div>
            <div>
              <strong class="block text-white">Telefone / WhatsApp:</strong>
              <span class="text-slate-400">(00) 99999-9999</span>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="p-2 bg-emerald-950/60 text-emerald-400 rounded-xl border border-emerald-500/30">✉️</div>
            <div>
              <strong class="block text-white">E-mail:</strong>
              <span class="text-slate-400">contato@${businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com</span>
            </div>
          </div>
        </div>
      </div>

      <form class="md:col-span-7 bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 class="text-lg font-bold text-white">Envie sua Mensagem</h3>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Seu Nome</label>
          <input type="text" required placeholder="Digite seu nome completo" class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Seu E-mail ou WhatsApp</label>
          <input type="text" required placeholder="exemplo@email.com ou (00) 99999-9999" class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Como podemos ajudar?</label>
          <textarea rows="4" required placeholder="Escreva os detalhes da sua solicitação..." class="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"></textarea>
        </div>
        <button type="submit" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer">
          Enviar Mensagem
        </button>
      </form>
    </div>
  </div>
</section>
        `,
        css: `${COMMON_BASE_CSS}\n/* Custom Contact Styles */`,
        js: `${COMMON_BASE_JS}\n// Contact Form Handlers`
      };

    case 'pricing':
      return {
        html: `
<section class="py-20 px-6 bg-slate-950 text-white">
  <div class="max-w-6xl mx-auto space-y-12">
    <div class="text-center space-y-3">
      <span class="text-xs font-bold text-amber-400 uppercase tracking-widest bg-amber-950/40 border border-amber-500/30 px-3 py-1 rounded-full">
        Investimento Transparente
      </span>
      <h1 class="text-4xl font-extrabold">Planos e Preços</h1>
      <p class="text-xs text-slate-400 max-w-md mx-auto">Escolha o plano ideal para a escala do seu negócio sem taxas escondidas.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all">
        <div class="space-y-4">
          <h3 class="text-lg font-bold text-white">Básico</h3>
          <div class="text-3xl font-extrabold text-amber-400">R$ 99 <span class="text-xs font-normal text-slate-400">/mês</span></div>
          <ul class="space-y-2 text-xs text-slate-300">
            <li>✓ Até 3 Páginas Otimizadas</li>
            <li>✓ Hospedagem Inclusa</li>
            <li>✓ Formulário de Contato</li>
            <li>✓ Suporte via E-mail</li>
          </ul>
        </div>
        <a href="#contato" class="w-full py-2.5 text-center bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-all">Assinar Básico</a>
      </div>

      <div class="bg-slate-900 border border-amber-500/50 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-xl shadow-amber-950/30 relative transform hover:-translate-y-1 transition-all">
        <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-extrabold text-[10px] px-3 py-0.5 rounded-full uppercase">Mais Recomendado</span>
        <div class="space-y-4">
          <h3 class="text-lg font-bold text-white">Profissional</h3>
          <div class="text-3xl font-extrabold text-amber-400">R$ 199 <span class="text-xs font-normal text-slate-400">/mês</span></div>
          <ul class="space-y-2 text-xs text-slate-200">
            <li>✓ Páginas Ilimitadas</li>
            <li>✓ Domínio Customizado</li>
            <li>✓ Integração com WhatsApp & CRM</li>
            <li>✓ Suporte Prioritário 24/7</li>
          </ul>
        </div>
        <a href="#contato" class="w-full py-2.5 text-center bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md">Começar Agora</a>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all">
        <div class="space-y-4">
          <h3 class="text-lg font-bold text-white">Enterprise</h3>
          <div class="text-3xl font-extrabold text-amber-400">Personalizado</div>
          <ul class="space-y-2 text-xs text-slate-300">
            <li>✓ Projeto 100% Exclusivo</li>
            <li>✓ Integração com Banco de Dados</li>
            <li>✓ Treinamento da Equipe</li>
            <li>✓ Gerente de Conta Dedicado</li>
          </ul>
        </div>
        <a href="#contato" class="w-full py-2.5 text-center bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold transition-all">Falar com Consultor</a>
      </div>
    </div>
  </div>
</section>
        `,
        css: `${COMMON_BASE_CSS}\n/* Custom Pricing Styles */`,
        js: `${COMMON_BASE_JS}\n// Pricing Page Interactivity`
      };

    case 'portfolio':
      return {
        html: `
<section class="py-20 px-6 bg-slate-950 text-white">
  <div class="max-w-6xl mx-auto space-y-12">
    <div class="text-center space-y-3">
      <span class="text-xs font-bold text-pink-400 uppercase tracking-widest bg-pink-950/40 border border-pink-500/30 px-3 py-1 rounded-full">
        Casos de Sucesso
      </span>
      <h1 class="text-4xl font-extrabold">Nosso Portfólio</h1>
      <p class="text-xs text-slate-400 max-w-md mx-auto">Confira alguns dos projetos mais recentes desenvolvidos por nossa equipe.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-pink-500/40 transition-all group transform hover:-translate-y-1">
        <div class="h-48 bg-gradient-to-tr from-purple-900 to-slate-900 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">💻</div>
        <div class="p-5 space-y-2">
          <h3 class="font-bold text-white text-base">Portal E-commerce Premium</h3>
          <p class="text-xs text-slate-400">Plataforma de alta performance com checkout otimizado.</p>
        </div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-pink-500/40 transition-all group transform hover:-translate-y-1">
        <div class="h-48 bg-gradient-to-tr from-pink-900 to-slate-900 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">📱</div>
        <div class="p-5 space-y-2">
          <h3 class="font-bold text-white text-base">App Institucional Médico</h3>
          <p class="text-xs text-slate-400">Sistema de agendamento online integrado com prontuários.</p>
        </div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden hover:border-pink-500/40 transition-all group transform hover:-translate-y-1">
        <div class="h-48 bg-gradient-to-tr from-indigo-900 to-slate-900 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">🏢</div>
        <div class="p-5 space-y-2">
          <h3 class="font-bold text-white text-base">Landing Page de Imobiliária</h3>
          <p class="text-xs text-slate-400">Aumento de +180% na captura de leads qualificados.</p>
        </div>
      </div>
    </div>
  </div>
</section>
        `,
        css: `${COMMON_BASE_CSS}\n/* Custom Portfolio Styles */`,
        js: `${COMMON_BASE_JS}\n// Portfolio Interactivity`
      };

    case 'blank':
    default:
      return {
        html: `
<section class="py-20 px-6 bg-slate-950 text-white min-h-[60vh] flex flex-col items-center justify-center text-center">
  <div class="max-w-xl mx-auto space-y-4">
    <div class="w-16 h-16 mx-auto bg-purple-950/60 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 font-bold text-2xl animate-float">
      ✦
    </div>
    <h1 class="text-3xl font-bold text-white">${safeName}</h1>
    <p class="text-xs text-slate-400 leading-relaxed">
      Esta é a sua nova página. Arraste blocos e componentes da barra lateral ou utilize o assistente de IA para construir seu conteúdo com animações e JS interativo.
    </p>
  </div>
</section>
        `,
        css: `${COMMON_BASE_CSS}\n/* Custom Styles para ${safeName} */`,
        js: `${COMMON_BASE_JS}\n// Custom JS para ${safeName}`
      };
  }
}

