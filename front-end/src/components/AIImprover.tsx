import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import {
  ArrowLeft,
  Sparkles,
  MessageSquare,
  Activity,
  Layout,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  X,
  PlusCircle,
  HelpCircle,
  Clock,
  Code2,
  Undo2,
  Trash2,
  ChevronRight,
  Eye,
  Sliders,
  Sparkle
} from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { API_URL, safeJson } from '../config';

interface Page {
  id: string;
  name: string;
  slug: string;
  html: string;
  css: string;
  js: string;
  seoTitle?: string;
  seoDescription?: string;
  isHomepage: boolean;
}

interface ProjectData {
  id: string;
  name: string;
  pages: Page[];
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'idle';
  currentModel?: string;
  attempt?: number;
  total?: number;
  error?: string;
  log?: string[];
}

interface AIImproverProps {
  projectId: string;
  onBack: () => void;
  onOpenEditor: () => void;
}

/**
 * Filtro e Sanitizador de Esqueletos de Design No-Code.
 * Garante que todo HTML gerado pela IA siga uma estrutura limpa de blocos sem tags corrompidas,
 * de modo que ao ser carregado no Editor Visual, as seções continuem editáveis, com seletores válidos.
 */
export function sanitizeAndStructureHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  let clean = rawHtml.trim();

  // Se a IA devolver uma página inteira envolta em html/body, extraímos apenas o conteúdo interno
  if (clean.includes('<body')) {
    const match = clean.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (match && match[1]) {
      clean = match[1];
    }
  }

  // Se houver múltiplos elementos raiz sem um contêiner pai unificado, envolvemos em uma div estrutural padrão
  // Isso previne problemas com seletores de árvore no canvas.
  const hasMultipleRoots = clean.startsWith('<header') || clean.startsWith('<section') || clean.split(/<\/section>/i).length > 2;
  if (hasMultipleRoots && !clean.startsWith('<div id="root-container"') && !clean.startsWith('<div id="page-wrapper"')) {
    clean = `<div id="page-wrapper" className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">${clean}</div>`;
  }

  // Remove scripts embutidos indesejados ou blocos maliciosos
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  return clean;
}

