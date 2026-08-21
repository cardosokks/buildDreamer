import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Send, Bot, User, Check, Play, Undo2, RotateCcw, Copy, ExternalLink, Code2 } from 'lucide-react';
import { API_URL } from '../config';

interface ChatPanelProps {
  pageId: string;
  onApplyChanges: (html: string, css: string, js: string, targetPageId?: string) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  html?: string;
  css?: string;
  js?: string;
  modelUsed?: string;
  applied?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ pageId, onApplyChanges, onUndo, canUndo }) => {
  const { token } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(`chat_history_${pageId}`);
    return stored ? JSON.parse(stored) : [
      {
        role: 'assistant',
        text: 'Olá! Sou o seu AI Copilot e Arquiteto Frontend. Peça qualquer alteração ("mude o título para azul", "adicione uma seção de depoimentos", "crie um card com efeito glassmorphism") e gerarei o código perfeito para seu site!'
      }
    ];
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeJobModel, setActiveJobModel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(`chat_history_${pageId}`, JSON.stringify(messages));
  }, [messages, pageId]);

  useEffect(() => {
    const stored = localStorage.getItem(`chat_history_${pageId}`);
    if (stored) {
      setMessages(JSON.parse(stored));
    }
  }, [pageId]);

  const getInitialModel = () => {
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.length > 0) return parsed[0].id;
    }
    return 'gemini-2.5-flash';
  };

  const [selectedModel, setSelectedModel] = useState(getInitialModel());

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    const updatedMessages = [...messages, { role: 'user', text: userMessage } as Message];
    setMessages(updatedMessages);
    localStorage.setItem(`chat_history_${pageId}`, JSON.stringify(updatedMessages));
    setLoading(true);
    setActiveJobModel(selectedModel);

    const localGeminiKey = localStorage.getItem('gemini_api_key') || '';
    const currentRequestPageId = pageId;

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
          'x-gemini-models': JSON.stringify(registeredModelIds)
        },
        body: JSON.stringify({ prompt: userMessage, pageId: currentRequestPageId, model: selectedModel })
      });

      if (!res.ok) throw new Error('Falha ao iniciar solicitação de IA');
      
      const { jobId } = await res.json();

      // Polling do Job de IA em background com feedback visual
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/api/ai/jobs/${jobId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (statusRes.ok) {
            const jobData = await statusRes.json();
            if (jobData.currentModel) setActiveJobModel(jobData.currentModel);

            if (jobData.status === 'completed' && jobData.result) {
              clearInterval(pollInterval);
              setLoading(false);

              const assistantMessage: Message = { 
                role: 'assistant', 
                text: jobData.result.explanation || 'Alterações arquitetadas e geradas com sucesso.',
                html: jobData.result.html,
                css: jobData.result.css,
                js: jobData.result.js,
                modelUsed: jobData.result._usedModel || jobData.currentModel || selectedModel,
                applied: true
              };

              const freshStored = localStorage.getItem(`chat_history_${currentRequestPageId}`);
              const freshMessages = freshStored ? JSON.parse(freshStored) : updatedMessages;
              const finalMessages = [...freshMessages, assistantMessage];

              localStorage.setItem(`chat_history_${currentRequestPageId}`, JSON.stringify(finalMessages));
              if (pageId === currentRequestPageId) {
                setMessages(finalMessages);
              }

              // Auto-aplica as alterações imediatamente no Canvas
              if (jobData.result.html) {
                onApplyChanges(jobData.result.html, jobData.result.css || '', jobData.result.js || '', currentRequestPageId);
              }
            } else if (jobData.status === 'failed') {
              clearInterval(pollInterval);
              setLoading(false);

              const errorMessage: Message = { role: 'assistant', text: `Erro: ${jobData.error || 'Falha ao processar alterações'}` };
              const freshStored = localStorage.getItem(`chat_history_${currentRequestPageId}`);
              const freshMessages = freshStored ? JSON.parse(freshStored) : updatedMessages;
              const finalMessages = [...freshMessages, errorMessage];

              localStorage.setItem(`chat_history_${currentRequestPageId}`, JSON.stringify(finalMessages));
              if (pageId === currentRequestPageId) {
                setMessages(finalMessages);
              }
            }
          }
        } catch (pollErr) {
          console.error("Erro no polling do chat IA:", pollErr);
        }
      }, 1500);
    } catch (err: any) {
      setLoading(false);
      const errorMessage: Message = { role: 'assistant', text: `Erro: ${err.message}` };
      const freshStored = localStorage.getItem(`chat_history_${currentRequestPageId}`);
      const freshMessages = freshStored ? JSON.parse(freshStored) : updatedMessages;
      const finalMessages = [...freshMessages, errorMessage];

      localStorage.setItem(`chat_history_${currentRequestPageId}`, JSON.stringify(finalMessages));
      if (pageId === currentRequestPageId) {
        setMessages(finalMessages);
      }
    }
  };

  return (
    <aside className="w-80 border-l border-slate-900 bg-[#090410] flex flex-col h-full shrink-0 shadow-2xl select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-900/80 flex items-center justify-between gap-2 shrink-0 bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white tracking-wide block">AI Copilot</span>
            <span className="text-[10px] text-slate-500 font-mono">Webflow & v0 Style</span>
          </div>
        </div>

        {/* Undo Action Button */}
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium transition-all border border-slate-800 cursor-pointer"
            title="Desfazer última alteração"
          >
            <Undo2 className="w-3.5 h-3.5 text-purple-400" />
            Desfazer
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 min-h-0">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-150`}
          >
            <div className="flex items-center gap-1.5 px-1 text-[10px] text-slate-500 font-medium">
              {msg.role === 'user' ? (
                <>
                  <span>Você</span>
                  <User className="w-3 h-3 text-purple-400" />
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-cyan-400" />
                  <span>AI Copilot</span>
                  {msg.modelUsed && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-purple-950/80 border border-purple-500/30 text-purple-300 rounded font-mono">
                      {msg.modelUsed}
                    </span>
                  )}
                </>
              )}
            </div>

            <div
              className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[95%] shadow-md ${
                msg.role === 'user'
                  ? 'bg-purple-700 text-white rounded-br-none shadow-[0_0_15px_rgba(168,85,247,0.2)] font-medium'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

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
            <div className="p-3 bg-slate-900 border border-purple-500/30 rounded-2xl rounded-bl-none text-xs text-purple-300 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                <span className="font-semibold">Gerando código e estilos...</span>
              </div>
              {activeJobModel && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Engine: <strong className="text-white">{activeJobModel}</strong>
                </span>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-900/80 bg-slate-950/80">
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
