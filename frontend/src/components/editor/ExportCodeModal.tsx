import React from 'react';
import { X, Check, Copy } from 'lucide-react';

interface CodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeExportTab: 'html' | 'css' | 'js';
  setActiveExportTab: (tab: 'html' | 'css' | 'js') => void;
  codeHtml: string;
  codeCss: string;
  codeJs: string;
  copiedCode: boolean;
  onCopyCode: () => void;
}

export const ExportCodeModal: React.FC<CodeModalProps> = ({
  isOpen,
  onClose,
  activeExportTab,
  setActiveExportTab,
  codeHtml,
  codeCss,
  codeJs,
  copiedCode,
  onCopyCode
}) => {
  if (!isOpen) return null;

  const currentCode =
    activeExportTab === 'html' ? codeHtml : activeExportTab === 'css' ? codeCss : codeJs;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-heading text-lg font-bold text-slate-100">
              Exportar Código Fonte do Site
            </h3>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveExportTab('html')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeExportTab === 'html'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                HTML
              </button>
              <button
                onClick={() => setActiveExportTab('css')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeExportTab === 'css'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CSS
              </button>
              <button
                onClick={() => setActiveExportTab('js')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  activeExportTab === 'js'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                JavaScript
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Content View */}
        <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950 leading-relaxed max-h-[65vh]">
          <pre className="whitespace-pre-wrap break-all">{currentCode}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
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
