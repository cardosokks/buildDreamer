/**
 * Engine de Validação de Páginas para o VisualBuilder
 * Avalia Diretrizes de Design, Consistência de Cores e Acessibilidade (WCAG 2.1 AA).
 */

export interface ValidationIssue {
  id: string;
  category: 'design' | 'color' | 'accessibility';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
  elementSnippet?: string;
  autoFixable: boolean;
}

export interface PageValidationResult {
  score: number; // 0 - 100
  passed: boolean; // True if no critical issues
  totalCritical: number;
  totalWarnings: number;
  totalPassed: number;
  issues: ValidationIssue[];
  fixedHtml?: string;
  fixedCss?: string;
}

export interface ProjectThemeConfig {
  bg: string;
  cardBg: string;
  accent: string;
  accentGlow: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  headingFont: string;
  bodyFont: string;
}

// Converte HEX para RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

// Calcula Luminância Relativa conforme especificação WCAG 2.1
function calculateLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calcula Taxa de Contraste entre duas cores
export function getContrastRatio(color1Hex: string, color2Hex: string): number {
  const rgb1 = hexToRgb(color1Hex);
  const rgb2 = hexToRgb(color2Hex);
  if (!rgb1 || !rgb2) return 4.5; // Default safe assumption if unparseable

  const l1 = calculateLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = calculateLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Valida o HTML, CSS e Tema de uma página
 */
export function validatePage(
  htmlStr: string,
  cssStr: string = '',
  theme?: ProjectThemeConfig
): PageValidationResult {
  const issues: ValidationIssue[] = [];
  const parser = new DOMParser();
  const cleanHtml = String(htmlStr || '').trim();
  const doc = parser.parseFromString(cleanHtml.includes('canvas-root') ? cleanHtml : `<div id="canvas-root">${cleanHtml}</div>`, 'text/html');
  const root = doc.getElementById('canvas-root') || doc.body;

  let totalPassed = 0;

  // ──────────────────────────────────────────────
  // 1. DIRETRIZES DE DESIGN E HIERARQUIA
  // ──────────────────────────────────────────────

  // Check H1 Headings
  const h1Elements = root.querySelectorAll('h1');
  if (h1Elements.length === 0) {
    issues.push({
      id: 'design-no-h1',
      category: 'design',
      severity: 'warning',
      title: 'Título Principal (H1) Ausente',
      description: 'A página não possui nenhum título de nível 1 (<h1>).',
      recommendation: 'Adicione pelo menos um <h1> no topo da página para definir a hierarquia visual e SEO.',
      autoFixable: false
    });
  } else if (h1Elements.length > 1) {
    issues.push({
      id: 'design-multiple-h1',
      category: 'design',
      severity: 'warning',
      title: 'Múltiplos Títulos H1 Encontrados',
      description: `A página possui ${h1Elements.length} tags <h1>. O recomendado é 1 único <h1> por página.`,
      recommendation: 'Altere os <h1> secundários para <h2> mantendo a hierarquia limpa.',
      autoFixable: true
    });
  } else {
    totalPassed++;
  }

  // Check Heading Hierarchy Order
  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  let hierarchySkipped = false;
  for (let i = 0; i < headings.length - 1; i++) {
    const level1 = parseInt(headings[i].tagName.substring(1), 10);
    const level2 = parseInt(headings[i + 1].tagName.substring(1), 10);
    if (level2 > level1 + 1) {
      hierarchySkipped = true;
      break;
    }
  }
  if (hierarchySkipped) {
    issues.push({
      id: 'design-skipped-heading-level',
      category: 'design',
      severity: 'info',
      title: 'Salto na Hierarquia de Títulos',
      description: 'A página salta níveis de título (por exemplo, de H1 diretamente para H3 sem passar por H2).',
      recommendation: 'Siga a ordem sequencial de títulos (H1 -> H2 -> H3) para estruturação semântica limpa.',
      autoFixable: false
    });
  } else if (headings.length > 0) {
    totalPassed++;
  }

  // Check Empty Buttons or Links
  const buttonsAndLinks = root.querySelectorAll('button, a');
  let emptyInteractiveCount = 0;
  buttonsAndLinks.forEach((el) => {
    const textContent = (el.textContent || '').trim();
    const hasAriaLabel = el.hasAttribute('aria-label') && el.getAttribute('aria-label')?.trim() !== '';
    const hasImageChild = el.querySelector('img, svg') !== null;

    if (!textContent && !hasAriaLabel && !hasImageChild) {
      emptyInteractiveCount++;
    }
  });

  if (emptyInteractiveCount > 0) {
    issues.push({
      id: 'design-empty-interactive',
      category: 'design',
      severity: 'critical',
      title: 'Botões ou Links Sem Conteúdo/Texto',
      description: `Foram encontrados ${emptyInteractiveCount} elemento(s) interativo(s) sem texto visível ou rótulo acessível.`,
      recommendation: 'Adicione um texto claro ou atributo aria-label nos botões/links.',
      autoFixable: true
    });
  } else {
    totalPassed++;
  }

  // Check Fixed Widths on Containers (Responsive Design Breakage)
  const allElements = Array.from(root.querySelectorAll('*'));
  let fixedWidthCount = 0;
  allElements.forEach((el) => {
    const styleAttr = el.getAttribute('style') || '';
    if (/width\s*:\s*\d{3,4}px/i.test(styleAttr) && !/max-width/i.test(styleAttr)) {
      fixedWidthCount++;
    }
  });

  if (fixedWidthCount > 0) {
    issues.push({
      id: 'design-fixed-width',
      category: 'design',
      severity: 'warning',
      title: 'Largura Fixa em Pixels nos Containers',
      description: `Existem ${fixedWidthCount} elemento(s) com largura fixa em pixels (ex: width: 1200px) que podem quebrar a responsividade em celulares.`,
      recommendation: 'Substitua width: Xpx por max-width: Xpx; width: 100% para suportar múltiplos dispositivos.',
      autoFixable: true
    });
  } else {
    totalPassed++;
  }

  // Check Semantic Structure
  const semanticTags = root.querySelectorAll('header, main, section, footer, nav, article');
  if (semanticTags.length === 0) {
    issues.push({
      id: 'design-no-semantic-tags',
      category: 'design',
      severity: 'info',
      title: 'Falta de Tags Semânticas de Layout',
      description: 'A página é composta apenas por divs genéricas sem tags semânticas como <main>, <section> ou <header>.',
      recommendation: 'Utilize tags semânticas para melhorar a acessibilidade e estrutura do projeto.',
      autoFixable: false
    });
  } else {
    totalPassed++;
  }

  // ──────────────────────────────────────────────
  // 2. CONSISTÊNCIA DE CORES E TEMA
  // ──────────────────────────────────────────────

  const pageBg = theme?.bg || '#080a12';
  const pageText = theme?.textPrimary || '#f8fafc';

  // Check Text Contrast Ratio against Background
  let lowContrastCount = 0;
  allElements.forEach((el) => {
    const styleAttr = el.getAttribute('style') || '';
    const colorMatch = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    const bgMatch = styleAttr.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);

    if (colorMatch) {
      const textColor = colorMatch[1].trim();
      let elemBg = bgMatch ? bgMatch[1].trim() : pageBg;
      
      // If color is hex
      if (textColor.startsWith('#') && elemBg.startsWith('#')) {
        const ratio = getContrastRatio(textColor, elemBg);
        if (ratio < 4.5) {
          lowContrastCount++;
        }
      }
    }
  });

  if (lowContrastCount > 0) {
    issues.push({
      id: 'color-low-contrast',
      category: 'color',
      severity: 'critical',
      title: 'Contraste de Texto Insuficiente (WCAG 2.1 AA)',
      description: `Foram detectados ${lowContrastCount} texto(s) com taxa de contraste inferior a 4.5:1 em relação ao fundo.`,
      recommendation: 'Aumente o contraste da cor do texto em relação ao fundo para garantir leitura confortável.',
      autoFixable: true
    });
  } else {
    totalPassed++;
  }

  // Check Inline Color Consistency with Theme
  if (theme) {
    let unalignedColorCount = 0;
    allElements.forEach((el) => {
      const styleAttr = el.getAttribute('style') || '';
      const bgMatch = styleAttr.match(/(?:^|;)\s*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})/i);
      if (bgMatch) {
        const hex = bgMatch[1].toLowerCase();
        const matchesTheme = [theme.bg, theme.cardBg, theme.accent, theme.border]
          .map(c => (c || '').toLowerCase());
        if (!matchesTheme.includes(hex) && hex !== '#ffffff' && hex !== '#000000' && hex !== 'transparent') {
          unalignedColorCount++;
        }
      }
    });

    if (unalignedColorCount > 3) {
      issues.push({
        id: 'color-theme-mismatch',
        category: 'color',
        severity: 'warning',
        title: 'Cores Inline Fora da Paleta do Tema Global',
        description: `Encontradas ${unalignedColorCount} cores hardcoded no estilo que variam do tema oficial do projeto.`,
        recommendation: 'Utilize as variáveis do tema global para manter consistência visual da marca.',
        autoFixable: false
      });
    } else {
      totalPassed++;
    }
  }

  // ──────────────────────────────────────────────
  // 3. ACESSIBILIDADE (WCAG 2.1 AA)
  // ──────────────────────────────────────────────

  // Check Images Missing Alt Text
  const images = Array.from(root.querySelectorAll('img'));
  let missingAltCount = 0;
  images.forEach((img) => {
    const hasAlt = img.hasAttribute('alt');
    const altValue = img.getAttribute('alt');
    const isAriaHidden = img.getAttribute('aria-hidden') === 'true';

    if ((!hasAlt || altValue === '') && !isAriaHidden) {
      missingAltCount++;
    }
  });

  if (missingAltCount > 0) {
    issues.push({
      id: 'a11y-missing-alt',
      category: 'accessibility',
      severity: 'critical',
      title: 'Imagens Sem Descrição Alt Text (Acessibilidade)',
      description: `Encontrada(s) ${missingAltCount} imagem(ns) sem atributo 'alt' para leitores de tela.`,
      recommendation: 'Adicione descrições objetivas no atributo alt das imagens.',
      autoFixable: true
    });
  } else {
    totalPassed++;
  }

  // Check Touch Target Sizes (< 44px)
  let smallTouchTargetCount = 0;
  buttonsAndLinks.forEach((el) => {
    const styleAttr = el.getAttribute('style') || '';
    const heightMatch = styleAttr.match(/height\s*:\s*(\d+)px/i);
    const paddingMatch = styleAttr.match(/padding\s*:\s*(\d+)px/i);

    if (heightMatch && parseInt(heightMatch[1], 10) < 40) {
      smallTouchTargetCount++;
    } else if (paddingMatch && parseInt(paddingMatch[1], 10) < 6) {
      smallTouchTargetCount++;
    }
  });

  if (smallTouchTargetCount > 0) {
    issues.push({
      id: 'a11y-small-touch-target',
      category: 'accessibility',
      severity: 'warning',
      title: 'Área de Toque do Botão Menor que 44px',
      description: `Encontrado(s) ${smallTouchTargetCount} botão(ões) ou link(s) com área de clique reduzida.`,
      recommendation: 'Aumente o espaçamento interno (padding) dos botões para pelo menos 12px 24px para fácil toque mobile.',
      autoFixable: true
    });
  } else {
    totalPassed++;
  }

  // Check Form Input Labels
  const inputs = Array.from(root.querySelectorAll('input, select, textarea'));
  let missingLabelCount = 0;
  inputs.forEach((input) => {
    const type = input.getAttribute('type');
    if (type === 'hidden' || type === 'submit' || type === 'button') return;

    const hasId = input.hasAttribute('id');
    const inputId = input.getAttribute('id');
    const hasLabel = hasId && doc.querySelector(`label[for="${inputId}"]`) !== null;
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasPlaceholder = input.hasAttribute('placeholder');

    if (!hasLabel && !hasAriaLabel && !hasPlaceholder) {
      missingLabelCount++;
    }
  });

  if (missingLabelCount > 0) {
    issues.push({
      id: 'a11y-input-missing-label',
      category: 'accessibility',
      severity: 'critical',
      title: 'Campos de Formulário Sem Rótulo (Label)',
      description: `Foram encontrados ${missingLabelCount} campo(s) de entrada de dados sem rótulo ou atributo aria-label.`,
      recommendation: 'Associe uma tag <label> ao id do campo ou adicione aria-label no input.',
      autoFixable: true
    });
  } else {
    totalPassed++;
  }

  // Calculate Overall Quality Score (0-100)
  const totalCritical = issues.filter(i => i.severity === 'critical').length;
  const totalWarnings = issues.filter(i => i.severity === 'warning').length;

  let baseScore = 100 - (totalCritical * 25) - (totalWarnings * 10);
  if (baseScore < 0) baseScore = 0;
  if (issues.length === 0) baseScore = 100;

  return {
    score: baseScore,
    passed: totalCritical === 0,
    totalCritical,
    totalWarnings,
    totalPassed,
    issues
  };
}

