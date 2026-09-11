import React, { useState } from 'react';
import { Code2, Sparkles, Copy, Check, X, FileCode, Play, RotateCcw } from 'lucide-react';

interface CssSidebarProps {
  css: string;
  selectedSelector?: string | null;
  onCssChange: (newCss: string) => void;
  onClose: () => void;
}

export const CssSidebar: React.FC<CssSidebarProps> = ({
  css,
  selectedSelector,
  onCssChange,
  onClose
}) => {
  const [localCss, setLocalCss] = useState(css || '');
  const [copied, setCopied] = useState(false);

  // Auto-sync when parent CSS changes
  React.useEffect(() => {
    setLocalCss(css || '');
  }, [css]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalCss(val);
    onCssChange(val);
  };

  const handleInsertSnippet = (snippet: string) => {
    const updated = localCss ? `${localCss}\n\n${snippet}` : snippet;
    setLocalCss(updated);
    onCssChange(updated);
  };

  const handleInsertSelectedSelector = () => {
    if (!selectedSelector) return;
    const ruleSnippet = `\n/* Estilos para ${selectedSelector} */\n${selectedSelector} {\n  \n}\n`;
    const updated = `${localCss}${ruleSnippet}`;
    setLocalCss(updated);
    onCssChange(updated);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localCss);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-80 h-full bg-slate-950 border-r border-slate-900/80 flex flex-col shrink-0 text-slate-200 select-none overflow-hidden shadow-2xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-slate-900 bg-[var(--bg-app)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Editor de CSS da Página</h2>
            <p className="text-[10px] text-slate-400">Estilos Personalizados & Responsividade</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Copiar CSS"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selector Ativo Indicator */}
      {selectedSelector && (
        <div className="px-3 py-2 bg-indigo-950/40 border-b border-indigo-500/20 flex items-center justify-between text-xs">
          <span className="text-indigo-300 font-mono text-[11px] truncate max-w-[200px]">
            {selectedSelector}
          </span>
          <button
            onClick={handleInsertSelectedSelector}
            className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold transition-all cursor-pointer shrink-0"
          >
            + Criar Regra
          </button>
        </div>
      )}

      {/* Editor Textarea */}
      <div className="flex-1 p-3 flex flex-col min-h-0 bg-[#0d1117]">
        <textarea
          value={localCss}
          onChange={handleChange}
          placeholder="/* Digite seu CSS personalizado aqui... */&#10;body {&#10;  font-family: sans-serif;&#10;}"
          spellCheck={false}
          className="w-full h-full bg-transparent text-xs font-mono text-cyan-300 focus:outline-none resize-none leading-relaxed"
        />
      </div>

      {/* Snippets Rápidos */}
      <div className="p-3 border-t border-slate-900 bg-slate-950/90 space-y-2 shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Snippets Rápidos</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleInsertSnippet('@media (max-width: 768px) {\n  /* Estilos Mobile */\n}')}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            📱 Media Query Mobile
          </button>
          <button
            onClick={() => handleInsertSnippet('@keyframes fadeIn {\n  from { opacity: 0; transform: translateY(10px); }\n  to { opacity: 1; transform: translateY(0); }\n}')}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            ✨ Animação FadeIn
          </button>
          <button
            onClick={() => handleInsertSnippet('.glass-panel {\n  background: rgba(15, 23, 42, 0.75);\n  backdrop-filter: blur(12px);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n}')}
            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            🔮 Efeito Glassmorphism
          </button>
        </div>
      </div>
    </aside>
  );
};
