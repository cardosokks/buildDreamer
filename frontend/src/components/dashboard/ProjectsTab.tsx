import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  Search,
  SortDesc,
  LayoutGrid,
  List,
  Sparkles,
  FileText,
  Clock,
  UserCheck,
  Edit2,
  Trash2,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pages?: { id: string }[];
  crmLead?: { id: string; name: string; company?: string; status?: string; phone?: string; email?: string } | null;
}

interface ProjectsTabProps {
  token: string;
  theme: 'light' | 'dark';
  projects: Project[];
  loading: boolean;
  error: string | null;
  generatingProjectJobs: Record<string, { currentModel?: string; attempt?: number; total?: number }>;
  onSelectProject: (projectId: string) => void;
  openProjectDetailsModal: (project: Project) => void;
  handleDeleteProject: (projectId: string, e: React.MouseEvent) => void;
  setActiveTab: (tab: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings') => void;
  setShowCreateModal: (show: boolean) => void;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  token,
  theme,
  projects,
  loading,
  error,
  generatingProjectJobs,
  onSelectProject,
  openProjectDetailsModal,
  handleDeleteProject,
  setActiveTab,
  setShowCreateModal
}) => {
  const [projectsSearch, setProjectsSearch] = useState('');
  const [projectsSort, setProjectsSort] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
  const [projectsViewMode, setProjectsViewMode] = useState<'grid' | 'list'>('grid');

  // Filter & Sort Projects
  const filteredProjects = projects
    .filter(p => p.name.toLowerCase().includes(projectsSearch.toLowerCase()) || (p.description && p.description.toLowerCase().includes(projectsSearch.toLowerCase())))
    .sort((a, b) => {
      if (projectsSort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (projectsSort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (projectsSort === 'name_asc') return a.name.localeCompare(b.name);
      if (projectsSort === 'name_desc') return b.name.localeCompare(a.name);
      return 0;
    });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header de Projetos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Meus Sites & Projetos</h2>
          <p className="text-xs text-slate-400">{projects.length} projeto{projects.length !== 1 ? 's' : ''} · Gerencie, edite ou crie novos sites com IA.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-650 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer self-start sm:self-auto"
        >
          <FolderPlus className="w-4 h-4" />
          Novo Projeto
        </button>
      </div>

      {/* Toolbar: Busca, Ordenação e Modo de Visualização */}
      {projects.length > 0 && (
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-800'
          }`}>
          {/* Campo de busca */}
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar projeto..."
              value={projectsSearch}
              onChange={e => setProjectsSearch(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-purple-500 transition-colors ${theme === 'light' ? 'bg-slate-55 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                }`}
            />
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1.5">
            <SortDesc className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={projectsSort}
              onChange={e => setProjectsSort(e.target.value as any)}
              className={`text-xs rounded-xl border px-2.5 py-2 focus:outline-none cursor-pointer ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'
                }`}
            >
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="name_asc">A → Z</option>
              <option value="name_desc">Z → A</option>
            </select>
          </div>

          {/* Modo de visualização */}
          <div className={`flex items-center rounded-xl border p-0.5 ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}>
            <button
              onClick={() => setProjectsViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${projectsViewMode === 'grid' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              title="Vista em Grade"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setProjectsViewMode('list')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${projectsViewMode === 'list' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              title="Vista em Lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-[#0f0b18] border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 bg-red-950/20 border border-red-500/20 rounded-2xl text-center">
          <p className="text-red-400 font-semibold mb-2">Erro ao carregar projetos</p>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 bg-[#0f0b18]/60 border border-slate-900 rounded-3xl text-center px-6">
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400 mb-6 animate-bounce">
            <Sparkles className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Nenhum projeto ainda</h3>
          <p className="text-slate-400 text-sm max-w-sm mb-8">
            Comece agora criando seu primeiro site utilizando nossa inteligência artificial ou a partir de um template.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-purple-700 hover:bg-purple-650 text-white font-semibold rounded-xl transition-all cursor-pointer"
          >
            Criar Projeto
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-10 bg-[#0f0b18] border border-slate-800 rounded-2xl text-center">
          <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nenhum projeto encontrado para <strong className="text-white">&ldquo;{projectsSearch}&rdquo;</strong>.</p>
          <button onClick={() => setProjectsSearch('')} className="mt-3 text-xs text-purple-400 hover:underline">Limpar busca</button>
        </div>
      ) : projectsViewMode === 'grid' ? (
        /* Project Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const isGenerating = !!generatingProjectJobs[project.id];
            const jobInfo = generatingProjectJobs[project.id];

            return (
              <div
                key={project.id}
                onClick={() => {
                  if (isGenerating) return;
                  onSelectProject(project.id);
                }}
                className={`border rounded-2xl p-5 transition-all group flex flex-col justify-between min-h-[200px] shadow-lg relative ${isGenerating
                  ? 'bg-[#0f0b18] border-amber-500/50 shadow-[0_0_25px_rgba(229,185,95,0.15)] cursor-not-allowed overflow-hidden'
                  : theme === 'light'
                    ? 'bg-white border-slate-200 hover:border-purple-400/60 cursor-pointer hover:shadow-purple-100'
                    : 'bg-[#0f0b18] border-slate-800/80 hover:border-purple-500/40 hover:bg-[#130d1e] cursor-pointer hover:shadow-[0_0_20px_rgba(168,85,247,0.08)]'
                  }`}
              >
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center rounded-2xl">
                    <div className="w-10 h-10 rounded-full border-2 border-amber-500/50 p-1 mb-2 animate-spin flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    </div>
                    <span className="text-xs font-bold text-amber-300 tracking-wide">Construindo com IA...</span>
                    <span className="text-[10px] text-slate-300 font-mono mt-1 animate-pulse">
                      {jobInfo?.currentModel ? `${jobInfo.currentModel} (${jobInfo.attempt}/${jobInfo.total})` : 'Estruturando HTML, CSS e Seções'}
                    </span>
                  </div>
                )}

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className={`font-bold text-base line-clamp-1 group-hover:text-purple-300 transition-colors ${theme === 'light' ? 'text-slate-900' : 'text-white'
                      }`}>{project.name}</h3>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] capitalize font-bold shrink-0 border ${isGenerating
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                      : project.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : theme === 'light' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800/60 text-slate-400 border-slate-700/60'
                      }`}>
                      {isGenerating ? 'Gerando...' : project.status === 'development' ? 'Dev' : 'Live'}
                    </span>
                  </div>

                  {/* CRM Client Badge */}
                  {project.crmLead && (
                    <div
                      onClick={(e) => { e.stopPropagation(); setActiveTab('crm'); }}
                      className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-500/50 rounded-lg cursor-pointer transition-all group/crm"
                      title="Clique para ver este cliente no CRM de Vendas"
                    >
                      <UserCheck className="w-3 h-3 text-emerald-400 shrink-0 group-hover/crm:scale-110 transition-transform" />
                      <span className="text-[10px] font-semibold text-emerald-300 truncate group-hover/crm:underline">{project.crmLead.company || project.crmLead.name}</span>
                      {project.crmLead.status && (
                        <span className="ml-auto text-[9px] text-emerald-500 font-mono shrink-0">{project.crmLead.status}</span>
                      )}
                    </div>
                  )}

                  <p className={`text-xs line-clamp-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                    {project.description || 'Sem descrição.'}
                  </p>
                </div>

                <div className={`border-t pt-3 mt-3 flex items-center justify-between text-xs ${theme === 'light' ? 'border-slate-100 text-slate-500' : 'border-slate-800/60 text-slate-500'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {project.pages?.length || 1}
                    </span>
                    <span className="flex items-center gap-1" title={`Criado em: ${new Date(project.createdAt).toLocaleString('pt-BR')}`}>
                      <Clock className="w-3 h-3" />
                      {new Date(project.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveTab('crm'); }}
                      className="p-1.5 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-emerald-950/40 transition-all cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openProjectDetailsModal(project); }}
                      className="p-1.5 text-slate-500 hover:text-purple-300 rounded-lg hover:bg-purple-950/40 transition-all cursor-pointer"
                      title="Editar detalhes"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id, e); }}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-all cursor-pointer"
                      title="Excluir projeto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-0.5 transition-transform group-hover:text-purple-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Project List View */
        <div className={`border rounded-2xl overflow-hidden ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-800'
          }`}>
          {/* Table Header */}
          <div className={`grid grid-cols-[2fr_1fr_auto_auto] gap-4 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-500 bg-slate-50 border-b border-slate-200' : 'text-slate-500 bg-slate-900/40 border-b border-slate-800'
            }`}>
            <span>Projeto</span>
            <span>Criado em</span>
            <span>Páginas</span>
            <span className="text-right">Ações</span>
          </div>

          {/* Table Rows */}
          {filteredProjects.map((project, idx) => {
            const isGenerating = !!generatingProjectJobs[project.id];
            return (
              <div
                key={project.id}
                onClick={() => {
                  if (isGenerating) return;
                  onSelectProject(project.id);
                }}
                className={`grid grid-cols-[2fr_1fr_auto_auto] gap-4 px-5 py-3.5 items-center transition-all cursor-pointer group ${idx !== filteredProjects.length - 1
                  ? theme === 'light' ? 'border-b border-slate-100' : 'border-b border-slate-800/50'
                  : ''
                  } ${theme === 'light' ? 'hover:bg-purple-50/60' : 'hover:bg-purple-950/10'
                  }`}
              >
                {/* Nome e info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm truncate group-hover:text-purple-400 transition-colors ${theme === 'light' ? 'text-slate-900' : 'text-white'
                      }`}>{project.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${isGenerating
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                      : project.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : theme === 'light' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                      {isGenerating ? '⚡ IA...' : project.status === 'development' ? 'Dev' : 'Live'}
                    </span>
                    {project.crmLead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveTab('crm'); }}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-500/50 rounded text-[9px] text-emerald-400 font-semibold shrink-0 cursor-pointer hover:underline"
                      >
                        <UserCheck className="w-2.5 h-2.5" />
                        {project.crmLead.company || project.crmLead.name}
                      </button>
                    )}
                  </div>
                  {project.description && (
                    <p className={`text-[11px] mt-0.5 truncate ${theme === 'light' ? 'text-slate-500' : 'text-slate-550'
                      }`}>{project.description}</p>
                  )}
                </div>

                {/* Data de criação */}
                <div className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
                  <div className="font-mono">{new Date(project.createdAt).toLocaleDateString('pt-BR')}</div>
                  <div className="text-[10px] opacity-70">{new Date(project.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>

                {/* Páginas */}
                <div className={`text-xs font-mono text-center ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  {project.pages?.length || 1}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 justify-end shrink-0 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveTab('crm'); }}
                    className="p-1.5 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-emerald-950/40 transition-all cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openProjectDetailsModal(project); }}
                    className="p-1.5 text-slate-500 hover:text-purple-300 rounded-lg hover:bg-purple-950/40 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id, e); }}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
