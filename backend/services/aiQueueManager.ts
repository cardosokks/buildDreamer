import { prisma } from '../db';
import { executeAIRequest } from './aiEngine';
import { executeSiteRemaster } from './siteRemasterWorker';
import { processPageAssets } from './siteRemaster';

export interface AIQueueItem {
  id: string;
  projectId: string;
  type: 'chat_edit' | 'page_remaster' | 'site_remaster';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  pageId?: string;
  currentModel?: string;
  error?: string;
  retryCount?: number;
  result?: {
    explanation: string;
    html?: string;
    css?: string;
    js?: string;
    _usedModel?: string;
    _usedProvider?: string;
    updatedPages?: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }>;
  };
  scope?: 'single' | 'all';
  createdAt: Date;
  updatedAt: Date;
  options?: any;
}

export function parsePageSections(html: string): { wrapperOpen: string; sections: string[]; wrapperClose: string } {
  let innerHtml = html.trim();
  let wrapperOpen = '';
  let wrapperClose = '';

  // Detect and extract outer wrapper
  const wrapperRegex = /^(<div\s+[^>]*id=["'](?:page-wrapper|canvas-root)["'][^>]*>)([\s\S]*)(<\/div>)$/i;
  const match = innerHtml.match(wrapperRegex);
  if (match) {
    wrapperOpen = match[1];
    innerHtml = match[2].trim();
    wrapperClose = match[3];
  } else {
    // If not matching completely with start/end, try a simpler regex search for wrapper start
    const wrapperStartRegex = /^(<div\s+[^>]*id=["'](?:page-wrapper|canvas-root)["'][^>]*>)/i;
    const startMatch = innerHtml.match(wrapperStartRegex);
    if (startMatch) {
      wrapperOpen = startMatch[1];
      innerHtml = innerHtml.slice(wrapperOpen.length).trim();
      if (innerHtml.endsWith('</div>')) {
        wrapperClose = '</div>';
        innerHtml = innerHtml.slice(0, -6).trim();
      }
    }
  }

  // Split innerHtml into top-level tags
  const sections: string[] = [];
  let index = 0;
  
  // A simple and bulletproof scanner for top-level tags
  while (index < innerHtml.length) {
    // Find next non-whitespace char
    const char = innerHtml[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (char === '<') {
      // Find the tag name
      const tagStart = index;
      const nextSpaceOrClose = innerHtml.indexOf(' ', tagStart);
      const nextClose = innerHtml.indexOf('>', tagStart);
      
      let tagEndIndex = nextClose;
      if (nextSpaceOrClose !== -1 && nextSpaceOrClose < nextClose) {
        tagEndIndex = nextSpaceOrClose;
      }
      
      if (tagEndIndex === -1) {
        // Corrupted HTML, just grab remainder
        sections.push(innerHtml.slice(tagStart));
        break;
      }

      const tagName = innerHtml.slice(tagStart + 1, tagEndIndex).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // If it's a comment or doctype, skip or grab it
      if (tagName.startsWith('!') || tagName.startsWith('?')) {
        const commentEnd = innerHtml.indexOf('-->', tagStart);
        if (commentEnd !== -1) {
          index = commentEnd + 3;
        } else {
          index = innerHtml.length;
        }
        continue;
      }

      // We need to find the matching closing tag for this tagName at the top level
      // By keeping track of nested same-name tags
      let depth = 1;
      let scanIndex = nextClose + 1;
      const openTagPattern = new RegExp(`<${tagName}\\b`, 'i');
      const closeTagPattern = new RegExp(`</${tagName}>`, 'i');

      while (scanIndex < innerHtml.length && depth > 0) {
        // Check if there is an open or close tag next
        const remaining = innerHtml.slice(scanIndex);
        const nextOpen = remaining.search(openTagPattern);
        const nextCloseTag = remaining.search(closeTagPattern);

        if (nextCloseTag === -1) {
          // No closing tag found, grab until the end
          scanIndex = innerHtml.length;
          break;
        }

        if (nextOpen !== -1 && nextOpen < nextCloseTag) {
          depth++;
          scanIndex += nextOpen + tagName.length + 1;
        } else {
          depth--;
          scanIndex += nextCloseTag + tagName.length + 3;
        }
      }

      const sectionContent = innerHtml.slice(tagStart, scanIndex);
      if (sectionContent.trim()) {
        sections.push(sectionContent);
      }
      index = scanIndex;
    } else {
      // Plain text or text node at top level (e.g. text between sections)
      const nextTag = innerHtml.indexOf('<', index);
      if (nextTag !== -1) {
        const textNode = innerHtml.slice(index, nextTag).trim();
        if (textNode) {
          sections.push(`<div>${textNode}</div>`); // Wrap it safely
        }
        index = nextTag;
      } else {
        const textNode = innerHtml.slice(index).trim();
        if (textNode) {
          sections.push(`<div>${textNode}</div>`);
        }
        break;
      }
    }
  }

  // Fallback if no sections were parsed
  if (sections.length === 0 && innerHtml) {
    sections.push(innerHtml);
  }

  return { wrapperOpen, sections, wrapperClose };
}

class ProjectQueue {
  projectId: string;
  items: AIQueueItem[] = [];
  processing: boolean = false;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  enqueue(item: AIQueueItem) {
    this.items.push(item);
    this.processNext();
  }

  cancel(itemId: string) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      if (item.status === 'pending') {
        item.status = 'cancelled';
        item.updatedAt = new Date();
      } else if (item.status === 'processing') {
        // Can mark as cancelled, though the actual request might still be running in the background.
        // The worker will handle cleanup upon finishing.
        item.status = 'cancelled';
        item.updatedAt = new Date();
      }
    }
  }

  clear() {
    // Keep pending and processing items, clear completed/failed/cancelled
    this.items = this.items.filter(i => i.status === 'pending' || i.status === 'processing');
  }

  async processNext() {
    if (this.processing) return;

    const nextItem = this.items.find(item => item.status === 'pending');
    if (!nextItem) return;

    this.processing = true;
    nextItem.status = 'processing';
    nextItem.updatedAt = new Date();

    try {
      console.log(`[AIQueueManager] Iniciando processamento do item ${nextItem.id} (tipo: ${nextItem.type}) para o projeto ${this.projectId}`);
      await this.executeItem(nextItem);
      
      // Se foi cancelado enquanto rodava, não mude para completed
      if (nextItem.status === 'processing') {
        nextItem.status = 'completed';
      }
    } catch (err: any) {
      console.error(`[AIQueueManager] Erro no item ${nextItem.id} para o projeto ${this.projectId}:`, err);
      
      const isTransient = /503|429|500|502|504|high demand|temporary|econnreset|etimedout/i.test(err.message || '');
      const currentRetry = nextItem.retryCount || 0;

      // Se for erro temporário de API ou rede e ainda tiver retentativas
      if ((nextItem.status as string) !== 'cancelled' && isTransient && currentRetry < 2) {
        nextItem.retryCount = currentRetry + 1;
        nextItem.status = 'pending';
        console.warn(`[AIQueueManager] Re-agendando item ${nextItem.id} (tentativa ${nextItem.retryCount}/2) após erro temporário da API.`);
      } else if ((nextItem.status as string) !== 'cancelled') {
        nextItem.status = 'failed';
        nextItem.error = err.message || 'Erro imprevisto ao processar a requisição de IA.';
      }
    } finally {
      nextItem.updatedAt = new Date();
      this.processing = false;
      // Pequeno delay antes de rodar o próximo
      setTimeout(() => this.processNext(), 200);
    }
  }

  private async executeItem(item: AIQueueItem) {
    if (item.type === 'chat_edit') {
      await this.executeChatEdit(item);
    } else if (item.type === 'page_remaster') {
      await this.executePageRemaster(item);
    } else if (item.type === 'site_remaster') {
      await executeSiteRemaster(item);
    } else {
      throw new Error(`Tipo de tarefa desconhecido: ${item.type}`);
    }
  }

  private async executeChatEdit(item: AIQueueItem) {
    const { pageId, prompt, options = {} } = item;
    if (!pageId) throw new Error('ID da página é obrigatório para edição por chat.');

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: { include: { pages: true } } }
    });

    if (!page) throw new Error('Página não encontrada no banco de dados.');

    const projectPages = page.project?.pages || [page];
    let pagesToProcess: typeof projectPages = [];

    const applyToAll = !!item.options?.applyToAll;
    const targetPageIds = item.options?.targetPageIds;

    if (targetPageIds && Array.isArray(targetPageIds) && targetPageIds.length > 0) {
      pagesToProcess = projectPages.filter(p => targetPageIds.includes(p.id));
      if (pagesToProcess.length === 0) pagesToProcess = [page];
    } else if (applyToAll && projectPages.length > 1) {
      pagesToProcess = projectPages;
    } else {
      pagesToProcess = [page];
    }

    const isMultiPage = pagesToProcess.length > 1;
    item.scope = isMultiPage ? 'all' : 'single';
    item.currentModel = isMultiPage 
      ? `${options.model || 'gemini-2.0-flash'} (Processando ${pagesToProcess.length} páginas...)`
      : options.model || 'gemini-2.0-flash';

    if (isMultiPage) {
      const updatedPages: Array<{ id: string; name: string; slug: string; html: string; css: string; js: string }> = [];
      let finalExplanation = '';

      for (let i = 0; i < pagesToProcess.length; i++) {
        // Se foi cancelado entre as iterações das páginas
        if (item.status === 'cancelled') return;

        const currentPage = pagesToProcess[i];
        item.currentModel = `[${i + 1}/${pagesToProcess.length}] Processando imagens da página: "${currentPage.name}"`;

        let pageHtml = currentPage.html || '<div></div>';
        try {
          const rewrittenHtml = await processPageAssets(
            pageHtml,
            '',
            new Map<string, string>(),
            page.project?.ownerId || undefined,
            page.projectId
          );
          if (rewrittenHtml !== pageHtml) {
            pageHtml = rewrittenHtml;
            await prisma.page.update({
              where: { id: currentPage.id },
              data: { html: rewrittenHtml }
            });
            currentPage.html = rewrittenHtml;
          }
        } catch (assetErr) {
          console.warn(`[executeChatEdit] Erro ao reescrever assets da página ${currentPage.name}:`, assetErr);
        }

        item.currentModel = `[${i + 1}/${pagesToProcess.length}] Atualizando página: "${currentPage.name}"`;

        const context = {
          html: pageHtml,
          css: currentPage.css || '',
          js: currentPage.js || ''
        };

        const pageSpecificPrompt = `${prompt}\n\n[INSTRUÇÃO IMPORTANTE]: Você está atualizando a página "${currentPage.name}" (slug: /${currentPage.slug}) do projeto. Mantenha a identidade visual e o design global sincronizado com as demais páginas.`;

        const res = await executeAIRequest(pageSpecificPrompt, context, {
          ...options,
          onProgress: (info) => {
            item.currentModel = `[${i + 1}/${pagesToProcess.length}] ${currentPage.name}: ${info.model || ''}`;
          }
        });

        // Se foi cancelado após a chamada do modelo
        if ((item.status as string) === 'cancelled') return;

        await prisma.page.update({
          where: { id: currentPage.id },
          data: {
            html: res.html,
            css: res.css,
            js: res.js
          }
        });

        updatedPages.push({
          id: currentPage.id,
          name: currentPage.name,
          slug: currentPage.slug,
          html: res.html,
          css: res.css,
          js: res.js
        });

        if (i === 0) finalExplanation = res.explanation;
      }

      const activeUpdated = updatedPages.find(p => p.id === pageId) || updatedPages[0];

      item.result = {
        explanation: `Todas as ${updatedPages.length} páginas selecionadas foram atualizadas com sucesso e sincronizadas com a nova instrução visual.\n\n${finalExplanation}`,
        html: activeUpdated?.html,
        css: activeUpdated?.css,
        js: activeUpdated?.js,
        _usedModel: options.model || 'gemini-2.0-flash',
        _usedProvider: options.provider || 'gemini',
        updatedPages
      };
    } else {
      let pageHtml = page.html || '<div></div>';
      item.currentModel = `Processando imagens da página: "${page.name}"...`;
      try {
        const rewrittenHtml = await processPageAssets(
          pageHtml,
          '',
          new Map<string, string>(),
          page.project?.ownerId || undefined,
          page.projectId
        );
        if (rewrittenHtml !== pageHtml) {
          pageHtml = rewrittenHtml;
          await prisma.page.update({
            where: { id: page.id },
            data: { html: rewrittenHtml }
          });
          page.html = rewrittenHtml;
        }
      } catch (assetErr) {
        console.warn(`[executeChatEdit] Erro ao reescrever assets da página ${page.name}:`, assetErr);
      }

      const targetSectionIndex = options.targetSectionIndex;
      const targetSectionLabel = options.targetSectionLabel || (targetSectionIndex !== undefined ? `Seção #${targetSectionIndex + 1}` : undefined);
      const targetSectionHtml = options.targetSectionHtml;

      let result;
      let finalHtml = pageHtml;
      let finalCss = page.css || '';
      let finalJs = page.js || '';

      if (targetSectionIndex !== undefined && targetSectionHtml) {
        // MODO EDIÇÃO DE SEÇÃO ESPECÍFICA
        console.log(`[AIQueueManager] Iniciando edição direcionada para a seção index ${targetSectionIndex}: ${targetSectionLabel}`);
        
        const sectionPrompt = `
Você é o Arquiteto Frontend Master.
Sua missão é atualizar EXCLUSIVAMENTE a seção "${targetSectionLabel}" dentro da página "${page.name}".

ATENÇÃO EXTREMA:
1. Retorne um JSON no qual o campo "html" contenha APENAS o código HTML atualizado para esta seção selecionada. Não retorne a página inteira nem o container wrapper externo.
2. Comece o HTML retornado pela mesma tag raiz (por exemplo, <section ...>, <header ...>, ou <div ...>) correspondente à seção atual se possível, aplicando as modificações solicitadas pelo usuário.
3. Se o usuário pedir para adicionar novos estilos ou comportamentos, você pode incluí-los como classes Tailwind adicionais no HTML, ou retornar regras customizadas no campo "css" e "js" (estes serão anexados globalmente).
4. Mantenha os textos originais, logomarcas, mídias e imagens originais da seção, a menos que o pedido diga explicitamente para trocá-los.

PEDIDO DE ALTERAÇÃO DO USUÁRIO PARA ESTA SEÇÃO:
"""
${prompt}
"""

CÓDIGO HTML ATUAL DESTA SEÇÃO:
"""
${targetSectionHtml}
"""

CONTEXTO GERAL DO DESIGN SYSTEM E DEMAIS PARTES DA PÁGINA (Use apenas para referência de cores, estilos, fontes e design global):
- HTML Completo:
"""
${pageHtml}
"""
- CSS Atual:
"""
${page.css || ''}
"""
        `;

        const context = {
          html: targetSectionHtml,
          css: page.css || '',
          js: page.js || ''
        };

        result = await executeAIRequest(sectionPrompt, context, {
          ...options,
          onProgress: (info) => {
            item.currentModel = `${info.model || 'Processando'} (Seção: ${targetSectionLabel})`;
          }
        });

        if (item.status === 'cancelled') return;

        // Fazer a mesclagem cirúrgica do HTML da seção modificada de volta na página original
        const { wrapperOpen, sections, wrapperClose } = parsePageSections(pageHtml);
        if (targetSectionIndex >= 0 && targetSectionIndex < sections.length) {
          sections[targetSectionIndex] = result.html;
          finalHtml = `${wrapperOpen}${sections.join('\n\n')}${wrapperClose}`;
          console.log(`[AIQueueManager] Seção index ${targetSectionIndex} substituída com sucesso!`);
        } else {
          // Fallback se o index estiver fora do intervalo (ex: página mudou no meio)
          // Tenta substituir por correspondência exata do HTML original
          const matchedIndex = sections.findIndex(s => s.trim() === targetSectionHtml.trim());
          if (matchedIndex !== -1) {
            sections[matchedIndex] = result.html;
            finalHtml = `${wrapperOpen}${sections.join('\n\n')}${wrapperClose}`;
          } else {
            console.warn(`[AIQueueManager] Seção index ${targetSectionIndex} não encontrada na árvore atual de ${sections.length} seções. Salvando alteração direta.`);
            finalHtml = result.html;
          }
        }

        // Mesclar CSS e JS
        if (result.css && result.css.trim() && !finalCss.includes(result.css.trim())) {
          finalCss = `${finalCss}\n\n/* Estilos adicionados via IA para ${targetSectionLabel} */\n${result.css.trim()}`;
        }
        if (result.js && result.js.trim() && !finalJs.includes(result.js.trim())) {
          finalJs = `${finalJs}\n\n// Funcionalidades adicionadas via IA para ${targetSectionLabel}\n${result.js.trim()}`;
        }

      } else {
        // MODO PÁGINA INTEIRA (Comportamento Legado)
        const context = {
          html: pageHtml,
          css: page.css || '',
          js: page.js || ''
        };

        result = await executeAIRequest(prompt, context, {
          ...options,
          onProgress: (info) => {
            item.currentModel = info.model;
          }
        });

        if (item.status === 'cancelled') return;

        finalHtml = result.html;
        finalCss = result.css;
        finalJs = result.js;
      }

      await prisma.page.update({
        where: { id: page.id },
        data: {
          html: finalHtml,
          css: finalCss,
          js: finalJs
        }
      });

      item.result = {
        explanation: result.explanation,
        html: finalHtml,
        css: finalCss,
        js: finalJs,
        _usedModel: result._usedModel,
        _usedProvider: result._usedProvider
      };
    }
  }

  private async executePageRemaster(item: AIQueueItem) {
    const { pageId, prompt, options = {} } = item;
    if (!pageId) throw new Error('ID da página é obrigatório para remasterização.');

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { project: true }
    });

    if (!page) throw new Error('Página não encontrada para remasterização.');

    item.currentModel = 'Preparando página para melhoramento inteligente...';
    item.scope = 'single';

    // Antes de carregar no melhoramento, substitui links originais por links baixados
    let pageHtml = page.html || '';
    try {
      item.currentModel = 'Baixando imagens originais para o servidor local...';
      const rewrittenHtml = await processPageAssets(
        pageHtml,
        '',
        new Map<string, string>(),
        page.project?.ownerId || undefined,
        page.projectId
      );
      if (rewrittenHtml !== pageHtml) {
        pageHtml = rewrittenHtml;
        await prisma.page.update({
          where: { id: pageId },
          data: { html: rewrittenHtml }
        });
        page.html = rewrittenHtml;
        console.log(`[executePageRemaster] Sucesso: Imagens baixadas e referenciadas localmente na página ${page.name}.`);
      }
    } catch (assetErr) {
      console.warn(`[executePageRemaster] Erro ao processar imagens originais antes do melhoramento:`, assetErr);
    }

    item.currentModel = options.model || 'gemini-2.0-flash';

    // Otimização de Tokens: Se solicitado, não enviamos CSS e JS inteiros, pois o Tailwind irá recriar
    const optimizeTokens = options.optimizeTokens !== false;
    const cssContent = optimizeTokens ? (page.css ? '/* CSS omitido para economizar tokens, refaça usando Tailwind */' : '') : page.css;
    const jsContent = optimizeTokens ? (page.js ? '// JS omitido, crie as interatividades necessárias' : '') : page.js;

    const remasterPrompt = `
      Você é o Arquiteto Frontend Master.
      Estamos aprimorando o design e layout da página "${page.name}" (${page.slug}).

      DIRETRIZ DE MELHORIA DO USUÁRIO:
      """
      ${prompt || 'Melhore o layout e estilo com Tailwind CSS de forma moderna, elegante e responsiva.'}
      """
      ${options.customPrompt ? `\nDIRETRIZ ESPECÍFICA DESTA PÁGINA:\n"""\n${options.customPrompt}\n"""\n` : ''}

      HTML ORIGINAL DA PÁGINA:
      """
      ${pageHtml}
      """
      ${options.extractedNavbar ? `\nUSE ESTA NAVBAR EXATAMENTE COMO ESTÁ (Se houver navbar):\n"""\n${options.extractedNavbar}\n"""\n` : ''}
      ${options.extractedFooter ? `\nUSE ESTE FOOTER EXATAMENTE COMO ESTÁ (Se houver footer):\n"""\n${options.extractedFooter}\n"""\n` : ''}

      ${!optimizeTokens ? `
      CSS ORIGINAL:
      """
      ${cssContent}
      """

      JS ORIGINAL:
      """
      ${jsContent}
      """
      ` : ''}

      REGRAS OBRIGATÓRIAS E INEGOCIÁVEIS:
      1. NÃO REFAÇA DO ZERO E NÃO INVENTE TEXTOS FAKE. Mantenha integralmente todas as frases originais, slogans, títulos, parágrafos, contatos, telefones e mídias.
      2. MANTENHA TODAS AS IMAGENS E MÍDIAS: Preserve fielmente as tags <img src="..."> e URLs de imagem.
      3. DESIGN PREMIUM COM TAILWIND CSS: Reestruture as seções em um layout moderno, responsivo e limpo.
      4. RETORNO LIMPO: Retorne apenas HTML em "html", CSS em "css" e JS em "js".
    `;

    const context = {
      html: pageHtml,
      css: cssContent || '',
      js: jsContent || ''
    };

    const aiResponse = await executeAIRequest(
      remasterPrompt,
      context,
      {
        ...options,
        onProgress: (info) => {
          item.currentModel = info.model;
        }
      }
    );

    if (item.status === 'cancelled') return;

    const updatedHtml = aiResponse.html || pageHtml;
    const updatedCss = aiResponse.css || page.css;
    const updatedJs = aiResponse.js || page.js;

    await prisma.page.update({
      where: { id: pageId },
      data: {
        html: updatedHtml,
        css: updatedCss,
        js: updatedJs
      }
    });

    item.result = {
      explanation: aiResponse.explanation || 'Remasterização concluída com sucesso!',
      html: updatedHtml,
      css: updatedCss,
      js: updatedJs,
      _usedModel: aiResponse._usedModel,
      _usedProvider: aiResponse._usedProvider
    };
  }
}

