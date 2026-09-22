/**
 * Módulo de Gerenciamento de Elementos Globais Dinâmicos
 * (Header/Navbar, Footer e Botão Flutuante de WhatsApp)
 * 
 * Garante que:
 * 1. A página Principal (Home) NUNCA fique sem Footer (gera automaticamente se a IA omitir).
 * 2. Todas as subpáginas utilizem EXATAMENTE o mesmo Footer Mestre e o mesmo Botão de WhatsApp Mestre da Home.
 * 3. A Navbar Mestre seja compartilhada em todas as páginas, com destaque de link ativo para a página atual.
 * 4. Não existam duplicidades de Header, Footer ou Botão de WhatsApp em nenhuma página.
 */

export interface PageRouteInfo {
  name: string;
  slug: string;
}

export interface ProcessGlobalElementsOptions {
  html: string;
  businessName: string;
  pages: PageRouteInfo[];
  currentSlug: string;
  isHomepage: boolean;
  globalNavbarHtml?: string;
  globalFooterHtml?: string;
  globalWhatsAppHtml?: string;
}

export interface ProcessGlobalElementsResult {
  html: string;
  navbarHtml: string;
  footerHtml: string;
  whatsAppHtml: string;
}

/**
 * Constrói uma Navbar Padrão em Tailwind CSS com menu responsivo
 */
export function buildDefaultNavbar(
  businessName: string,
  pages: PageRouteInfo[],
  currentSlug: string
): string {
  const safeName = businessName || 'Sua Empresa';
  const navLinks = pages && pages.length > 0 
    ? pages 
    : [
        { name: 'Home', slug: 'index' },
        { name: 'Sobre Nós', slug: 'sobre' },
        { name: 'Serviços', slug: 'servicos' },
        { name: 'Contato', slug: 'contato' }
      ];

  const linksHtml = navLinks.map(p => {
    const isHome = p.slug === 'index' || p.slug === 'home' || p.slug === '/';
    const isActive = p.slug === currentSlug || (isHome && (currentSlug === 'index' || currentSlug === 'home' || currentSlug === ''));
    const href = isHome ? '/' : `/${p.slug.replace(/^\//, '')}`;
    const activeClass = isActive 
      ? 'text-emerald-400 font-semibold border-b-2 border-emerald-400 pb-1' 
      : 'text-slate-300 hover:text-white transition-colors duration-200';
    return `<a href="${href}" class="${activeClass}">${p.name}</a>`;
  }).join('\n        ');

  return `<header class="sticky top-0 z-50 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
    <a href="/" class="flex items-center gap-3 group">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-xl shadow-md group-hover:scale-105 transition-transform duration-300">
        ${safeName.charAt(0).toUpperCase()}
      </div>
      <span class="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
        ${safeName}
      </span>
    </a>

    <nav class="hidden md:flex items-center gap-8 text-sm font-medium">
        ${linksHtml}
    </nav>

    <div class="hidden md:flex items-center gap-4">
      <a href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20atendimento." target="_blank" rel="noopener noreferrer" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-sm transition-all duration-300 shadow-md hover:shadow-emerald-500/25 flex items-center gap-2">
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.205 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-.981z"/></svg>
        <span>Fale Conosco</span>
      </a>
    </div>
  </div>
</header>`;
}

/**
 * Constrói um Footer Padrão e Completo em Tailwind CSS
 */
