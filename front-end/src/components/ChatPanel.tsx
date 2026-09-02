import React, { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Send, Bot, User, Check, Play, Undo2, Globe, Loader2, RotateCcw, AlertCircle, Layers, ChevronDown, CheckSquare, Square, Copy, Paperclip, X, Image as ImageIcon, FileCode } from 'lucide-react';
import { API_URL } from '../config';

const AiResultSchema = z.object({
  components: z.array(z.any()), // To be refined with a full schema
  css: z.string().optional().default(''),
  js: z.string().optional().default(''),
  explanation: z.string().optional().default(''),
  _usedModel: z.string().optional(),
});

interface PageInfo {
  id: string;
  name: string;
  slug: string;
  isHomepage?: boolean;
}

interface ChatPanelProps {
  pageId: string;
  projectId?: string;
  pages?: PageInfo[];
  activePageHtml?: string;
  onApplyChanges: (components: any[], css: string, js: string, targetPageId?: string) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onReloadAllPages?: () => void;
  editScope?: 'all' | 'section';
  setEditScope?: (scope: 'all' | 'section') => void;
  selectedSectionIndex?: number | null;
  setSelectedSectionIndex?: (index: number | null) => void;
  onSectionsDetected?: (sections: Array<{ index: number; label: string; html: string; tagName: string }>) => void;
}

