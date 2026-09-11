import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, ShieldCheck, RefreshCw, ExternalLink } from 'lucide-react';

interface SEOAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageHtml: string;
  pageName: string;
  seoTitle?: string;
  seoDescription?: string;
  seoOgImage?: string;
}

interface AuditIssue {
  id: string;
  type: 'error' | 'warning' | 'success';
  category: 'seo' | 'accessibility' | 'best-practices';
  title: string;
  description: string;
  recommendation: string;
}

export const SEOAuditModal: React.FC<SEOAuditModalProps> = ({
  isOpen,
  onClose,
  pageHtml,
  pageName,
  seoTitle,
  seoDescription,
  seoOgImage
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'seo' | 'accessibility' | 'best-practices'>('all');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);

  const runAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const results: AuditIssue[] = [];
      const parser = new DOMParser();
      const doc = parser.parseFromString(pageHtml || '', 'text/html');

      // 1. SEO Checks
      if (!seoTitle || seoTitle.trim() === '') {
        results.push({
          id: 'seo-title-missing',
          type: 'error',
          category: 'seo',
          title: 'Título SEO Ausente',
          description: 'A página não possui um Título SEO configurado nas propriedades da página.',
          recommendation: 'Adicione um título atraente de 30 a 60 caracteres nas configurações da página.'
        });
      } else if (seoTitle.length < 20 || seoTitle.length > 70) {
        results.push({
          id: 'seo-title-length',
          type: 'warning',
          category: 'seo',
          title: 'Comprimento do Título SEO Sub-ótimo',
          description: `O título atual tem ${seoTitle.length} caracteres. O ideal é entre 30 e 60 caracteres.`,
          recommendation: 'Ajuste o título para garantir melhor legibilidade nos mecanismos de busca.'
        });
      } else {
        results.push({
          id: 'seo-title-ok',
          type: 'success',
          category: 'seo',
          title: 'Título SEO Otimizado',
          description: 'O título da página está dentro do comprimento ideal.',
          recommendation: 'Nenhuma ação necessária.'
        });
      }

      if (!seoDescription || seoDescription.trim() === '') {
        results.push({
          id: 'seo-desc-missing',
          type: 'error',
          category: 'seo',
          title: 'Meta Descrição Ausente',
          description: 'Falta uma descrição meta para resumir o conteúdo desta página nos motores de busca.',
          recommendation: 'Adicione uma descrição de 120 a 160 caracteres.'
        });
      } else if (seoDescription.length < 80 || seoDescription.length > 170) {
        results.push({
          id: 'seo-desc-length',
          type: 'warning',
          category: 'seo',
          title: 'Tamanho da Meta Descrição',
          description: `A descrição possui ${seoDescription.length} caracteres (ideal: 120-160).`,
          recommendation: 'Refine o texto para caber no snippet padrão do Google.'
        });
      } else {
        results.push({
          id: 'seo-desc-ok',
          type: 'success',
          category: 'seo',
          title: 'Meta Descrição Adequada',
          description: 'A descrição da página está bem dimensionada.',
          recommendation: 'Nenhuma ação necessária.'
        });
      }

      if (!seoOgImage) {
        results.push({
          id: 'seo-og-missing',
          type: 'warning',
          category: 'seo',
          title: 'Imagem Open Graph (OG:Image) Ausente',
          description: 'Links compartilhados no WhatsApp, Facebook ou LinkedIn não exibirão uma imagem de prévia.',
          recommendation: 'Defina uma imagem de capa nas configurações da página para aumentar cliques.'
        });
      } else {
        results.push({
          id: 'seo-og-ok',
          type: 'success',
          category: 'seo',
          title: 'Imagem de Compartilhamento Configurada',
          description: 'A imagem Open Graph está definida para redes sociais.',
          recommendation: 'Nenhuma ação necessária.'
        });
      }

      // 2. Accessibility Checks (WCAG 2.1 AA)
      const images = Array.from(doc.querySelectorAll('img'));
      const imgsWithoutAlt = images.filter(img => !img.getAttribute('alt') || img.getAttribute('alt')?.trim() === '');
      if (imgsWithoutAlt.length > 0) {
        results.push({
          id: 'a11y-img-alt',
          type: 'error',
          category: 'accessibility',
          title: `${imgsWithoutAlt.length} Imagens Sem Atributo Alt`,
          description: 'Leitores de tela não conseguirão descrever estas imagens para deficientes visuais.',
          recommendation: 'Selecione cada imagem e adicione um texto alternativo descritivo no painel de propriedades.'
        });
      } else if (images.length > 0) {
        results.push({
          id: 'a11y-img-ok',
          type: 'success',
          category: 'accessibility',
          title: 'Todas as Imagens Possuem Alt Text',
          description: 'Excelente conformidade com acessibilidade visual em imagens.',
          recommendation: 'Nenhuma ação necessária.'
        });
      }

      const h1s = Array.from(doc.querySelectorAll('h1'));
      if (h1s.length === 0) {
        results.push({
          id: 'a11y-h1-missing',
          type: 'error',
          category: 'accessibility',
          title: 'Nenhum Cabeçalho H1 Encontrado',
          description: 'A página não possui tag H1 principal, prejudicando a hierarquia de leitura e SEO.',
          recommendation: 'Adicione pelo menos um título H1 no topo da página.'
        });
      } else if (h1s.length > 1) {
        results.push({
          id: 'a11y-h1-multiple',
          type: 'warning',
          category: 'accessibility',
          title: `${h1s.length} Tags H1 Encontradas`,
          description: 'É recomendado ter apenas um único H1 por página para estabelecer o tema principal.',
          recommendation: 'Mantenha apenas o título principal como H1 e mude os demais para H2.'
        });
      } else {
        results.push({
          id: 'a11y-h1-ok',
          type: 'success',
          category: 'accessibility',
          title: 'Hierarquia de H1 Correta',
          description: 'Existe exatamente um H1 estruturando a página.',
          recommendation: 'Nenhuma ação necessária.'
        });
      }

      // 3. Best Practices
      const links = Array.from(doc.querySelectorAll('a'));
      const emptyLinks = links.filter(l => !l.textContent?.trim() && !l.querySelector('img') && !l.getAttribute('aria-label'));
      if (emptyLinks.length > 0) {
        results.push({
          id: 'bp-empty-links',
          type: 'warning',
          category: 'best-practices',
          title: `${emptyLinks.length} Links Sem Texto ou Rótulo`,
          description: 'Existem links sem texto visível ou aria-label, o que confunde leitores de tela.',
          recommendation: 'Adicione texto descritivo ou aria-label aos links.'
        });
      } else {
        results.push({
          id: 'bp-links-ok',
          type: 'success',
          category: 'best-practices',
          title: 'Links Validados',
          description: 'Todos os links possuem conteúdo acessível.',
          recommendation: 'Nenhuma ação necessária.'
        });
      }

      // Calculate pseudo score
      const errors = results.filter(r => r.type === 'error').length;
      const warnings = results.filter(r => r.type === 'warning').length;
      const calculatedScore = Math.max(20, 100 - (errors * 20) - (warnings * 10));
      
      setAuditScore(calculatedScore);
      setIssues(results);
      setIsAuditing(false);
    }, 600);
  };

  React.useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen, pageHtml, seoTitle, seoDescription, seoOgImage]);

  if (!isOpen) return null;

  const filteredIssues = issues.filter(i => {
    if (activeTab === 'all') return true;
    return i.category === activeTab;
  });

  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;
  const successCount = issues.filter(i => i.type === 'success').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Auditoria SEO & Acessibilidade</h2>
              <p className="text-xs text-slate-400">Análise de conformidade Lighthouse Core para "{pageName}"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score Banner */}
        <div className="p-6 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" className="text-slate-800 fill-none" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="6"
                  className={`fill-none transition-all duration-1000 ${
                    (auditScore || 0) >= 80 ? 'text-emerald-500' : (auditScore || 0) >= 50 ? 'text-amber-500' : 'text-rose-500'
                  }`}
                  strokeDasharray={213}
                  strokeDashoffset={213 - (213 * (auditScore || 0)) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-white">{isAuditing ? '...' : auditScore}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pontuação</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {(auditScore || 0) >= 80 ? 'Excelente Otimização!' : (auditScore || 0) >= 50 ? 'Otimização Moderada' : 'Atenção Necessária'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Foram identificados <span className="text-rose-400 font-semibold">{errorCount} erros</span> e <span className="text-amber-400 font-semibold">{warningCount} avisos</span> que impactam o ranqueamento no Google e a acessibilidade.
              </p>
            </div>
          </div>

          <button
            onClick={runAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            Reanalisar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({issues.length})
          </button>
          <button
            onClick={() => setActiveTab('seo')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'seo'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            SEO ({issues.filter(i => i.category === 'seo').length})
          </button>
          <button
            onClick={() => setActiveTab('accessibility')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'accessibility'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Acessibilidade WCAG ({issues.filter(i => i.category === 'accessibility').length})
          </button>
          <button
            onClick={() => setActiveTab('best-practices')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'best-practices'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Boas Práticas ({issues.filter(i => i.category === 'best-practices').length})
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-950/30">
          {isAuditing ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-sm">Executando auditoria Lighthouse Core na página...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-medium text-white">Nenhum problema encontrado nesta categoria!</p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isError = issue.type === 'error';
              const isWarning = issue.type === 'warning';
              const isSuccess = issue.type === 'success';

              return (
                <div
                  key={issue.id}
                  className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${
                    isError
                      ? 'bg-rose-950/10 border-rose-900/40 text-rose-200'
                      : isWarning
                      ? 'bg-amber-950/10 border-amber-900/40 text-amber-200'
                      : 'bg-emerald-950/10 border-emerald-900/40 text-emerald-200'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isError && <XCircle className="w-5 h-5 text-rose-400" />}
                    {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                    {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-white">{issue.title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                        issue.category === 'seo' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        issue.category === 'accessibility' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {issue.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-2 leading-relaxed">{issue.description}</p>
                    <div className="text-[11px] bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-slate-400">
                      <strong className="text-slate-300 font-medium">Recomendação:</strong> {issue.recommendation}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <span className="text-xs text-slate-400">
            Auditado em tempo real com base no DOM atual.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Fechar Auditoria
          </button>
        </div>

      </div>
    </div>
  );
};