/**
 * Aplica correções automáticas (Auto-Fix) no HTML e CSS
 */
export function autoFixPageValidation(
  htmlStr: string,
  cssStr: string = '',
  theme?: ProjectThemeConfig
): { fixedHtml: string; fixedCss: string; fixedCount: number } {
  const parser = new DOMParser();
  const cleanHtml = String(htmlStr || '').trim();
  const doc = parser.parseFromString(cleanHtml.includes('canvas-root') ? cleanHtml : `<div id="canvas-root">${cleanHtml}</div>`, 'text/html');
  const root = doc.getElementById('canvas-root') || doc.body;

  let fixedCount = 0;

  // 1. Fix Missing Alt Text on Images
  const images = Array.from(root.querySelectorAll('img'));
  images.forEach((img, idx) => {
    if (!img.hasAttribute('alt') || img.getAttribute('alt') === '') {
      const src = img.getAttribute('src') || '';
      const name = src.split('/').pop()?.split('?')[0]?.replace(/^[0-9]+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ') || `Imagem ${idx + 1}`;
      img.setAttribute('alt', name.charAt(0).toUpperCase() + name.slice(1));
      fixedCount++;
    }
  });

  // 2. Fix Empty Buttons
  const buttons = Array.from(root.querySelectorAll('button, a'));
  buttons.forEach((btn) => {
    const textContent = (btn.textContent || '').trim();
    const hasAriaLabel = btn.hasAttribute('aria-label');
    const hasChild = btn.querySelector('img, svg') !== null;

    if (!textContent && !hasAriaLabel) {
      if (hasChild) {
        btn.setAttribute('aria-label', 'Ação interativa');
      } else {
        btn.textContent = 'Clique Aqui';
      }
      fixedCount++;
    }
  });

  // 3. Fix Fixed Width Containers -> Responsive
  const allElements = Array.from(root.querySelectorAll('*'));
  allElements.forEach((el) => {
    let styleAttr = el.getAttribute('style') || '';
    if (/width\s*:\s*\d{3,4}px/i.test(styleAttr) && !/max-width/i.test(styleAttr)) {
      styleAttr = styleAttr.replace(/width\s*:\s*(\d{3,4})px/gi, 'max-width: $1px; width: 100%');
      el.setAttribute('style', styleAttr);
      fixedCount++;
    }
  });

  // 4. Fix Small Touch Targets on Buttons
  buttons.forEach((btn) => {
    let styleAttr = btn.getAttribute('style') || '';
    if (!styleAttr.includes('padding') && !styleAttr.includes('min-height')) {
      styleAttr += '; min-height: 44px; padding: 12px 24px;';
      btn.setAttribute('style', styleAttr);
      fixedCount++;
    }
  });

  // 5. Fix Missing Labels on Inputs
  const inputs = Array.from(root.querySelectorAll('input, select, textarea'));
  inputs.forEach((input) => {
    const type = input.getAttribute('type');
    if (type === 'hidden' || type === 'submit' || type === 'button') return;

    if (!input.hasAttribute('aria-label') && !input.hasAttribute('placeholder')) {
      input.setAttribute('aria-label', 'Campo de entrada de texto');
      input.setAttribute('placeholder', 'Digite aqui...');
      fixedCount++;
    }
  });

  // 6. Fix Multiple H1s (Convert secondary H1s to H2)
  const h1Elements = Array.from(root.querySelectorAll('h1'));
  if (h1Elements.length > 1) {
    for (let i = 1; i < h1Elements.length; i++) {
      const h2 = doc.createElement('h2');
      h2.innerHTML = h1Elements[i].innerHTML;
      if (h1Elements[i].hasAttributes()) {
        Array.from(h1Elements[i].attributes).forEach(attr => h2.setAttribute(attr.name, attr.value));
      }
      h1Elements[i].parentNode?.replaceChild(h2, h1Elements[i]);
      fixedCount++;
    }
  }

  // Serialize back to HTML
  const canvasRoot = doc.getElementById('canvas-root');
  let fixedHtml = '';
  if (canvasRoot) {
    fixedHtml = canvasRoot.hasAttribute('class') || canvasRoot.hasAttribute('style') ? canvasRoot.outerHTML : canvasRoot.innerHTML;
  } else {
    fixedHtml = doc.body ? doc.body.innerHTML : cleanHtml;
  }

  return {
    fixedHtml,
    fixedCss: cssStr,
    fixedCount
  };
}
