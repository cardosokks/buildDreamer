import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Send, Bot, User, Check, X, Code } from 'lucide-react';

interface ChatPanelProps {
  pageId: string;
  onApplyChanges: (html: string, css: string, js: string, targetPageId?: string) => void;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  html?: string;
  css?: string;
  js?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ pageId, onApplyChanges }) => {
  const { token } = useAuth();
  
  // Load initial messages from localStorage based on pageId
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(`chat_history_${pageId}`);
    return stored ? JSON.parse(stored) : [];
  });
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync messages state to localStorage when changes occur
  useEffect(() => {
    localStorage.setItem(`chat_history_${pageId}`, JSON.stringify(messages));
  }, [messages, pageId]);

  // Reload history when pageId changes
  useEffect(() => {
    const stored = localStorage.getItem(`chat_history_${pageId}`);
    setMessages(stored ? JSON.parse(stored) : []);
  }, [pageId]);

  const getInitialModel = () => {
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.length > 0) return parsed[0].id;
    }
    return 'gemini-1.5-flash';
  };

  const [selectedModel, setSelectedModel] = useState(getInitialModel());

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message and save instantly in localStorage
    const updatedMessages = [...messages, { role: 'user', text: userMessage } as Message];
    setMessages(updatedMessages);
    localStorage.setItem(`chat_history_${pageId}`, JSON.stringify(updatedMessages));
    setLoading(true);

    const localGeminiKey = localStorage.getItem('gemini_api_key') || '';
    const currentRequestPageId = pageId; // lock pageId at send time

    try {
      const res = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-gemini-key': localGeminiKey
        },
        body: JSON.stringify({ prompt: userMessage, pageId: currentRequestPageId, model: selectedModel })
      });

      if (!res.ok) throw new Error('Falha ao processar solicitação de IA');
      
      const data = await res.json();
      const assistantMessage: Message = { 
        role: 'assistant', 
        text: data.explanation || 'Alterações geradas com sucesso.',
        html: data.html,
        css: data.css,
        js: data.js
      };

      // Read state from localStorage to ensure we don't overwrite if user swapped tabs
      const freshStored = localStorage.getItem(`chat_history_${currentRequestPageId}`);
      const freshMessages = freshStored ? JSON.parse(freshStored) : updatedMessages;
      const finalMessages = [...freshMessages, assistantMessage];

      localStorage.setItem(`chat_history_${currentRequestPageId}`, JSON.stringify(finalMessages));
      
      // If we are still on the same page, update current component state
      if (pageId === currentRequestPageId) {
        setMessages(finalMessages);
      }

      // Apply changes directly automatically (eliminates manual button dependency)
      if (data.html) {
        onApplyChanges(data.html, data.css || '', data.js || '', currentRequestPageId);
      }
    } catch (err: any) {
      const errorMessage: Message = { role: 'assistant', text: `Erro: ${err.message}` };
      const freshStored = localStorage.getItem(`chat_history_${currentRequestPageId}`);
      const freshMessages = freshStored ? JSON.parse(freshStored) : updatedMessages;
      const finalMessages = [...freshMessages, errorMessage];

      localStorage.setItem(`chat_history_${currentRequestPageId}`, JSON.stringify(finalMessages));
      if (pageId === currentRequestPageId) {
        setMessages(finalMessages);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-80 border-l border-slate-900 bg-slate-950 flex flex-col h-full shrink-0 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-900 flex items-center justify-between gap-2 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 shrink-0">
          <Sparkles className="w-4 h-4 text-purple-400" />
          IA Chat
        </span>

        {/* Model Selector Dropdown */}
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-350 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono cursor-pointer"
        >
          {(() => {
            const stored = localStorage.getItem('custom_gemini_models');
            const modelsList = stored ? JSON.parse(stored) : [
              { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recomendado)' },
              { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
              { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
              { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
              { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
            ];
            return modelsList.map((m: any) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ));
          })()}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            <Bot className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
            Peça para a IA fazer alterações no site:<br />
            Ex: "Deixe o botão com fundo vermelho"
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            
            <div className="max-w-[80%] space-y-2">
              <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>
                {msg.text}
              </div>

              {msg.html && (
                <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <Code className="w-3.5 h-3.5" />
                    Código Completo Gerado
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onApplyChanges(msg.html!, msg.css || '', msg.js || '');
                      }}
                      className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aplicar Código
                    </button>
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 animate-spin">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 text-slate-400 p-3 rounded-2xl rounded-tl-none text-xs">
              IA está analisando o contexto e gerando alterações...
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-900 bg-slate-950 flex gap-2">
        <input
          type="text"
          placeholder="Pergunte ou peça alterações..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 text-white"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800/40 text-white rounded-xl transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