export function buildDefaultFooter(
  businessName: string,
  pages: PageRouteInfo[]
): string {
  const safeName = businessName || 'Sua Empresa';
  const year = new Date().getFullYear();

  const navLinks = pages && pages.length > 0 
    ? pages 
    : [
        { name: 'Home', slug: 'index' },
        { name: 'Sobre Nós', slug: 'sobre' },
        { name: 'Serviços', slug: 'servicos' },
        { name: 'Contato', slug: 'contato' }
      ];

  const linksHtml = navLinks.map(p => {
    const isHome = p.slug === 'index' || p.slug === 'home' || p.slug === '/';
    const href = isHome ? '/' : `/${p.slug.replace(/^\//, '')}`;
    return `<li><a href="${href}" class="text-slate-400 hover:text-emerald-400 transition-colors duration-200 text-sm">${p.name}</a></li>`;
  }).join('\n            ');

  return `<footer class="w-full bg-slate-950 border-t border-slate-800 text-slate-300 py-16 px-4 sm:px-6 lg:px-8 mt-auto">
  <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
    <!-- Coluna 1: Sobre a Empresa -->
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-lg">
          ${safeName.charAt(0).toUpperCase()}
        </div>
        <span class="font-bold text-xl text-white tracking-tight">${safeName}</span>
      </div>
      <p class="text-slate-400 text-sm leading-relaxed">
        Soluções inovadoras e de alto impacto para impulsionar o seu negócio com excelência, modernidade e resultados.
      </p>
    </div>

    <!-- Coluna 2: Navegação Rápida -->
    <div>
      <h3 class="text-white font-semibold text-base mb-4 border-b border-slate-800 pb-2">Navegação</h3>
      <ul class="space-y-2.5">
        ${linksHtml}
      </ul>
    </div>

    <!-- Coluna 3: Atendimento e Contato -->
    <div>
      <h3 class="text-white font-semibold text-base mb-4 border-b border-slate-800 pb-2">Atendimento</h3>
      <ul class="space-y-3 text-sm text-slate-400">
        <li class="flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <span>contato@${safeName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br</span>
        </li>
        <li class="flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          <span>(11) 99999-9999</span>
        </li>
        <li class="flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Seg. a Sex. das 08h às 18h</span>
        </li>
      </ul>
    </div>

    <!-- Coluna 4: Canal Direto WhatsApp -->
    <div>
      <h3 class="text-white font-semibold text-base mb-4 border-b border-slate-800 pb-2">WhatsApp Direto</h3>
      <p class="text-slate-400 text-sm mb-4">
        Tire dúvidas ou solicite um orçamento em tempo real com nossos consultores.
      </p>
      <a href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20atendimento." target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-sm transition-all duration-300 shadow-lg">
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.205 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-.981z"/></svg>
        <span>Iniciar Conversa</span>
      </a>
    </div>
  </div>

  <div class="max-w-7xl mx-auto border-t border-slate-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
    <p>© ${year} ${safeName}. Todos os direitos reservados.</p>
    <p class="flex items-center gap-1">Desenvolvido com tecnologia de alta performance</p>
  </div>
</footer>`;
}

/**
 * Constrói o Botão Flutuante de WhatsApp Fixo
 */
export function buildDefaultWhatsAppButton(businessName?: string): string {
  const title = businessName ? `Atendimento ${businessName}` : 'Atendimento WhatsApp';
  return `<a href="https://wa.me/5511999999999?text=Ol%C3%A1!%20Gostaria%20de%20mais%20informa%C3%A7%C3%B5es." target="_blank" rel="noopener noreferrer" class="fixed bottom-6 right-6 z-[9999] flex items-center justify-center w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-110 group animate-bounce" title="${title}" aria-label="${title}">
  <svg class="w-8 h-8 fill-current" viewBox="0 0 24 24">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.205 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-.981z"/>
  </svg>
  <span class="absolute right-16 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
    Fale Conosco
  </span>
</a>`;
}

/**
 * Atualiza o estado ativo dos links na Navbar Mestre para a página atual
 */
export function updateActiveNavbarLinks(navbarHtml: string, currentSlug: string): string {
  if (!navbarHtml || typeof navbarHtml !== 'string') return navbarHtml || '';
  let updatedNav = navbarHtml;

  // Se o slug for index, limpa destaques e aplica no link index / home
  const isHomeSlug = currentSlug === 'index' || currentSlug === 'home' || currentSlug === '' || currentSlug === '/';

  // Procura tags <a> e ajusta destaque visual de forma genérica
  updatedNav = updatedNav.replace(/<a\b([^>]*)href=["']([^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi, (match, p1, href, p2, text) => {
    const isLinkHome = href === '/' || href === '/index' || href === '#home' || href === 'index.html';
    const isLinkMatch = !isLinkHome && (
      href.includes(`/${currentSlug}`) || 
      href.endsWith(`/${currentSlug}`) || 
      href.includes(currentSlug)
    );

    const isThisLinkActive = isHomeSlug ? isLinkHome : isLinkMatch;

    if (isThisLinkActive) {
      // Adiciona classe ativa se não tiver
      if (!match.includes('border-b-2') && !match.includes('text-emerald-400') && !match.includes('font-bold')) {
        return `<a ${p1}href="${href}"${p2} class="text-emerald-400 font-bold border-b-2 border-emerald-400 pb-1 ${extractClass(match)}">${text}</a>`;
      }
    }
    return match;
  });

  return updatedNav;
}

function extractClass(tag: string): string {
  const m = tag.match(/class=["']([^"']*)["']/i);
  return m ? m[1] : '';
}

/**
 * Processador Principal de Elementos Globais
 * Garante e unifica Header, Footer e WhatsApp em qualquer página do projeto.
 */