class AIQueueManager {
  private queues = new Map<string, ProjectQueue>();

  private getQueue(projectId: string): ProjectQueue {
    let q = this.queues.get(projectId);
    if (!q) {
      q = new ProjectQueue(projectId);
      this.queues.set(projectId, q);
    }
    return q;
  }

  enqueue(
    projectId: string,
    type: 'chat_edit' | 'page_remaster' | 'site_remaster',
    prompt: string,
    pageId?: string,
    options?: any
  ): AIQueueItem {
    const queue = this.getQueue(projectId);
    
    const item: AIQueueItem = {
      id: `ai_job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      projectId,
      type,
      status: 'pending',
      prompt,
      pageId,
      createdAt: new Date(),
      updatedAt: new Date(),
      options
    };

    queue.enqueue(item);
    return item;
  }

  getQueueList(projectId: string): AIQueueItem[] {
    const queue = this.getQueue(projectId);
    return [...queue.items];
  }

  getItemStatus(projectId: string, itemId: string): AIQueueItem | undefined {
    const queue = this.getQueue(projectId);
    return queue.items.find(i => i.id === itemId);
  }

  cancelItem(projectId: string, itemId: string): boolean {
    const queue = this.getQueue(projectId);
    queue.cancel(itemId);
    return true;
  }

  clearQueue(projectId: string): boolean {
    const queue = this.getQueue(projectId);
    queue.clear();
    return true;
  }

  getItemStatusGlobally(itemId: string): AIQueueItem | undefined {
    for (const queue of this.queues.values()) {
      const item = queue.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return undefined;
  }

  // Find any active job (pending or processing) for a project or page
  getActiveJob(projectId?: string, pageId?: string): AIQueueItem | undefined {
    if (projectId) {
      const queue = this.getQueue(projectId);
      return queue.items.find(i => i.status === 'pending' || i.status === 'processing');
    }
    
    // Fallback search across all queues
    for (const queue of this.queues.values()) {
      const active = queue.items.find(i => 
        (i.status === 'pending' || i.status === 'processing') && 
        (!pageId || i.pageId === pageId)
      );
      if (active) return active;
    }
    return undefined;
  }
}

export const aiQueueManager = new AIQueueManager();
