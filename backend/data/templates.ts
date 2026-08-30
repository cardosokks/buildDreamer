export const templates = {
  saas: {
    html: `
<div class="min-h-screen bg-white text-slate-900 font-sans">
  <header class="border-b border-slate-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <span class="text-2xl font-bold text-indigo-600">SaaSLogo</span>
        </div>
        <nav class="hidden md:flex space-x-8">
          <a href="#features" class="text-slate-600 hover:text-indigo-600 transition-colors">Features</a>
          <a href="#pricing" class="text-slate-600 hover:text-indigo-600 transition-colors">Pricing</a>
          <a href="#testimonials" class="text-slate-600 hover:text-indigo-600 transition-colors">Testimonials</a>
        </nav>
        <div class="flex items-center space-x-4">
          <a href="#" class="text-slate-600 hover:text-indigo-600 font-medium">Log in</a>
          <a href="#" class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm">Get Started</a>
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- Hero Section -->
    <section class="py-20 lg:py-32 overflow-hidden relative">
      <div class="absolute inset-0 bg-gradient-to-br from-indigo-50 to-white -z-10"></div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
          Build better software, <span class="text-indigo-600">faster.</span>
        </h1>
        <p class="mt-4 max-w-2xl text-xl text-slate-600 mx-auto mb-10">
          The ultimate platform for modern engineering teams. Ship features twice as fast with zero technical debt.
        </p>
        <div class="flex justify-center gap-4">
          <a href="#" class="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30">
            Start free trial
          </a>
          <a href="#" class="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl font-semibold hover:bg-slate-50 transition-colors shadow-sm">
            View demo
          </a>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 bg-slate-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-slate-900">Everything you need to scale</h2>
          <p class="mt-4 text-lg text-slate-600">Powerful features designed for high-performance teams.</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Feature 1 -->
          <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
              <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-3">Lightning Fast</h3>
            <p class="text-slate-600">Built on modern architecture ensuring your applications run at peak performance.</p>
          </div>
          <!-- Feature 2 -->
          <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
              <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-3">Bank-grade Security</h3>
            <p class="text-slate-600">Your data is protected by enterprise-level encryption and security protocols.</p>
          </div>
          <!-- Feature 3 -->
          <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div class="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
              <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-slate-900 mb-3">Real-time Sync</h3>
            <p class="text-slate-600">Collaborate with your team in real-time. Changes are instantly synced across all devices.</p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="bg-slate-900 py-12 text-center text-slate-400">
    <div class="max-w-7xl mx-auto px-4">
      <div class="text-2xl font-bold text-white mb-6">SaaSLogo</div>
      <p>&copy; 2026 SaaS Company. All rights reserved.</p>
    </div>
  </footer>
</div>
    `,
    css: 'body { font-family: "Inter", sans-serif; }',
    js: ''
  },
  local: {
    html: `
<div class="min-h-screen font-sans bg-stone-50">
  <!-- Topbar -->
  <div class="bg-amber-800 text-stone-100 text-sm py-2">
    <div class="max-w-6xl mx-auto px-4 flex justify-between items-center">
      <div class="flex items-center gap-4">
        <span class="flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> (11) 9999-9999</span>
        <span class="hidden md:flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Seg-Sáb: 08:00 às 20:00</span>
      </div>
      <div>
        <a href="#" class="hover:text-amber-200 transition-colors">Agendar Horário</a>
      </div>
    </div>
  </div>

  <!-- Header -->
  <header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
      <div class="text-3xl font-serif font-bold text-amber-900">
        EmpresaLocal
      </div>
      <nav class="hidden md:flex space-x-6 text-stone-600 font-medium">
        <a href="#sobre" class="hover:text-amber-800 transition-colors">Sobre Nós</a>
        <a href="#servicos" class="hover:text-amber-800 transition-colors">Serviços</a>
        <a href="#localizacao" class="hover:text-amber-800 transition-colors">Localização</a>
      </nav>
      <a href="https://wa.me/5511999999999" target="_blank" class="bg-green-600 text-white px-5 py-2.5 rounded-full font-bold hover:bg-green-700 transition-all shadow-md flex items-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.898-4.45 9.896-9.898-.002-5.462-4.452-9.897-9.902-9.897-5.448 0-9.898 4.45-9.896 9.898.001 1.942.535 3.738 1.516 5.338l-.946 3.461 3.94-1.034zm10.364-7.469c-.571-.286-3.376-1.666-3.901-1.856-.525-.19-.904-.286-1.284.286-.38.571-1.474 1.856-1.807 2.237-.333.38-.667.428-1.238.143-1.884-.94-3.628-2.618-4.47-3.823-.217-.311.218-.288.775-1.402.143-.286.072-.536-.036-.75-.107-.214-1.284-3.095-1.758-4.238-.462-1.116-.928-.964-1.284-.981-.334-.015-.715-.015-1.096-.015-.38 0-1.001.143-1.524.714-2.127 2.327-1.127 6.136 1.05 9.07 1.156 1.554 4.093 6.772 9.531 8.874 4.088 1.583 5.485 1.171 6.46 1.042 1.341-.177 3.376-1.378 3.851-2.709.475-1.331.475-2.474.333-2.709-.143-.235-.523-.378-1.094-.664z"/></svg>
        WhatsApp
      </a>
    </div>
  </header>

  <main>
    <!-- Hero Section -->
    <section class="relative bg-amber-900 text-white overflow-hidden py-24">
      <div class="absolute inset-0 opacity-20">
        <img src="https://images.unsplash.com/photo-1556740738-b6a63e27c4df?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" alt="Background" class="w-full h-full object-cover">
      </div>
      <div class="relative max-w-6xl mx-auto px-4 text-center md:text-left">
        <h1 class="text-4xl md:text-6xl font-serif font-bold mb-6 drop-shadow-md">Tradição e Qualidade<br>perto de você</h1>
        <p class="text-xl md:text-2xl text-amber-100 mb-10 max-w-2xl drop-shadow">O melhor atendimento da região. Venha nos visitar e comprove nossa excelência.</p>
        <div class="flex flex-col sm:flex-row gap-4 md:justify-start justify-center">
          <a href="#localizacao" class="bg-amber-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-amber-500 transition-colors shadow-lg">
            Como Chegar
          </a>
        </div>
      </div>
    </section>

    <!-- Services -->
    <section id="servicos" class="py-20">
      <div class="max-w-6xl mx-auto px-4">
        <h2 class="text-3xl font-serif font-bold text-center text-amber-900 mb-12">Nossos Serviços</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="bg-white p-6 rounded-xl shadow-md border border-stone-100 text-center">
            <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-stone-800 mb-2">Serviço Principal</h3>
            <p class="text-stone-600">Descrição detalhada do seu principal produto ou serviço oferecido.</p>
          </div>
          <div class="bg-white p-6 rounded-xl shadow-md border border-stone-100 text-center">
            <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-stone-800 mb-2">Atendimento Rápido</h3>
            <p class="text-stone-600">Descrição secundária destacando a agilidade e qualidade.</p>
          </div>
          <div class="bg-white p-6 rounded-xl shadow-md border border-stone-100 text-center">
            <div class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-stone-800 mb-2">Satisfação Garantida</h3>
            <p class="text-stone-600">Garantia e compromisso com o cliente em primeiro lugar.</p>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>
    `,
    css: 'body { font-family: "Inter", sans-serif; }',
    js: ''
  },
  portfolio: {
    html: `
<div class="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30">
  <!-- Nav -->
  <nav class="fixed w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10">
    <div class="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
      <a href="#" class="text-2xl font-black tracking-tighter">JOHN<span class="text-purple-500">.</span>DOE</a>
      <div class="hidden md:flex gap-8 text-sm font-medium text-gray-400">
        <a href="#work" class="hover:text-white transition-colors">Work</a>
        <a href="#about" class="hover:text-white transition-colors">About</a>
        <a href="#contact" class="hover:text-white transition-colors">Contact</a>
      </div>
    </div>
  </nav>

  <main>
    <!-- Hero -->
    <section class="pt-40 pb-20 px-6">
      <div class="max-w-5xl mx-auto">
        <div class="w-20 h-20 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-full mb-8"></div>
        <h1 class="text-5xl md:text-7xl font-black leading-[1.1] tracking-tight mb-8">
          Frontend Developer<br>
          <span class="text-gray-500">& UI Designer.</span>
        </h1>
        <p class="text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed">
          I build exceptional and accessible digital experiences for the web. Currently focused on building accessible, human-centered products.
        </p>
        <a href="#contact" class="inline-flex items-center justify-center h-14 px-8 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform">
          Get in touch
        </a>
      </div>
    </section>

    <!-- Work -->
    <section id="work" class="py-20 px-6 bg-white/5">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-3xl font-bold mb-12">Selected Work</h2>
        <div class="grid md:grid-cols-2 gap-8">
          <!-- Project 1 -->
          <div class="group cursor-pointer">
            <div class="aspect-video bg-gray-900 rounded-2xl mb-6 overflow-hidden relative">
              <div class="absolute inset-0 bg-purple-500/20 group-hover:bg-transparent transition-colors"></div>
            </div>
            <h3 class="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">Project Name</h3>
            <p class="text-gray-400">Web Development • UX Design</p>
          </div>
          <!-- Project 2 -->
          <div class="group cursor-pointer md:mt-12">
            <div class="aspect-video bg-gray-900 rounded-2xl mb-6 overflow-hidden relative">
              <div class="absolute inset-0 bg-blue-500/20 group-hover:bg-transparent transition-colors"></div>
            </div>
            <h3 class="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">Another Project</h3>
            <p class="text-gray-400">React • Tailwind CSS</p>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>
    `,
    css: 'body { font-family: "Inter", sans-serif; }',
    js: ''
  },
  landing: {
    html: `
<div class="min-h-screen bg-slate-50 font-sans">
  <main>
    <!-- Hero (High Conversion) -->
    <section class="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center">
      <div class="inline-block px-4 py-1.5 rounded-full bg-red-100 text-red-600 font-bold text-sm mb-6 uppercase tracking-wider">
        Oferta por Tempo Limitado
      </div>
      <h1 class="text-5xl md:text-6xl font-black text-slate-900 mb-6 leading-tight tracking-tight">
        Aprenda a criar <span class="text-blue-600">Sistemas Completos</span> do zero ao avançado.
      </h1>
      <p class="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
        O método definitivo para dominar programação e conseguir sua primeira vaga em tempo recorde, mesmo sem experiência anterior.
      </p>
      
      <!-- Video Placeholder -->
      <div class="w-full max-w-4xl mx-auto aspect-video bg-slate-900 rounded-2xl shadow-2xl mb-12 flex items-center justify-center relative overflow-hidden group cursor-pointer">
        <div class="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center pl-2 shadow-lg group-hover:scale-110 transition-transform">
          <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>

      <!-- CTA -->
      <a href="#checkout" class="inline-block w-full sm:w-auto bg-green-500 text-white text-2xl font-black px-12 py-6 rounded-xl shadow-[0_8px_0_rgb(21,128,61)] hover:translate-y-1 hover:shadow-[0_4px_0_rgb(21,128,61)] transition-all">
        QUERO GARANTIR MINHA VAGA AGORA
      </a>
      <p class="mt-4 text-sm font-medium text-slate-500 flex items-center justify-center gap-2">
        <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        Pagamento 100% Seguro. Acesso Imediato.
      </p>
    </section>

    <!-- Social Proof -->
    <section class="py-12 bg-white border-y border-slate-200">
      <div class="max-w-6xl mx-auto px-4 text-center">
        <p class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Mais de 10.000 alunos aprovados</p>
        <div class="flex flex-wrap justify-center gap-12 opacity-50 grayscale">
          <!-- Logo placeholders -->
          <div class="text-2xl font-black">EMPRESA 1</div>
          <div class="text-2xl font-black">EMPRESA 2</div>
          <div class="text-2xl font-black">EMPRESA 3</div>
          <div class="text-2xl font-black">EMPRESA 4</div>
        </div>
      </div>
    </section>
  </main>
</div>
    `,
    css: 'body { font-family: "Inter", sans-serif; }',
    js: ''
  }
};
