import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Sparkles, 
  Wrench, 
  Check, 
  ExternalLink,
  Layers,
  FileCode,
  Globe,
  Loader2
} from 'lucide-react';
import { API_URL } from '../config';

export interface AuditIssue {
  id: string;
  pageId: string;
  pageName: string;
  type: 'placeholder' | 'theme_mismatch' | 'nav_inconsistency' | 'missing_content' | 'seo_missing' | 'broken_link';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  suggestedFix: string;
}

interface AIAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  token?: string;
  onPagesUpdated?: (updatedPages: any[]) => void;
}

export const AIAuditModal: React.FC<AIAuditModalProps> = ({
  isOpen,
  onClose,
  projectId,
  token,
  onPagesUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [status, setStatus] = useState<'perfect' | 'warnings' | 'critical'>('perfect');
  const [summary, setSummary] = useState('');
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [pagesChecked, setPagesChecked] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [fixSuccessMsg, setFixSuccessMsg] = useState<string | null>(null);

  const fetchAudit = async () => {
    if (!projectId) return;
    setLoading(true);
    setFixSuccessMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/ai/audit-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ projectId })
      });

      if (res.ok) {
        const data = await res.json();
        setHealthScore(data.healthScore ?? 100);
        setStatus(data.status || 'perfect');
        setSummary(data.summary || '');
        setIssues(data.issues || []);
        setPagesChecked(data.pagesChecked || 0);
      }
    } catch (err) {
      console.error('Erro ao auditar site:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && projectId) {
      fetchAudit();
    }
  }, [isOpen, projectId]);

  const handleAutoFix = async () => {
    if (!projectId) return;
    setFixing(true);
    setFixSuccessMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/ai/autofix-site`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ projectId })
      });

      if (res.ok) {
        const data = await res.json();
        setFixSuccessMsg('Todas as inconsistências foram corrigidas pela IA com sucesso!');
        if (data.updatedPages && onPagesUpdated) {
          onPagesUpdated(data.updatedPages);
        }
        // Re-auditar após a correção
        await fetchAudit();
      }
    } catch (err) {
      console.error('Erro na auto-correção:', err);
    } finally {
      setFixing(false);
    }
  };

  if (!isOpen) return null;

  const filteredIssues = issues.filter(issue => {
    if (activeTab === 'all') return true;
    return issue.severity === activeTab;
  });

  const getSeverityBadge = (severity: AuditIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">Crítico</span>;
      case 'warning':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">Alerta</span>;
      case 'info':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Sugestão</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Auditoria de Qualidade IA
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  Selo de Integridade
                </span>
              </h2>
              <p className="text-xs text-slate-400">Verificação autônoma de temas, placeholders, navbar e navegabilidade</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Principal Scrollável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {loading ? (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-300">Analisando todas as páginas do projeto com IA...</p>
              <p className="text-xs text-slate-500">Verificando consistência do tema, navbar, footer e integridade dos links</p>
            </div>
          ) : (
            <>
              {/* Placar de Saúde e Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Gauge Score */}
                <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Score de Qualidade</span>
                    <span className={`text-3xl font-black ${
                      (healthScore ?? 100) >= 90 ? 'text-emerald-400' : (healthScore ?? 100) >= 70 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {healthScore ?? 100}%
                    </span>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${
                    (healthScore ?? 100) >= 90 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}>
                    {(healthScore ?? 100) >= 90 ? 'A+' : (healthScore ?? 100) >= 70 ? 'B' : 'C'}
                  </div>
                </div>

                {/* Páginas Auditadas */}
                <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Páginas Mapeadas</span>
                    <span className="text-3xl font-black text-purple-400">{pagesChecked}</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                    <Globe className="w-6 h-6" />
                  </div>
                </div>

                {/* Status Geral */}
                <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Alertas Detectados</span>
                    <span className="text-3xl font-black text-amber-400">{issues.length}</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>

              </div>

              {/* Banner de Resultado de Sucesso de Correção */}
              {fixSuccessMsg && (
                <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-medium animate-fadeIn">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>{fixSuccessMsg}</span>
                </div>
              )}

              {/* Resumo da Auditoria */}
              <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diagnóstico da IA:</span>
                <p className="text-xs text-slate-300 leading-relaxed">{summary}</p>
              </div>

              {/* Filtros de Categorias */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'all'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({issues.length})
                </button>
                <button
                  onClick={() => setActiveTab('critical')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'critical'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-rose-300'
                  }`}
                >
                  Críticos ({issues.filter(i => i.severity === 'critical').length})
                </button>
                <button
                  onClick={() => setActiveTab('warning')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'warning'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-amber-300'
                  }`}
                >
                  Alertas ({issues.filter(i => i.severity === 'warning').length})
                </button>
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'info'
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'bg-slate-800/80 text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  Sugestões ({issues.filter(i => i.severity === 'info').length})
                </button>
              </div>

              {/* Lista de Alertas / Inconsistências */}
              <div className="space-y-3">
                {filteredIssues.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/40 border border-slate-800/60 rounded-2xl space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Nenhum problema nesta categoria!</h4>
                    <p className="text-xs text-slate-400">Todas as regras e consistências foram validadas e aprovadas.</p>
                  </div>
                ) : (
                  filteredIssues.map((issue) => (
                    <div 
                      key={issue.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 hover:border-purple-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(issue.severity)}
                          <span className="text-xs font-bold text-white">{issue.title}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                          Página: {issue.pageName}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-300 leading-relaxed">{issue.description}</p>
                      
                      <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl flex items-start gap-2">
                        <Wrench className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-slate-400">
                          <strong className="text-purple-300">Solução Recomendada:</strong> {issue.suggestedFix}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={fetchAudit}
            disabled={loading || fixing}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Re-auditar Site
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              onClick={handleAutoFix}
              disabled={fixing || loading || issues.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              {fixing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Corrigindo Páginas com IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>⚡ Corrigir Tudo com IA</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