export interface AttachedFile {
  name: string;
  type: string;
  data: string;
  isImage?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  html?: string; // To be deprecated
  components?: any[]; // New structure
  css?: string;
  js?: string;
  modelUsed?: string;
  applied?: boolean;
  scope?: 'single' | 'all';
  isError?: boolean;
  failedPrompt?: string;
  attachedFiles?: AttachedFile[];
  id?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  pageId, 
  projectId,
  pages = [],
  activePageHtml = '',
  onApplyChanges, 
  onUndo, 
  canUndo, 
  onReloadAllPages,
  editScope: externalEditScope,
  setEditScope: externalSetEditScope,
  selectedSectionIndex: externalSelectedSectionIndex,
  setSelectedSectionIndex: externalSelectedSectionIndexSetter,
  onSectionsDetected
}) => {
  const { token } = useAuth();
  const chatStorageKey = projectId ? `chat_history_proj_${projectId}` : `chat_history_${pageId}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(chatStorageKey);
    return stored ? JSON.parse(stored) : [
      {
        role: 'assistant',
        text: 'Olá! Sou o seu AI Copilot e Arquiteto Frontend. Peça qualquer alteração ("adicione botão WhatsApp", "padronize a navbar para todas as páginas", "crie tabela de preços") e envie arquivos ou logos para eu utilizar no projeto!'
      }
    ];
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedMessageIdx, setCopiedMessageIdx] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Seleção de páginas alvo
  const [targetPageIds, setTargetPageIds] = useState<string[]>([pageId]);
  const [showPagesDropdown, setShowPagesDropdown] = useState(false);
  
  const [activeJobModel, setActiveJobModel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activePollRef = useRef<any>(null);
  
  // Fila de tarefas de IA do projeto
  const [projectQueue, setProjectQueue] = useState<any[]>([]);

  // Controle de escopo da edição (redefinido para prevenção de regressões)
  const [localEditScope, setLocalEditScope] = useState<'all' | 'section'>('all');
  const editScope = externalEditScope !== undefined ? externalEditScope : localEditScope;
  const setEditScope = externalSetEditScope !== undefined ? externalSetEditScope : setLocalEditScope;

  const [detectedSections, setDetectedSections] = useState<Array<{ index: number; label: string; html: string; tagName: string }>>([]);
  
  const [localSelectedSectionIndex, setLocalSelectedSectionIndex] = useState<number | null>(null);
  const selectedSectionIndex = externalSelectedSectionIndex !== undefined && externalSelectedSectionIndex !== null ? externalSelectedSectionIndex : localSelectedSectionIndex;
  const setSelectedSectionIndex = externalSelectedSectionIndexSetter !== undefined ? externalSelectedSectionIndexSetter : setLocalSelectedSectionIndex;

  // Parser em tempo de execução para auto-detecção de seções do canvas no frontend (Zero instabilidade)
  useEffect(() => {
    if (!activePageHtml) {
      setDetectedSections([]);
      setSelectedSectionIndex(null);
      return;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(activePageHtml, 'text/html');
      
      // Encontra o wrapper comum (#page-wrapper, #canvas-root ou body)
      const wrapper = doc.querySelector('#page-wrapper') || doc.querySelector('#canvas-root') || doc.body;
      const children = Array.from(wrapper.children);
      
      const sections = children.map((child, index) => {
        let label = '';
        const tagName = child.tagName.toLowerCase();
        
        if (tagName === 'header' || tagName === 'nav' || child.querySelector('nav') || child.id?.includes('header') || child.className?.includes('header')) {
          label = `Cabeçalho / Menu (Navbar)`;
        } else if (tagName === 'footer' || child.id?.includes('footer') || child.className?.includes('footer')) {
          label = `Rodapé (Footer)`;
        } else if (child.id?.includes('hero') || child.className?.includes('hero')) {
          label = `Seção Hero (Destaque Principal)`;
        } else if (child.id?.includes('pricing') || child.className?.includes('pricing') || child.textContent?.toLowerCase().includes('preço') || child.textContent?.toLowerCase().includes('plano')) {
          label = `Tabela de Preços (Pricing)`;
        } else if (child.id?.includes('contact') || child.className?.includes('contact') || child.querySelector('form')) {
          label = `Formulário de Contato`;
        } else if (child.id?.includes('features') || child.className?.includes('features') || child.id?.includes('beneficios') || child.className?.includes('beneficios')) {
          label = `Recursos e Benefícios`;
        } else if (child.id?.includes('testimonials') || child.className?.includes('testimonials') || child.textContent?.toLowerCase().includes('depoimentos') || child.textContent?.toLowerCase().includes('cliente')) {
          label = `Depoimentos / Clientes`;
        } else {
          const header = child.querySelector('h1, h2, h3, h4, h5, h6');
          if (header && header.textContent?.trim()) {
            const text = header.textContent.trim();
            label = `Seção: "${text.length > 25 ? text.slice(0, 25) + '...' : text}"`;
          } else {
            const textContent = child.textContent?.trim();
            if (textContent) {
              const cleanText = textContent.replace(/\s+/g, ' ');
              label = `Seção: "${cleanText.length > 25 ? cleanText.slice(0, 25) + '...' : cleanText}"`;
            } else {
              label = `Seção ${index + 1} (${tagName})`;
            }
          }
        }
        
        return {
          index,
          label: `[#${index + 1}] ${label}`,
          html: child.outerHTML,
          tagName
        };
      });

      setDetectedSections(sections);
      if (onSectionsDetected) {
        onSectionsDetected(sections);
      }
      
      // Se tiver seções, pré-seleciona a primeira se não houver seleção ou se a anterior for inválida
      if (sections.length > 0) {
        setSelectedSectionIndex(prev => {
          if (prev !== null && prev >= 0 && prev < sections.length) return prev;
          return 0;
        });
      } else {
        setSelectedSectionIndex(null);
      }
    } catch (e) {
      console.warn("Erro ao detectar seções no frontend:", e);
      setDetectedSections([]);
      if (onSectionsDetected) {
        onSectionsDetected([]);
      }
      setSelectedSectionIndex(null);
    }
  }, [activePageHtml, onSectionsDetected]);

  // Buscar fila de IA do projeto periodicamente
  useEffect(() => {
    if (!token || !projectId) return;

    const fetchQueue = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ai/queue/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.queue)) {
            setProjectQueue(data.queue);
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar fila de IA do projeto:", err);
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [projectId, token]);

  // Capturar e monitorar automaticamente tarefas ativas na fila
  useEffect(() => {
    if (loading || !projectQueue || projectQueue.length === 0) return;

    // Encontra a primeira tarefa pendente ou em processamento relacionada a este projeto
    const activeJob = projectQueue.find(job => job.status === 'pending' || job.status === 'processing');
    if (activeJob) {
      setLoading(true);
      if (activeJob.currentModel) setActiveJobModel(activeJob.currentModel);
      startPollingJob(activeJob.id, activeJob.pageId || pageId, activeJob.prompt);
    }
  }, [projectQueue, loading, pageId]);

  const handleCancelQueueItem = async (itemId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/ai/queue/${projectId}/cancel/${itemId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setProjectQueue(prev => prev.map(i => i.id === itemId ? { ...i, status: 'cancelled' } : i));
        if (activePollRef.current) clearInterval(activePollRef.current);
        setLoading(false);
        setActiveJobModel(null);
      }
    } catch (e) {
      console.error("Erro ao cancelar tarefa da fila:", e);
    }
  };

  const handleClearCompletedQueue = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ai/queue/${projectId}/clear`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setProjectQueue(prev => prev.filter(i => i.status === 'pending' || i.status === 'processing'));
      }
    } catch (e) {
      console.error("Erro ao limpar fila:", e);
    }
  };

  const handleCopyMessageText = (text: string, idx: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMessageIdx(idx);
    setTimeout(() => {
      setCopiedMessageIdx(null);
    }, 2000);
  };

  // Sincroniza página atual com a seleção de páginas
  useEffect(() => {
    if (pageId && !targetPageIds.includes(pageId)) {
      setTargetPageIds([pageId]);
    }
  }, [pageId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(chatStorageKey, JSON.stringify(messages));
  }, [messages, chatStorageKey]);

  // Atualizar histórico quando o projectId ou pageId mudar
  useEffect(() => {
    const key = projectId ? `chat_history_proj_${projectId}` : `chat_history_${pageId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch {}
    } else {
      setMessages([
        {
          role: 'assistant',
          text: 'Olá! Sou o seu AI Copilot e Arquiteto Frontend. Peça qualquer alteração ("adicione botão WhatsApp", "mude a cor da navbar em todas as páginas", "crie tabela de preços") e aplicarei imediatamente!'
        }
      ]);
    }
  }, [projectId, pageId]);

  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>(() => {
    const preferredProvider = localStorage.getItem('preferred_ai_provider') || 'gemini';
    if (preferredProvider === 'ollama') {
      const stored = localStorage.getItem('ollama_models');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
      return [{ id: 'qwen2.5-coder:1.5b', name: 'Qwen 2.5 Coder (1.5B)' }];
    }
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      try {
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let changed = false;
          parsed = parsed.map((m: any) => {
            if (m.id === 'gemini-1.5-flash' || m.id === 'gemini-2.0-flash' || m.id === 'gemini-1.0-pro') {
              changed = true;
              return { ...m, id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' };
            }
            if (m.id === 'gemini-1.5-pro') {
              changed = true;
              return { ...m, id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' };
            }
            return m;
          });
          if (changed) localStorage.setItem('custom_gemini_models', JSON.stringify(parsed));
          return parsed;
        }
      } catch {}
    }
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recomendado)' },
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
    ];
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const preferredProvider = localStorage.getItem('preferred_ai_provider') || 'gemini';
    if (preferredProvider === 'ollama') {
      const savedOllama = localStorage.getItem('ollama_selected_model') || localStorage.getItem('last_selected_ai_model');
      if (savedOllama) return savedOllama;
      
      const stored = localStorage.getItem('ollama_models');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.length > 0) return parsed[0].id;
        } catch {}
      }
      return 'qwen2.5-coder:1.5b';
    }
    let savedLastModel = localStorage.getItem('last_selected_ai_model');
    if (savedLastModel === 'gemini-1.5-flash' || savedLastModel === 'gemini-2.0-flash') savedLastModel = 'gemini-2.5-flash';
    if (savedLastModel === 'gemini-1.5-pro') savedLastModel = 'gemini-2.5-pro';
    
    if (savedLastModel) return savedLastModel;

    // 2. Se não houver, tenta o primeiro modelo customizado configurado
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed[0].id;
      } catch {}
    }
    return 'gemini-2.5-flash';
  });

  // Salvar no localStorage sempre que o usuário alterar o modelo
  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    try {
      localStorage.setItem('last_selected_ai_model', modelId);
      const preferredProvider = localStorage.getItem('preferred_ai_provider');
      if (preferredProvider === 'ollama') {
        localStorage.setItem('ollama_selected_model', modelId);
      }
    } catch {}
  };

  useEffect(() => {
    const loadStoredModels = () => {
      const preferredProvider = localStorage.getItem('preferred_ai_provider') || 'gemini';
      
      if (preferredProvider === 'ollama') {
        const stored = localStorage.getItem('ollama_models');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAvailableModels(parsed);
              const savedLastModel = localStorage.getItem('ollama_selected_model') || localStorage.getItem('last_selected_ai_model');
              if (savedLastModel && parsed.some((m: any) => m.id === savedLastModel)) {
                setSelectedModel(savedLastModel);
              } else {
                setSelectedModel(parsed[0].id);
              }
              return;
            }
          } catch {}
        }
      }
      
      const stored = localStorage.getItem('custom_gemini_models');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAvailableModels(parsed);
            const savedLastModel = localStorage.getItem('last_selected_ai_model');
            if (savedLastModel && parsed.some((m: any) => m.id === savedLastModel)) {
              setSelectedModel(savedLastModel);
            } else if (!parsed.some((m: any) => m.id === selectedModel)) {
              setSelectedModel(parsed[0].id);
            }
          }
        } catch {}
      }
    };
    loadStoredModels();
  }, []);

  // Verificar automaticamente se há um job ativo no servidor ao carregar/trocar de página
  useEffect(() => {
    let isMounted = true;

    const checkActiveJob = async () => {
      if (!token) return;
      try {
        const queryParams = new URLSearchParams();
        if (pageId) queryParams.append('pageId', pageId);
        if (projectId) queryParams.append('projectId', projectId);

        const res = await fetch(`${API_URL}/api/ai/jobs/active?${queryParams.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          const activeJob = await res.json();
          if (isMounted && activeJob && activeJob.jobId && (activeJob.status === 'processing' || activeJob.status === 'pending')) {
            setLoading(true);
            if (activeJob.currentModel) setActiveJobModel(activeJob.currentModel);
            startPollingJob(activeJob.jobId, pageId);
          }
        }
      } catch (e) {
        console.warn("Erro ao checar job ativo no servidor:", e);
      }
    };

    checkActiveJob();

    return () => {
      isMounted = false;
      if (activePollRef.current) {
        clearInterval(activePollRef.current);
      }
    };
  }, [pageId, projectId, token]);

  const [lastUserPrompt, setLastUserPrompt] = useState<string>('');

  const startPollingJob = (jobId: string, targetPageId: string, promptSent?: string) => {
    if (activePollRef.current) clearInterval(activePollRef.current);

    activePollRef.current = setInterval(async () => {
      try {
        let statusRes = await fetch(`${API_URL}/api/ai/chat-job/${jobId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!statusRes.ok) {
          statusRes = await fetch(`${API_URL}/api/ai/jobs/${jobId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }

        if (statusRes.ok) {
          const jobData = await statusRes.json();
          if (jobData.currentModel) setActiveJobModel(jobData.currentModel);

          const storageKeyToUse = projectId ? `chat_history_proj_${projectId}` : `chat_history_${targetPageId}`;

          if (jobData.status === 'completed' && jobData.result) {
            if (activePollRef.current) clearInterval(activePollRef.current);
            setLoading(false);
            setActiveJobModel(null);

            const result = AiResultSchema.safeParse(jobData.result);

            if (!result.success) {
              console.error("Erro de validação do resultado da IA:", result.error);
              const errorMessage: Message = { 
                role: 'assistant', 
                text: "Erro: A resposta da IA não está no formato esperado.",
                isError: true,
                failedPrompt: promptSent || lastUserPrompt,
                id: jobId
              };
              const freshStored = localStorage.getItem(storageKeyToUse);
              const freshMessages: Message[] = freshStored ? JSON.parse(freshStored) : [];
              if (!freshMessages.some(m => m.id === jobId)) {
                const finalMessages = [...freshMessages, errorMessage];
                localStorage.setItem(storageKeyToUse, JSON.stringify(finalMessages));
                setMessages(finalMessages);
              }
              return;
            }

            const assistantMessage: Message = { 
              role: 'assistant', 
              text: result.data.explanation || 'Alterações arquitetadas e geradas com sucesso.',
              components: result.data.components,
              css: result.data.css,
              js: result.data.js,
              modelUsed: result.data._usedModel || jobData.currentModel || selectedModel,
              applied: true,
              scope: jobData.scope,
              id: jobId
            };

            const freshStored = localStorage.getItem(storageKeyToUse);
            const freshMessages: Message[] = freshStored ? JSON.parse(freshStored) : [];
            
            if (!freshMessages.some(m => m.id === jobId)) {
              const finalMessages = [...freshMessages, assistantMessage];
              localStorage.setItem(storageKeyToUse, JSON.stringify(finalMessages));
              setMessages(finalMessages);
            }

            // Se a alteração foi em todas as páginas, recarrega o projeto inteiro
            if (jobData.scope === 'all' && onReloadAllPages) {
              onReloadAllPages();
            }

            // Auto-aplica as alterações imediatamente no Canvas atual
            if (result.data.components) {
              onApplyChanges(result.data.components, result.data.css || '', result.data.js || '', targetPageId);
            }
          } else if (jobData.status === 'failed') {
            if (activePollRef.current) clearInterval(activePollRef.current);
            setLoading(false);
            setActiveJobModel(null);

            const errorMessage: Message = { 
              role: 'assistant', 
              text: `Erro: ${jobData.error || 'Falha ao processar alterações com IA.'}`,
              isError: true,
              failedPrompt: promptSent || lastUserPrompt,
              id: jobId
            };
            const freshStored = localStorage.getItem(storageKeyToUse);
            const freshMessages: Message[] = freshStored ? JSON.parse(freshStored) : [];
            
            if (!freshMessages.some(m => m.id === jobId)) {
              const finalMessages = [...freshMessages, errorMessage];
              localStorage.setItem(storageKeyToUse, JSON.stringify(finalMessages));
              setMessages(finalMessages);
            }
          } else if (jobData.status === 'cancelled') {
            if (activePollRef.current) clearInterval(activePollRef.current);
            setLoading(false);
            setActiveJobModel(null);

            const cancelMessage: Message = { 
              role: 'assistant', 
              text: `Tarefa cancelada pelo usuário.`,
              id: jobId
            };
            const freshStored = localStorage.getItem(storageKeyToUse);
            const freshMessages: Message[] = freshStored ? JSON.parse(freshStored) : [];
            
            if (!freshMessages.some(m => m.id === jobId)) {
              const finalMessages = [...freshMessages, cancelMessage];
              localStorage.setItem(storageKeyToUse, JSON.stringify(finalMessages));
              setMessages(finalMessages);
            }
          }
        }
      } catch (pollErr: any) {
        const isNetworkError = pollErr instanceof TypeError || (pollErr && pollErr.message && pollErr.message.includes('fetch'));
        if (isNetworkError) {
          console.warn("Conexão instável ou servidor reiniciando... Retentando polling do chat IA silenciosamente.");
        } else {
          console.error("Erro no polling do chat IA:", pollErr);
        }
      }
    }, 1500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|svg|webp|gif)$/i.test(file.name);
      const reader = new FileReader();

      if (isImg) {
        reader.onload = () => {
          setAttachedFiles(prev => [
            ...prev,
            {
              name: file.name,
              type: file.type || 'image/png',
              data: reader.result as string,
              isImage: true
            }
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          setAttachedFiles(prev => [
            ...prev,
            {
              name: file.name,
              type: file.type || 'text/plain',
              data: reader.result as string,
              isImage: false
            }
          ]);
        };
        reader.readAsText(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const executeSendPrompt = async (userMessage: string, filesToSend?: AttachedFile[]) => {
    const currentFiles = filesToSend !== undefined ? filesToSend : attachedFiles;
    if ((!userMessage.trim() && currentFiles.length === 0) || loading) return;

    const messageText = userMessage.trim() || (currentFiles.length > 0 ? `Analise e aplique as referências dos ${currentFiles.length} arquivo(s) anexo(s).` : '');

    setLastUserPrompt(messageText);
    const updatedMessages = [
      ...messages, 
      { 
        role: 'user', 
        text: messageText,
        attachedFiles: currentFiles.length > 0 ? currentFiles : undefined
      } as Message
    ];
    setMessages(updatedMessages);
    localStorage.setItem(chatStorageKey, JSON.stringify(updatedMessages));
    setLoading(true);
    setActiveJobModel(selectedModel);
    setAttachedFiles([]);

    const localGeminiKey = localStorage.getItem('gemini_api_key') || '';
    const currentRequestPageId = pageId;
    const isMultiTarget = targetPageIds.length > 1 || (pages.length > 0 && targetPageIds.length === pages.length);

    try {
      let registeredModelIds: string[] = [];
      try {
        const stored = localStorage.getItem('custom_gemini_models');
        if (stored) registeredModelIds = JSON.parse(stored).map((m: any) => m.id);
      } catch {}

      // Headers HTTP só aceitam caracteres ISO-8859-1 — valores com acentos (pt-BR)
      // precisam ser encodados para evitar o erro "non ISO-8859-1 code point"
      const safeHeader = (val: string) => {
        try { return btoa(unescape(encodeURIComponent(val))); } catch { return ''; }
      };

      const preferredProvider = localStorage.getItem('preferred_ai_provider') || 'gemini';
      const ollamaEndpoint = localStorage.getItem('ollama_endpoint') || 'http://localhost:11434';
      const lowSpecMode = localStorage.getItem('ollama_low_spec_mode') === 'true';

      const res = await fetch(`${API_URL}/api/ai/modify-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-ai-provider': preferredProvider,
          'x-gemini-key': safeHeader(localGeminiKey),
          'x-gemini-model': preferredProvider === 'ollama' ? (localStorage.getItem('ollama_selected_model') || selectedModel) : selectedModel,
          'x-registered-models': safeHeader(JSON.stringify(registeredModelIds)),
          'x-ai-proxy-url': safeHeader(localStorage.getItem('ai_proxy_url') || ''),
          'x-custom-ai-skills': safeHeader(localStorage.getItem('custom_ai_skills') || ''),
          'x-ollama-endpoint': safeHeader(ollamaEndpoint),
          'x-low-spec-mode': String(lowSpecMode)
        },
        body: JSON.stringify({ 
          prompt: `${messageText}\n\nIMPORTANT: Return your response strictly as a JSON object with the following structure: { "components": ComponentNode[], "css": string, "js": string, "explanation": string }. Use the ComponentNode type defined as { id: string, type: 'container' | 'text' | 'image' | 'button' | 'section', props: { className?: string, style?: any, [key: string]: any }, children?: ComponentNode[], text?: string }. Do NOT return raw HTML.`, 
          pageId: currentRequestPageId, 
          model: preferredProvider === 'ollama' ? (localStorage.getItem('ollama_selected_model') || selectedModel) : selectedModel,
          applyToAll: isMultiTarget,
          targetPageIds: targetPageIds,
          attachedFiles: currentFiles.length > 0 ? currentFiles : undefined,
          provider: preferredProvider,
          ollamaEndpoint,
          lowSpecMode,
          targetSectionIndex: editScope === 'section' && selectedSectionIndex !== null ? selectedSectionIndex : undefined,
          targetSectionLabel: editScope === 'section' && selectedSectionIndex !== null ? detectedSections[selectedSectionIndex]?.label : undefined,
          targetSectionHtml: editScope === 'section' && selectedSectionIndex !== null ? detectedSections[selectedSectionIndex]?.html : undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao iniciar solicitação de IA');
      }
      
      const { jobId } = await res.json();
      startPollingJob(jobId, currentRequestPageId, messageText);
    } catch (err: any) {
      setLoading(false);
      const errorMessage: Message = { 
        role: 'assistant', 
        text: `Erro: ${err.message}`,
        isError: true,
        failedPrompt: messageText
      };
      const freshStored = localStorage.getItem(chatStorageKey);
      const freshMessages = freshStored ? JSON.parse(freshStored) : updatedMessages;
      const finalMessages = [...freshMessages, errorMessage];
      localStorage.setItem(chatStorageKey, JSON.stringify(finalMessages));
      setMessages(finalMessages);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || loading) return;
    const msg = input;
    const files = [...attachedFiles];
    setInput('');
    await executeSendPrompt(msg, files);
  };

  const handleRetryLastMessage = (promptToRetry?: string) => {
    const targetPrompt = promptToRetry || lastUserPrompt;
    if (!targetPrompt || loading) return;
    executeSendPrompt(targetPrompt);
  };

  const togglePageSelection = (id: string) => {
    if (targetPageIds.includes(id)) {
      if (targetPageIds.length > 1) {
        setTargetPageIds(targetPageIds.filter(pid => pid !== id));
      }
    } else {
      setTargetPageIds([...targetPageIds, id]);
    }
  };

  const selectAllPages = () => {
    if (pages.length > 0) {
      setTargetPageIds(pages.map(p => p.id));
    }
  };

  const selectOnlyCurrentPage = () => {
    setTargetPageIds([pageId]);
  };

  return (
    <aside className="w-80 bg-slate-950 border-l border-slate-900 flex flex-col h-full z-20 shrink-0 select-none">
      {/* Header Compacto */}
      <div className="px-3 py-2.5 border-b border-slate-900 flex items-center justify-between bg-slate-950/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-lg text-white shadow-sm shadow-purple-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Gerando...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {canUndo && onUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
              title="Desfazer última alteração de IA"
            >
              <Undo2 className="w-3 h-3" />
              Desfazer
            </button>
          )}

          {/* Model Selector Dropdown */}
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-[10px] text-purple-300 font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500 cursor-pointer max-w-[135px] truncate"
            title="Selecionar modelo de IA (lembrado automaticamente)"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id} className="bg-slate-950 text-white">
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Seletor de Escopo de Páginas (Dropdown Multi-Select) */}
      {pages && pages.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-900 bg-slate-900/40 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Escopo de Aplicação:</span>
            </div>
            
            <button
              type="button"
              onClick={() => setShowPagesDropdown(!showPagesDropdown)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-purple-500/30 text-purple-300 hover:text-white hover:border-purple-400 text-[11px] font-mono transition-all cursor-pointer"
            >
              <span>
                {targetPageIds.length === 1 && targetPageIds[0] === pageId
                  ? 'Apenas Esta Página'
                  : targetPageIds.length === pages.length
                  ? 'Todas as Páginas'
                  : `${targetPageIds.length} Páginas Selecionadas`}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showPagesDropdown ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Dropdown Popup para Selecionar Páginas */}
          {showPagesDropdown && (
            <div className="absolute left-3 right-3 top-full mt-1.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-850 px-1 text-[10px]">
                <button
                  type="button"
                  onClick={selectAllPages}
                  className="text-purple-400 hover:text-purple-300 font-bold cursor-pointer"
                >
                  Marcar Todas
                </button>
                <button
                  type="button"
                  onClick={selectOnlyCurrentPage}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  Apenas Atual
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 py-1">
                {pages.map((p) => {
                  const isChecked = targetPageIds.includes(p.id);
                  const isCurrent = p.id === pageId;
                  return (
                    <label
                      key={p.id}
                      onClick={() => togglePageSelection(p.id)}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isChecked 
                          ? 'bg-purple-950/40 text-purple-200 border border-purple-500/30' 
                          : 'hover:bg-slate-900 text-slate-400 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isChecked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        )}
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 font-mono shrink-0">
                          atual
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              {msg.role === 'assistant' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-300 font-mono">
                    Copilot {msg.modelUsed ? `(${msg.modelUsed})` : ''}
                  </span>
                  {msg.scope === 'all' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold">
                      Multi-Páginas
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-slate-400">Você</span>
                  <User className="w-3.5 h-3.5 text-slate-400" />
                </>
              )}
            </div>

            <div
              className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[95%] shadow-md relative group/msg ${
                msg.role === 'user'
                  ? 'bg-purple-700 text-white rounded-br-none shadow-[0_0_15px_rgba(168,85,247,0.2)] font-medium'
                  : msg.isError || msg.text.startsWith('Erro:')
                  ? 'bg-red-950/40 text-red-200 border border-red-500/40 rounded-bl-none shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none'
              }`}
            >
              {/* Arquivos anexados nesta mensagem */}
              {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-white/10">
                  {msg.attachedFiles.map((file, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-[10px]">
                      {file.isImage ? (
                        <div className="w-5 h-5 rounded overflow-hidden bg-slate-800 shrink-0">
                          <img src={file.data} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                      )}
                      <span className="max-w-[120px] truncate text-slate-200">{file.name}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  {(msg.isError || msg.text.startsWith('Erro:')) && (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <p className="whitespace-pre-wrap flex-1">{msg.text}</p>
                </div>

                {/* Botão de Copiar Texto do Balão */}
                <button
                  onClick={() => handleCopyMessageText(msg.text, idx)}
                  className="opacity-40 group-hover/msg:opacity-100 hover:opacity-100 p-1 rounded-md text-slate-300 hover:text-white hover:bg-black/30 transition-all shrink-0 cursor-pointer"
                  title="Copiar texto da mensagem"
                >
                  {copiedMessageIdx === idx ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold">
                      <Check className="w-3.5 h-3.5" />
                      Copiado!
                    </span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Botão de Tentar Novamente caso a mensagem tenha falhado */}
              {(msg.isError || msg.text.startsWith('Erro:')) && (
                <div className="mt-3 pt-2.5 border-t border-red-500/20 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-red-400/90 font-medium">
                    Falha na resposta da IA
                  </span>
                  <button
                    onClick={() => handleRetryLastMessage(msg.failedPrompt)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-lg text-[11px] transition-all shadow-sm hover:shadow-[0_0_10px_rgba(239,68,68,0.4)] cursor-pointer"
                    title="Enviar este comando novamente para a IA"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Tentar Novamente
                  </button>
                </div>
              )}

              {/* Botão de Aplicação Manual / Reaplicação */}
              {msg.html && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    Código Pronto
                  </span>
                  <button
                    onClick={() => onApplyChanges(msg.components || [], msg.css || '', msg.js || '', pageId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-[11px] transition-all shadow-sm hover:shadow-[0_0_10px_rgba(168,85,247,0.4)] cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    Reaplicar no Canvas
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Fila de Atividades da IA */}
        {projectQueue.length > 0 && projectQueue.some(item => item.status === 'pending' || item.status === 'processing') && (
          <div className="bg-slate-900/60 rounded-xl p-3 border border-purple-500/20 space-y-2 mt-4 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Fila de IA ({projectQueue.filter(item => item.status === 'pending' || item.status === 'processing').length})</span>
              </div>
              <button
                type="button"
                onClick={handleClearCompletedQueue}
                className="text-[9px] text-slate-500 hover:text-slate-300 font-semibold cursor-pointer"
              >
                Limpar Concluídas
              </button>
            </div>
            
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {projectQueue.map((item, qIdx) => {
                if (item.status !== 'pending' && item.status !== 'processing') return null;
                const isProcessing = item.status === 'processing';
                
                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg border text-[11px] flex items-center justify-between gap-3 ${
                      isProcessing
                        ? 'bg-purple-950/20 border-purple-500/40'
                        : 'bg-slate-950/40 border-slate-850'
                    }`}
                  >
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="font-bold text-slate-200 truncate block">
                          {item.type === 'page_remaster' ? 'Remasterização' : item.type === 'site_remaster' ? 'Remasterização do Site' : 'Ajuste de Chat'}
                        </span>
                        <span className="text-[9px] px-1 bg-slate-800 text-slate-400 rounded font-mono shrink-0">
                          #{qIdx + 1}
                        </span>
                      </div>
                      
                      <p className="text-slate-300 truncate font-medium">{item.prompt}</p>
                      
                      {isProcessing && item.currentModel && (
                        <p className="text-[9px] text-purple-400 font-mono truncate">{item.currentModel}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isProcessing ? (
                        <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                      ) : (
                        <span className="text-[9px] text-slate-500 font-semibold">Aguardando</span>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => handleCancelQueueItem(item.id)}
                        className="p-1 rounded bg-slate-950 hover:bg-red-950 text-slate-500 hover:text-red-400 border border-slate-800 transition-colors cursor-pointer"
                        title="Cancelar tarefa"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-start gap-2 animate-in fade-in">
            <div className="p-3.5 bg-slate-900 border border-purple-500/40 rounded-2xl rounded-bl-none text-xs text-purple-300 flex flex-col gap-2.5 shadow-lg shadow-purple-950/50">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  Processando requisição no servidor...
                </span>
              </div>
              {activeJobModel && (
                <div className="text-[10px] text-slate-400 font-mono bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                  Engine: <strong className="text-purple-300">{activeJobModel}</strong>
                </div>
              )}
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 h-full animate-pulse w-full" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form com Indicação do Escopo Selecionado e Pré-visualização de Arquivos */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-900/80 bg-slate-950/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Aplicando em:{' '}
              <strong className="text-purple-300">
                {targetPageIds.length === 1 && targetPageIds[0] === pageId
                  ? 'Página atual'
                  : targetPageIds.length === pages.length
                  ? 'Todas as páginas'
                  : `${targetPageIds.length} páginas`}
              </strong>
            </span>
          </div>
          {targetPageIds.length > 1 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/30 text-purple-300 font-mono">
              Navbar/Footer sincronizados
            </span>
          )}
        </div>

        {/* Controle do Escopo da Edição (Evita processar o site inteiro) */}
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Escopo de Edição</span>
            
            <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-850">
              <button
                type="button"
                onClick={() => setEditScope('all')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  editScope === 'all'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Página Inteira
              </button>
              <button
                type="button"
                onClick={() => setEditScope('section')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  editScope === 'section'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Apenas Seção
              </button>
            </div>
          </div>

          {editScope === 'section' && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="text-[9px] text-slate-500 font-bold block">Selecione a seção a ser modificada pelo prompt:</label>
              {detectedSections.length > 0 ? (
                <select
                  value={selectedSectionIndex ?? 0}
                  onChange={(e) => setSelectedSectionIndex(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none focus:border-purple-500 cursor-pointer"
                >
                  {detectedSections.map((sec) => (
                    <option key={sec.index} value={sec.index}>
                      {sec.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[10px] text-yellow-500/90 bg-yellow-950/20 px-2 py-1 rounded-lg border border-yellow-800/30 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Nenhuma seção detectada. Certifique-se de que a página possui blocos estruturais válidos.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prévia de Arquivos Anexados no Input */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900/90 border border-purple-500/30 rounded-xl">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] group">
                {file.isImage ? (
                  <img src={file.data} alt={file.name} className="w-4 h-4 rounded object-cover" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span className="max-w-[110px] truncate text-slate-300">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachedFile(index)}
                  className="text-slate-500 hover:text-red-400 ml-0.5 cursor-pointer"
                  title="Remover anexo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-center">
          {/* Input Oculto de Arquivo */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,.html,.htm,.css,.js,.jsx,.ts,.tsx,.txt,.json,.svg"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-800/60 rounded-lg transition-all cursor-pointer z-10"
            title="Anexar arquivo, logo ou código de referência"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Peça alteração ou envie logos e referências (Enter para enviar)..."
            className="w-full pl-9 pr-10 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs text-white placeholder-slate-500 resize-none"
          />
          <button
            type="submit"
            disabled={(!input.trim() && attachedFiles.length === 0) || loading}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
