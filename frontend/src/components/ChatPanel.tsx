import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Send, Bot, User, Check, Play, Undo2, Globe, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

interface ChatPanelProps {
  pageId: string;
  projectId?: string;
  onApplyChanges: (html: string, css: string, js: string, targetPageId?: string) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onReloadAllPages?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  html?: string;
  css?: string;
  js?: string;
  modelUsed?: string;
  applied?: boolean;
  scope?: 'single' | 'all';
  isError?: boolean;
  failedPrompt?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  pageId, 
  projectId,
  onApplyChanges, 
  onUndo, 
  canUndo, 
  onReloadAllPages 
}) => {
  const { token } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(`chat_history_${pageId}`);
    return stored ? JSON.parse(stored) : [
      {
        role: 'assistant',
        text: 'Olá! Sou o seu AI Copilot e Arquiteto Frontend. Peça qualquer alteração ("adicione botão WhatsApp", "mude a cor da navbar em todas as páginas", "crie tabela de preços") e aplicarei imediatamente!'
      }
    ];
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applyToAllPages, setApplyToAllPages] = useState(false);
  const [activeJobModel, setActiveJobModel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activePollRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(`chat_history_${pageId}`, JSON.stringify(messages));
  }, [messages, pageId]);

  // Atualizar histórico quando o pageId mudar
  useEffect(() => {
    const stored = localStorage.getItem(`chat_history_${pageId}`);
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
  }, [pageId]);

  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>(() => {
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ];
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed[0].id;
      } catch {}
    }
    return 'gemini-2.5-flash';
  });

  useEffect(() => {
    const loadStoredModels = () => {
      const stored = localStorage.getItem('custom_gemini_models');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAvailableModels(parsed);
            if (!parsed.some((m: any) => m.id === selectedModel)) {
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
        const statusRes = await fetch(`${API_URL}/api/ai/jobs/${jobId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (statusRes.ok) {
          const jobData = await statusRes.json();
          if (jobData.currentModel) setActiveJobModel(jobData.currentModel);

          if (jobData.status === 'completed' && jobData.result) {
            if (activePollRef.current) clearInterval(activePollRef.current);
            setLoading(false);
            setActiveJobModel(null);

            const assistantMessage: Message = { 
              role: 'assistant', 
              text: jobData.result.explanation || 'Alterações arquitetadas e geradas com sucesso.',
              html: jobData.result.html,
              css: jobData.result.css,
              js: jobData.result.js,
              modelUsed: jobData.result._usedModel || jobData.currentModel || selectedModel,
              applied: true,
              scope: jobData.scope
            };

            const freshStored = localStorage.getItem(`chat_history_${targetPageId}`);
            const freshMessages: Message[] = freshStored ? JSON.parse(freshStored) : [];
            const finalMessages = [...freshMessages, assistantMessage];

            localStorage.setItem(`chat_history_${targetPageId}`, JSON.stringify(finalMessages));
            setMessages(finalMessages);

            // Se a alteração foi em todas as páginas, recarrega o projeto inteiro
            if (jobData.scope === 'all' && onReloadAllPages) {
              onReloadAllPages();
            }

            // Auto-aplica as alterações imediatamente no Canvas atual
            if (jobData.result.html) {
              onApplyChanges(jobData.result.html, jobData.result.css || '', jobData.result.js || '', targetPageId);
            }
          } else if (jobData.status === 'failed') {
            if (activePollRef.current) clearInterval(activePollRef.current);
            setLoading(false);
            setActiveJobModel(null);

            const errorMessage: Message = { 
              role: 'assistant', 
              text: `Erro: ${jobData.error || 'Falha ao processar alterações com IA.'}`,
              isError: true,
              failedPrompt: promptSent || lastUserPrompt
            };
            const freshStored = localStorage.getItem(`chat_history_${targetPageId}`);
            const freshMessages: Message[] = freshStored ? JSON.parse(freshStored) : [];
            const finalMessages = [...freshMessages, errorMessage];

            localStorage.setItem(`chat_history_${targetPageId}`, JSON.stringify(finalMessages));
            setMessages(finalMessages);
          }
        }
      } catch (pollErr) {
        console.error("Erro no polling do chat IA:", pollErr);
      }
    }, 1500);
  };

  const executeSendPrompt = async (userMessage: string) => {
    if (!userMessage.trim() || loading) return;

    setLastUserPrompt(userMessage.trim());
    const updatedMessages = [...messages, { role: 'user', text: userMessage.trim() } as Message];
    setMessages(updatedMessages);
    localStorage.setItem(`chat_history_${pageId}`, JSON.stringify(updatedMessages));
    setLoading(true);
    setActiveJobModel(selectedModel);

    const localGeminiKey = localStorage.getItem('gemini_api_key') || '';
    const currentRequestPageId = pageId;
    const shouldApplyToAll = applyToAllPages;

    try {
      let registeredModelIds: string[] = [];
      try {
        const stored = localStorage.getItem('custom_gemini_models');
        if (stored) registeredModelIds = JSON.parse(stored).map((m: any) => m.id);
      } catch {}

      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-gemini-key': localGeminiKey,
          'x-gemini-models': JSON.stringify(registeredModelIds),
          'x-proxy-url': localStorage.getItem('ai_proxy_url') || '',
          'x-ai-skills': localStorage.getItem('custom_ai_skills') || ''
        },
        body: JSON.stringify({ 
          prompt: userMessage.trim(), 
          pageId: currentRequestPageId, 
          model: selectedModel,
          applyToAll: shouldApplyToAll
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao iniciar solicitação de IA');
      }
      
      const { jobId } = await res.json();
      startPollingJob(jobId, currentRequestPageId, userMessage.trim());
    } catch (err: any) {
      setLoading(false);
      const errorMessage: Message = { 
        role: 'assistant', 
        text: `Erro: ${err.message}`,
        isError: true,
        failedPrompt: userMessage.trim()
      };
      const freshStored = localStorage.getItem(`chat_history_${currentRequestPageId}`);
      const freshMessages = freshStored ? JSON.parse(freshStored) : updatedMessages;
      const finalMessages = [...freshMessages, errorMessage];
      localStorage.setItem(`chat_history_${currentRequestPageId}`, JSON.stringify(finalMessages));
      if (pageId === currentRequestPageId) {
        setMessages(finalMessages);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input;
    setInput('');
    await executeSendPrompt(msg);
  };

  const handleRetryLastMessage = (promptToRetry?: string) => {
    const targetPrompt = promptToRetry || lastUserPrompt;
    if (!targetPrompt || loading) return;
    executeSendPrompt(targetPrompt);
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
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-[10px] text-purple-300 font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500 cursor-pointer max-w-[135px] truncate"
            title="Selecionar modelo de IA"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id} className="bg-slate-950 text-white">
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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
                      Todas as Páginas
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
              className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[95%] shadow-md ${
                msg.role === 'user'
                  ? 'bg-purple-700 text-white rounded-br-none shadow-[0_0_15px_rgba(168,85,247,0.2)] font-medium'
                  : msg.isError || msg.text.startsWith('Erro:')
                  ? 'bg-red-950/40 text-red-200 border border-red-500/40 rounded-bl-none shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none'
              }`}
            >
              <div className="flex items-start gap-2">
                {(msg.isError || msg.text.startsWith('Erro:')) && (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <p className="whitespace-pre-wrap flex-1">{msg.text}</p>
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
                    onClick={() => onApplyChanges(msg.html!, msg.css || '', msg.js || '', pageId)}
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

      {/* Input Form com Toggle "Aplicar em Todas as Páginas" */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-900/80 bg-slate-950/80 space-y-2">
        <label className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-white cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyToAllPages}
            onChange={(e) => setApplyToAllPages(e.target.checked)}
            className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
          />
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>Aplicar alteração em <strong>todas as páginas</strong></span>
        </label>

        <div className="relative">
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
            placeholder="Peça qualquer alteração ao Copilot (Enter para enviar)..."
            className="w-full pl-3 pr-10 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs text-white placeholder-slate-500 resize-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
