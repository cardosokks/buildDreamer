import React from 'react';
import { Sparkles, X, Terminal, Check, ArrowLeft } from 'lucide-react';

interface PromptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  businessName: string;
  segment: string;
  pagesCount: number;
  pagesNames: string;
  loading?: boolean;
}

export const PromptPreviewModal: React.FC<PromptPreviewModalProps> = ({
  isOpen,
  onClose,
  prompt,
  onPromptChange,
  onConfirm,
  onBack,
  businessName,
  segment,
  pagesCount,
  pagesNames,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-3xl bg-[#0f0b18] border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-purple-500/20 bg-gradient-to-r from-purple-950/50 via-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                PromptPreviewModal — Revisão do Prompt Estruturado
              </h2>
              <p className="text-xs text-purple-300/80 mt-0.5">
                Revise ou ajuste manualmente o prompt completo antes de enviar para a inteligência artificial.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Metadata Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Empresa / Negócio</span>
              <div className="text-xs font-bold text-white mt-0.5 truncate">{businessName || 'Não especificado'}</div>
            </div>
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Segmento</span>
              <div className="text-xs font-bold text-purple-300 mt-0.5 truncate">{segment || 'Geral'}</div>
            </div>
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Arquitetura</span>
              <div className="text-xs font-bold text-indigo-300 mt-0.5 truncate">{pagesCount} página(s): {pagesNames}</div>
            </div>
          </div>

          {/* Textarea for Prompt Inspection and Tweak */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                Prompt Final Estruturado (Editável)
              </label>
              <span className="text-[10px] text-slate-400">
                {prompt.length} caracteres
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              rows={12}
              className="w-full px-4 py-3.5 bg-slate-950 border border-purple-500/50 focus:border-purple-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs font-mono text-purple-100 leading-relaxed resize-y shadow-inner"
              placeholder="Digite ou ajuste o prompt estruturado aqui..."
            />
          </div>

          <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl flex items-start gap-2.5 text-[11px] text-purple-200">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <span>
              O modelo de IA utilizará rigorosamente as instruções acima para estruturar o layout, gerar o código HTML/Tailwind e as páginas solicitadas com alta fidelidade.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-purple-500/20 bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar e Ajustar Configurações
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !prompt.trim()}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Criando Projeto...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirmar e Gerar com IA
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
