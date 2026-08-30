import { prisma } from '../db';
import { executeAIRequest } from './aiEngine';

export interface AIQueueItem {
  id: string;
  projectId: string;
  type: 'chat_edit' | 'page_remaster';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  pageId?: string;
  currentModel?: string;
  error?: string;
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
      // Se foi cancelado, mantém o status de cancelado
      if ((nextItem.status as string) !== 'cancelled') {
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
        item.currentModel = `[${i + 1}/${pagesToProcess.length}] Atualizando página: "${currentPage.name}"`;

        const context = {
          html: currentPage.html || '<div></div>',
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
      const context = {
        html: page.html || '<div></div>',
        css: page.css || '',
        js: page.js || ''
      };

      const result = await executeAIRequest(prompt, context, {
        ...options,
        onProgress: (info) => {
          item.currentModel = info.model;
        }
      });

      if (item.status === 'cancelled') return;

      await prisma.page.update({
        where: { id: page.id },
        data: {
          html: result.html,
          css: result.css,
          js: result.js
        }
      });

      item.result = {
        explanation: result.explanation,
        html: result.html,
        css: result.css,
        js: result.js,
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

    item.currentModel = options.model || 'gemini-2.0-flash';
    item.scope = 'single';

    const remasterPrompt = `
      Você é o Arquiteto Frontend Master.
      Estamos aprimorando o design e layout da página "${page.name}" (${page.slug}).

      DIRETRIZ DE MELHORIA DO USUÁRIO:
      """
      ${prompt || 'Melhore o layout e estilo com Tailwind CSS de forma moderna, elegante e responsiva.'}
      """

      HTML ORIGINAL DA PÁGINA:
      """
      ${page.html}
      """

      CSS ORIGINAL:
      """
      ${page.css}
      """

      JS ORIGINAL:
      """
      ${page.js}
      """

      REGRAS OBRIGATÓRIAS E INEGOCIÁVEIS:
      1. NÃO REFAÇA DO ZERO E NÃO INVENTE TEXTOS FAKE. Mantenha integralmente todas as frases originais, slogans, títulos, parágrafos, contatos, telefones e mídias.
      2. MANTENHA TODAS AS IMAGENS E MÍDIAS: Preserve fielmente as tags <img src="..."> e URLs de imagem.
      3. DESIGN PREMIUM COM TAILWIND CSS: Reestruture as seções em um layout moderno, responsivo e limpo.
      4. RETORNO LIMPO: Retorne apenas HTML em "html", CSS em "css" e JS em "js".
    `;

    const context = {
      html: page.html || '',
      css: page.css || '',
      js: page.js || ''
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

    const updatedHtml = aiResponse.html || page.html;
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
    type: 'chat_edit' | 'page_remaster',
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