export function processGlobalElements({
  html,
  businessName,
  pages,
  currentSlug,
  isHomepage,
  globalNavbarHtml,
  globalFooterHtml,
  globalWhatsAppHtml
}: ProcessGlobalElementsOptions): ProcessGlobalElementsResult {
  if (!html || typeof html !== 'string') {
    html = '<div class="min-h-screen bg-slate-900 text-white"></div>';
  }

  let cleanHtml = html.trim();

  // Regex para captura de elementos
  const headerRegex = /<(?:header|nav)\b[^>]*>[\s\S]*?<\/(?:header|nav)>/gi;
  const footerRegex = /<footer\b[^>]*>[\s\S]*?<\/footer>/gi;
  const whatsappRegex = /<a\b[^>]*href=["'][^"']*wa\.me[^"']*["'][^>]*>[\s\S]*?<\/a>|<div\b[^>]*id=["'][^"']*whatsapp[^"']*["'][^>]*>[\s\S]*?<\/div>/gi;

  let masterNavbar = globalNavbarHtml || '';
  let masterFooter = globalFooterHtml || '';
  let masterWhatsApp = globalWhatsAppHtml || '';

  // ------------------------------------------------------------------------
  // 1. PROCESSAR FOOTER (RODAPÉ)
  // ------------------------------------------------------------------------
  const existingFooters = [...cleanHtml.matchAll(footerRegex)];

  if (isHomepage) {
    if (existingFooters.length > 0) {
      // Usa o primeiro footer da Home como o Footer Mestre
      masterFooter = existingFooters[0][0];
      // Remove footers excedentes na Home
      let count = 0;
      cleanHtml = cleanHtml.replace(footerRegex, (m) => {
        count++;
        return count === 1 ? m : '';
      });
    } else if (!masterFooter) {
      // NENHUM FOOTER ENCONTRADO NA HOME: Cria o Footer Mestre Padrão obrigatoriamente
      masterFooter = buildDefaultFooter(businessName, pages);
      cleanHtml = `${cleanHtml}\n\n${masterFooter}`;
    } else {
      // Se já tinha masterFooter e na Home sumiu, reinsere o masterFooter
      cleanHtml = `${cleanHtml}\n\n${masterFooter}`;
    }
  } else {
    // É SUBPÁGINA: Remove todos os footers que a IA tentou criar diferente para a subpágina
    cleanHtml = cleanHtml.replace(footerRegex, '');
    
    // Anexa o Footer Mestre (da Home ou o Padrão)
    const effectiveFooter = masterFooter || buildDefaultFooter(businessName, pages);
    masterFooter = effectiveFooter;
    cleanHtml = `${cleanHtml}\n\n${effectiveFooter}`;
  }

  // ------------------------------------------------------------------------
  // 2. PROCESSAR NAVBAR (CABEÇALHO)
  // ------------------------------------------------------------------------
  const existingHeaders = [...cleanHtml.matchAll(headerRegex)];

  if (isHomepage) {
    if (existingHeaders.length > 0) {
      masterNavbar = existingHeaders[0][0];
      // Remove navbars excedentes
      let count = 0;
      cleanHtml = cleanHtml.replace(headerRegex, (m) => {
        count++;
        return count === 1 ? m : '';
      });
    } else if (!masterNavbar) {
      masterNavbar = buildDefaultNavbar(businessName, pages, currentSlug);
      cleanHtml = `${masterNavbar}\n\n${cleanHtml}`;
    } else {
      cleanHtml = `${masterNavbar}\n\n${cleanHtml}`;
    }
  } else {
    // SUBPÁGINA: Remove headers/navs que a IA possa ter inventado
    cleanHtml = cleanHtml.replace(headerRegex, '');
    
    // Reutiliza a Navbar Mestre com atualização de link ativo
    let baseNav = masterNavbar || buildDefaultNavbar(businessName, pages, currentSlug);
    baseNav = updateActiveNavbarLinks(baseNav, currentSlug);
    masterNavbar = baseNav;
    cleanHtml = `${baseNav}\n\n${cleanHtml}`;
  }

  // ------------------------------------------------------------------------
  // 3. PROCESSAR BOTÃO FLUTUANTE DE WHATSAPP
  // ------------------------------------------------------------------------
  const existingWhatsApp = [...cleanHtml.matchAll(whatsappRegex)];

  if (isHomepage) {
    if (existingWhatsApp.length > 0) {
      masterWhatsApp = existingWhatsApp[0][0];
      // Remove duplicados na Home
      let count = 0;
      cleanHtml = cleanHtml.replace(whatsappRegex, (m) => {
        count++;
        return count === 1 ? m : '';
      });
    } else if (!masterWhatsApp) {
      masterWhatsApp = buildDefaultWhatsAppButton(businessName);
      cleanHtml = `${cleanHtml}\n\n${masterWhatsApp}`;
    } else {
      cleanHtml = `${cleanHtml}\n\n${masterWhatsApp}`;
    }
  } else {
    // SUBPÁGINA: Remove botões de WhatsApp dispersos e anexa o WhatsApp Mestre
    cleanHtml = cleanHtml.replace(whatsappRegex, '');
    const effectiveWhatsApp = masterWhatsApp || buildDefaultWhatsAppButton(businessName);
    masterWhatsApp = effectiveWhatsApp;
    cleanHtml = `${cleanHtml}\n\n${effectiveWhatsApp}`;
  }

  return {
    html: cleanHtml,
    navbarHtml: masterNavbar,
    footerHtml: masterFooter,
    whatsAppHtml: masterWhatsApp
  };
}
