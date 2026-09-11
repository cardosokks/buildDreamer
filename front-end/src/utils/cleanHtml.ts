/**
 * Utilitário para separação rigorosa de HTML, CSS e JS em cada página do Website Builder.
 */

export interface PageAssets {
  html: string;
  css: string;
  js: string;
}

/**
 * Extrai e separa rigorosamente as tags <style> e <script> do HTML de uma página,
 * garantindo que a página possua o HTML limpo e os estilos CSS/scripts JS em campos dedicados.
 */
export function separatePageAssets(rawHtml: string, existingCss = '', existingJs = ''): PageAssets {
  if (!rawHtml) {
    return { html: '', css: existingCss || '', js: existingJs || '' };
  }

  let cleanHtml = rawHtml;
  let extractedCss = existingCss ? existingCss.trim() : '';
  let extractedJs = existingJs ? existingJs.trim() : '';

  // 1. Extrair e remover todas as tags <style> do HTML
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(rawHtml)) !== null) {
    if (styleMatch[1] && styleMatch[1].trim()) {
      const code = styleMatch[1].trim();
      if (!extractedCss.includes(code)) {
        extractedCss = extractedCss ? `${extractedCss}\n\n${code}` : code;
      }
    }
  }
  cleanHtml = cleanHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').trim();

  // 2. Extrair e remover tags <script> inline (preservando scripts externos com src=)
  const scriptRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(rawHtml)) !== null) {
    if (scriptMatch[1] && scriptMatch[1].trim()) {
      const code = scriptMatch[1].trim();
      if (!extractedJs.includes(code)) {
        extractedJs = extractedJs ? `${extractedJs}\n\n${code}` : code;
      }
    }
  }
  cleanHtml = cleanHtml.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '').trim();

  // 3. Extrair conteúdo do <body> se a página contiver a estrutura completa
  const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    cleanHtml = bodyMatch[1].trim();
  }

  // 4. Limpar tags de cabeçalho e invólucros para garantir HTML sem poluição
  cleanHtml = cleanHtml
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .trim();

  return {
    html: cleanHtml,
    css: extractedCss,
    js: extractedJs
  };
}