export const AIImprover: React.FC<AIImproverProps> = ({ projectId, onBack, onOpenEditor }) => {
  const { token } = useAuth();
  const { theme } = useTheme();
  const notify = useNotification();

  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const [project, setProject] = useState<ProjectData | null>(null);
  const [activePageId, setActivePageId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chat' | 'queue' | 'history'>('chat');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  // Job Queue Status
  const [job, setJob] = useState<JobStatus>({ id: '', status: 'idle' });
  const [queueLogs, setQueueLogs] = useState<string[]>([]);
  const [isPollingQueue, setIsPollingQueue] = useState(false);

  // Split View Compare Before vs After
  const [showSplitView, setShowSplitView] = useState(false);
  const [originalHtml, setOriginalHtml] = useState('');
  const [originalCss, setOriginalCss] = useState('');
  const [originalJs, setOriginalJs] = useState('');

  // History Log for IA changes on this page session
  const [history, setHistory] = useState<{ id: string; timestamp: string; description: string; html: string; css: string; js: string }[]>([]);

  // States for synchronizing section selection from the preview canvas
  const [editScope, setEditScope] = useState<'all' | 'section'>('all');
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [detectedSections, setDetectedSections] = useState<any[]>([]);

  // Listen to iframe interactive section click
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SECTION_CLICKED') {
        const index = event.data.index;
        setEditScope('section');
        setSelectedSectionIndex(index);
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  // Sync section index selection changes to iframe
  useEffect(() => {
    const iframe = previewIframeRef.current;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'SET_SELECTED_SECTION',
        index: editScope === 'section' ? selectedSectionIndex : null
      }, '*');
    }
  }, [selectedSectionIndex, editScope]);

  const syncIframeSelection = () => {
    const iframe = previewIframeRef.current;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'SET_SELECTED_SECTION',
        index: editScope === 'section' ? selectedSectionIndex : null
      }, '*');
    }
  };

  const activePage = project?.pages.find(p => p.id === activePageId);

  // Fetch project pages and detail logs
  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar projeto');
      const data = await res.json();
      setProject(data);
      if (data.pages && data.pages.length > 0 && !activePageId) {
        const home = data.pages.find((p: Page) => p.isHomepage) || data.pages[0];
        setActivePageId(home.id);
        setOriginalHtml(home.html);
        setOriginalCss(home.css);
        setOriginalJs(home.js);
      }
    } catch (err: any) {
      notify.error('Erro ao carregar detalhes do projeto.', 'Erro');
    }
  };

  // Check running job status for the project
  const checkJobStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/jobs/${projectId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      
      setJob({
        id: data.id || '',
        status: data.status || 'idle',
        currentModel: data.currentModel,
        attempt: data.attempt,
        total: data.total,
        error: data.error,
        log: data.log || []
      });

      if (data.log && data.log.length > 0) {
        setQueueLogs(data.log);
      }

      if (data.status === 'processing' || data.status === 'pending') {
        setIsPollingQueue(true);
      } else {
        if (isPollingQueue) {
          setIsPollingQueue(false);
          // Se o job acabou de ser concluído, recarrega o projeto
          if (data.status === 'completed') {
            notify.success('Otimização com IA concluída com sucesso!', 'Concluído');
            fetchProjectDetails();
          } else if (data.status === 'failed') {
            notify.error(`Falha no processamento da IA: ${data.error || 'Erro desconhecido'}`, 'Erro');
          }
        }
      }
    } catch (err) {
      console.error('[AIImprover] Erro ao buscar fila:', err);
    }
  }, [projectId, token, isPollingQueue]);

  // Polling intervals for the queue
  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  useEffect(() => {
    checkJobStatus();
    const interval = setInterval(checkJobStatus, isPollingQueue ? 2500 : 8000);
    return () => clearInterval(interval);
  }, [checkJobStatus, isPollingQueue]);

  // Cancel running queue job
  const handleCancelJob = async () => {
    if (!window.confirm('Tem certeza de que deseja cancelar a tarefa de IA atual?')) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        notify.success('Geração de IA cancelada com sucesso.', 'Cancelado');
        checkJobStatus();
      } else {
        notify.error('Não foi possível cancelar o job atual.');
      }
    } catch {
      notify.error('Erro ao conectar ao servidor para cancelar.');
    }
  };

  // Apply AI Generated changes to the active page
  const handleApplyAIChanges = async (components: any[], newCss: string, newJs: string, targetPageId?: string) => {
    const targetId = targetPageId || activePageId;
    if (!targetId) return;

    try {
      // Salva o histórico para possibilitar reverter ou comparar
      if (activePage) {
        setHistory(prev => [
          {
            id: `hist_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            description: 'Melhoria de layout via Chat de IA',
            html: activePage.html,
            css: activePage.css,
            js: activePage.js
          },
          ...prev
        ]);
      }

      const res = await fetch(`${API_URL}/api/pages/${targetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          components,
          css: newCss,
          js: newJs
        })
      });

      if (!res.ok) throw new Error('Falha ao atualizar página');
      
      notify.success('Melhorias aplicadas e salvas com sucesso no banco de dados!', 'IA');
      
      // Atualiza o estado local do projeto
      await fetchProjectDetails();
    } catch (err: any) {
      notify.error('Erro ao salvar as melhorias na página.', 'Erro');
    }
  };

  const handleRevertHistory = async (hItem: any) => {
    if (!activePageId) return;
    try {
      const res = await fetch(`${API_URL}/api/pages/${activePageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          html: hItem.html,
          css: hItem.css,
          js: hItem.js
        })
      });

      if (!res.ok) throw new Error('Erro ao reverter');
      notify.success('Histórico revertido com sucesso!', 'Reversão');
      fetchProjectDetails();
    } catch {
      notify.error('Erro ao reverter alteração.');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* Header */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            title="Voltar aos Projetos"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="font-bold text-sm tracking-wide text-white">{project?.name || 'Studio'}</span>
              <span className="text-xs text-slate-600">/</span>
              <span className="text-xs text-purple-300 font-medium bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-800/30">
                IA Optimizer & Chat
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Remasterize e melhore o design do seu site de forma segura e automatizada
            </p>
          </div>
        </div>

        {/* Viewport Selectors */}
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setViewport('desktop')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewport === 'desktop' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="Desktop Layout"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewport === 'tablet' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="Tablet Layout"
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewport === 'mobile' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            title="Mobile Layout"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Page Switcher + Actions */}
        <div className="flex items-center gap-2">
          {project?.pages && project.pages.length > 0 && (
            <select
              value={activePageId}
              onChange={(e) => {
                setActivePageId(e.target.value);
                const sel = project.pages.find(p => p.id === e.target.value);
                if (sel) {
                  setOriginalHtml(sel.html);
                  setOriginalCss(sel.css);
                  setOriginalJs(sel.js);
                }
              }}
              className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer transition-all"
            >
              {project.pages.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-950">
                  {p.name} {p.isHomepage ? '(Início)' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowSplitView(!showSplitView)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showSplitView
                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showSplitView ? 'Visualização Simples' : 'Comparar Antes/Depois'}</span>
          </button>

          <button
            onClick={onOpenEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-purple-600/20"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Abrir no Editor Visual</span>
          </button>
        </div>
      </header>

      {/* Main Container Split Layout */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Interactive Workspace Panel */}
        <div className="w-[450px] shrink-0 border-r border-slate-850 bg-slate-900 flex flex-col z-30 shadow-xl overflow-hidden">
          {/* Tab Menu Header */}
          <div className="flex border-b border-slate-800 bg-slate-950 p-1 gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-slate-900 text-purple-400 border border-slate-850 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Copilot Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-slate-900 text-purple-400 border border-slate-850 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Fila de Jobs</span>
              {(job.status === 'processing' || job.status === 'pending') && (
                <span className="absolute right-2 top-2.5 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-purple-400 border border-slate-850 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Histórico ({history.length})</span>
            </button>
          </div>

          {/* Tab content area */}
          <div className="flex-1 overflow-y-auto relative flex flex-col bg-slate-900">
            {activeTab === 'chat' && activePageId && (
              <div className="flex-1 flex flex-col h-full min-h-0">
                <ChatPanel
                  pageId={activePageId}
                  projectId={projectId}
                  pages={project?.pages.map(p => ({ id: p.id, name: p.name, slug: p.slug, isHomepage: p.isHomepage })) || []}
                  activePageHtml={activePage?.html || ''}
                  onApplyChanges={handleApplyAIChanges}
                  editScope={editScope}
                  setEditScope={setEditScope}
                  selectedSectionIndex={selectedSectionIndex}
                  setSelectedSectionIndex={setSelectedSectionIndex}
                  onSectionsDetected={setDetectedSections}
                />
              </div>
            )}

            {activeTab === 'queue' && (
              <div className="p-4 space-y-4 flex flex-col h-full overflow-y-auto">
                <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold tracking-wider text-slate-400 uppercase">Status do Processamento</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={checkJobStatus}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Atualizar Status"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isPollingQueue ? 'animate-spin text-purple-400' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${
                      job.status === 'processing'
                        ? 'bg-yellow-950/40 border-yellow-500/40 text-yellow-300'
                        : job.status === 'completed'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : job.status === 'failed'
                        ? 'bg-red-950/40 border-red-500/40 text-red-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}>
                      <Activity className={`w-5 h-5 ${job.status === 'processing' ? 'animate-pulse' : ''}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white uppercase">
                          {job.status === 'processing' ? 'Processando Seções' : job.status === 'pending' ? 'Na Fila de Espera' : job.status === 'completed' ? 'Concluído' : job.status === 'failed' ? 'Falhou' : 'Fila Ociosa'}
                        </span>
                        {job.status === 'processing' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {job.status === 'processing' && job.currentModel ? `Executando no modelo ${job.currentModel}` : 'Aguardando novas solicitações de melhoria'}
                      </p>
                    </div>
                  </div>

                  {job.status === 'processing' && job.attempt && job.total && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>Progresso do Refinamento</span>
                        <span>Etapa {job.attempt} de {job.total}</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 border border-slate-800/80 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                          style={{ width: `${(job.attempt / job.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {(job.status === 'processing' || job.status === 'pending') && (
                    <button
                      onClick={handleCancelJob}
                      className="w-full py-2 bg-red-950/40 hover:bg-red-900/40 border border-red-500/40 rounded-xl text-xs font-bold text-red-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancelar Execução</span>
                    </button>
                  )}
                </div>

                {/* Queue Activity Logs */}
                <div className="flex-1 flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-lg min-h-[250px]">
                  <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-extrabold tracking-wider text-slate-400 uppercase">Logs de Execução Detalhados</span>
                    <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">Tempo Real</span>
                  </div>
                  
                  <div className="flex-1 p-3 font-mono text-[10px] text-slate-300 space-y-1.5 overflow-y-auto select-text scrollbar-thin">
                    {queueLogs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 py-10">
                        <Clock className="w-6 h-6 opacity-30" />
                        <span>Nenhum log disponível na fila.</span>
                      </div>
                    ) : (
                      queueLogs.map((logStr, i) => (
                        <div key={i} className="leading-relaxed border-l-2 border-purple-500/30 pl-2 py-0.5 hover:bg-slate-900 rounded-r-lg transition-all">
                          <span className="text-purple-400 font-bold shrink-0 mr-1.5">[{new Date().toLocaleTimeString()}]</span>
                          <span>{logStr}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-4 space-y-3 flex flex-col h-full overflow-y-auto">
                <h3 className="text-xs font-extrabold tracking-wider text-slate-400 uppercase mb-1">Histórico de Alterações da Sessão</h3>
                
                {history.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-16 gap-2">
                    <RotateCcw className="w-8 h-8 opacity-30" />
                    <span className="text-xs text-center font-medium">Nenhuma alteração de IA registrada nesta sessão de edição.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item, idx) => (
                      <div key={item.id} className="bg-slate-950 rounded-xl border border-slate-850 p-3 space-y-2 shadow-sm flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-300">Alteração #{history.length - idx}</span>
                          <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>
                        
                        <button
                          onClick={() => handleRevertHistory(item)}
                          className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer border border-slate-850 flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3 h-3 text-purple-400" />
                          <span>Reverter para esta versão</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Iframe Visualizer Panel */}
        <div className="flex-1 flex flex-col bg-slate-950 p-6 overflow-hidden relative">
          <div className="flex-1 flex justify-center items-center overflow-hidden w-full h-full relative">
            
            {showSplitView ? (
              /* BEFORE VS AFTER SPLIT SCREEN VIEW */
              <div className="w-full h-full flex gap-4 min-w-0">
                {/* BEFORE PREVIEW CONTAINER */}
                <div className="flex-1 flex flex-col bg-slate-900 rounded-3xl border border-slate-850 overflow-hidden shadow-2xl relative min-w-0 h-full">
                  <div className="h-10 shrink-0 bg-slate-950 px-4 border-b border-slate-850 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Original (Antes das melhorias)</span>
                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                  </div>
                  <div className="flex-1 bg-white relative">
                    <iframe
                      key="before-frame"
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta charset="utf-8">
                            <script src="https://cdn.tailwindcss.com"></script>
                            <style>${originalCss}</style>
                          </head>
                          <body class="bg-transparent m-0 p-0">${originalHtml}</body>
                          <script>${originalJs}</script>
                        </html>
                      `}
                      className="w-full h-full border-none"
                      title="Antes da IA"
                    />
                  </div>
                </div>

                {/* AFTER PREVIEW CONTAINER */}
                <div className="flex-1 flex flex-col bg-slate-900 rounded-3xl border border-slate-850 overflow-hidden shadow-2xl relative min-w-0 h-full">
                  <div className="h-10 shrink-0 bg-slate-950 px-4 border-b border-slate-850 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold tracking-wider text-purple-400 uppercase flex items-center gap-1">
                      <Sparkle className="w-3 h-3 text-purple-400 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                      Nova Versão (Depois das melhorias)
                    </span>
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                  </div>
                  <div className="flex-1 bg-white relative">
                    <iframe
                      key={`after-frame-${activePage?.html.length}`}
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta charset="utf-8">
                            <script src="https://cdn.tailwindcss.com"></script>
                            <style>${activePage?.css || ''}</style>
                          </head>
                          <body class="bg-transparent m-0 p-0">${activePage?.html || ''}</body>
                          <script>${activePage?.js || ''}</script>
                        </html>
                      `}
                      className="w-full h-full border-none"
                      title="Depois da IA"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* SINGLE VIEW SCREEN WITH RESPONSE CONTROLLER */
              <div
                className="bg-slate-900 rounded-3xl border border-slate-850 overflow-hidden shadow-2xl relative flex flex-col transition-all duration-300 max-h-full"
                style={{
                  width: viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%',
                  height: '100%'
                }}
              >
                <div className="h-10 shrink-0 bg-slate-950 px-4 border-b border-slate-850 flex items-center justify-between select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-xs text-slate-400 font-mono font-bold">
                    {viewport === 'mobile' ? '375px (Mobile)' : viewport === 'tablet' ? '768px (Tablet)' : 'Desktop (Responsivo)'}
                  </span>
                  <div className="w-4" />
                </div>

                <div className="flex-1 bg-white relative">
                  {activePage ? (
                    <iframe
                      key={`preview-frame-${viewport}-${activePage.html.length}`}
                      srcDoc={`
                        <!DOCTYPE html>
                        <html>
                          <head>
                            <meta charset="utf-8">
                            <script src="https://cdn.tailwindcss.com"></script>
                            <style>
                              html, body {
                                margin: 0;
                                padding: 0;
                                overflow-x: hidden;
                              }
                              ${activePage.css || ''}
                            </style>
                          </head>
                          <body class="bg-transparent">${activePage.html}</body>
                          <script>${activePage.js || ''}</script>
                        </html>
                      `}
                      className="w-full h-full border-none"
                      title="Preview da Página"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-2">
                      <Layout className="w-8 h-8 opacity-30 animate-pulse" />
                      <span>Selecione uma página para visualizar o preview...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
