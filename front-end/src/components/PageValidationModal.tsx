import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Sparkles,
  Wand2,
  RefreshCw,
  Palette,
  Layout,
  Eye,
  Check,
  Save,
  ArrowRight
} from 'lucide-react';
import {
  validatePage,
  autoFixPageValidation,
  PageValidationResult,
  ValidationIssue,
  ProjectThemeConfig
} from '../utils/pageValidator';

interface PageValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageHtml: string;
  pageCss: string;
  pageName: string;
  projectTheme?: ProjectThemeConfig;
  onApplyFixes: (newHtml: string, newCss: string) => void;
  onConfirmSave: () => void;
  isSaveTriggered?: boolean;
}

export const PageValidationModal: React.FC<PageValidationModalProps> = ({
  isOpen,
  onClose,
  pageHtml,
  pageCss,
  pageName,
  projectTheme,
  onApplyFixes,
  onConfirmSave,
  isSaveTriggered = false
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'design' | 'color' | 'accessibility'>('all');
  const [validationResult, setValidationResult] = useState<PageValidationResult | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      runValidation();
      setFixSuccessMessage(null);
    }
  }, [isOpen, pageHtml, pageCss, projectTheme]);

  const runValidation = () => {
    const res = validatePage(pageHtml, pageCss, projectTheme);
    setValidationResult(res);
  };

  if (!isOpen) return null;

  const handleAutoFixAll = () => {
    setIsFixing(true);
    setTimeout(() => {
      const { fixedHtml, fixedCss, fixedCount } = autoFixPageValidation(pageHtml, pageCss, projectTheme);
      onApplyFixes(fixedHtml, fixedCss);
      setIsFixing(false);
      setFixSuccessMessage(`${fixedCount} item(ns) corrigido(s) automaticamente com sucesso!`);
      // Re-validate with new content
      const newRes = validatePage(fixedHtml, fixedCss, projectTheme);
      setValidationResult(newRes);
    }, 400);
  };

  const filteredIssues = validationResult?.issues.filter(issue => {
    if (activeTab === 'all') return true;
    return issue.category === activeTab;
  }) || [];

  const score = validationResult?.score ?? 100;
  const scoreColor = score >= 90 ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40'
    : score >= 65 ? 'text-amber-400 border-amber-500/40 bg-amber-950/40'
    : 'text-rose-400 border-rose-500/40 bg-rose-950/40';

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Validação de Diretrizes & Acessibilidade</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-purple-300 font-mono">
                  {pageName}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditoria em tempo real de design system, contraste de cores e conformidade WCAG 2.1 AA.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score Banner & Statistics */}
        <div className="p-6 bg-slate-950/50 border-b border-slate-800/80 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            
            {/* Main Score Indicator */}
            <div className={`p-4 rounded-xl border flex items-center gap-4 ${scoreColor}`}>
              <div className="relative w-14 h-14 flex items-center justify-center font-extrabold text-2xl font-mono shrink-0">
                <span>{score}</span>
                <span className="text-xs font-normal opacity-70">%</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                  Qualidade da Página
                </span>
                <span className="text-xs font-bold block mt-0.5">
                  {score >= 90 ? 'Aprovado para Publicação' : score >= 65 ? 'Atenção Requerida' : 'Crítico - Ajustar'}
                </span>
              </div>
            </div>

            {/* Critical Errors */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <XCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-lg font-bold text-white block leading-none font-mono">
                  {validationResult?.totalCritical || 0}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-1">
                  Erros Críticos
                </span>
              </div>
            </div>

            {/* Warnings */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-lg font-bold text-white block leading-none font-mono">
                  {validationResult?.totalWarnings || 0}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-1">
                  Avisos de Design
                </span>
              </div>
            </div>

            {/* Passed Rules */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-lg font-bold text-white block leading-none font-mono">
                  {validationResult?.totalPassed || 0}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-1">
                  Regras em Aprovado
                </span>
              </div>
            </div>

          </div>

          {/* Toast Notification of Auto-Fix Success */}
          {fixSuccessMessage && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{fixSuccessMessage}</span>
              </div>
              <button onClick={() => setFixSuccessMessage(null)} className="text-emerald-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Todas ({validationResult?.issues.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('design')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'design'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Design System</span>
            </button>
            <button
              onClick={() => setActiveTab('color')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'color'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Cores & Contraste</span>
            </button>
            <button
              onClick={() => setActiveTab('accessibility')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'accessibility'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Acessibilidade WCAG</span>
            </button>
          </div>

          {/* Quick Auto-Fix Button in Tab Bar */}
          {validationResult && validationResult.issues.some(i => i.autoFixable) && (
            <button
              onClick={handleAutoFixAll}
              disabled={isFixing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 hover:scale-105 transition-all cursor-pointer shrink-0"
            >
              <Wand2 className={`w-3.5 h-3.5 ${isFixing ? 'animate-spin' : ''}`} />
              <span>Corrigir Tudo Automático</span>
            </button>
          )}
        </div>

        {/* Issues List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
          {filteredIssues.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-slate-900/30 rounded-2xl border border-slate-800/50">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Nenhum problema encontrado nesta categoria!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Sua página cumpre rigorosamente as diretrizes de design, consistência de paleta e padrões WCAG 2.1 AA.
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className={`p-4 rounded-xl border transition-all ${
                  issue.severity === 'critical'
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60'
                    : issue.severity === 'warning'
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {issue.severity === 'critical' ? (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white">{issue.title}</h4>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          issue.severity === 'critical' ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : issue.severity === 'warning' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        }`}>
                          {issue.severity === 'critical' ? 'Crítico' : issue.severity === 'warning' ? 'Aviso' : 'Info'}
                        </span>
                        {issue.autoFixable && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                            Auto-Fix Disponível
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{issue.description}</p>
                      <div className="pt-1.5 flex items-center gap-1.5 text-[11px] text-purple-300 font-medium">
                        <span className="font-bold">Recomendação:</span>
                        <span className="text-slate-400">{issue.recommendation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Action Bar */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Voltar ao Editor
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {validationResult && validationResult.issues.some(i => i.autoFixable) && (
              <button
                onClick={handleAutoFixAll}
                disabled={isFixing}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Wand2 className="w-4 h-4 text-purple-400" />
                <span>Aplicar Correções Automáticas</span>
              </button>
            )}

            <button
              onClick={() => {
                onConfirmSave();
                onClose();
              }}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{isSaveTriggered ? 'Salvar Página Agora' : 'Confirmar e Salvar'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
