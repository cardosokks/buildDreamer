import React from 'react';
import { X, Sparkles, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface AiLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logsData: {
    status?: string;
    currentModel?: string;
    logs?: string[];
    error?: string;
    progress?: number;
    total?: number;
  };
}

export const AiLogsModal: React.FC<AiLogsModalProps> = ({ isOpen, onClose, logsData }) => {
  if (!isOpen) return null;

  const logs = logsData.logs || [];
  const progressPercent = logsData.total
    ? Math.round(((logsData.progress || 0) / logsData.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-100">
                Log do Processamento por IA
              </h3>
              <p className="text-xs text-slate-400">
                Modelo ativo: <span className="font-mono text-blue-400">{logsData.currentModel || 'Gemini 2.0 Flash'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        {logsData.status === 'processing' && (
          <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex items-center gap-4">
            <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full transition-all duration-300"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-blue-400 font-bold">{progressPercent}%</span>
          </div>
        )}

        {/* Console Logs */}
        <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950 space-y-2 flex-1 max-h-[50vh]">
          {logs.length === 0 ? (
            <p className="text-slate-500 italic">Nenhum log registrado até o momento...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 border-b border-slate-900/60 pb-1.5">
                <span className="text-slate-500 text-[10px] select-none">[{index + 1}]</span>
                <span className="text-slate-300 leading-relaxed">{log}</span>
              </div>
            ))
          )}

          {logsData.error && (
            <div className="flex items-center gap-2 text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-900/50 font-sans mt-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{logsData.error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logsData.status === 'processing' ? (
              <span className="flex items-center gap-2 text-xs text-blue-400 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processando requisição...
              </span>
            ) : logsData.status === 'completed' ? (
              <span className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Processamento concluído com sucesso
              </span>
            ) : null}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
