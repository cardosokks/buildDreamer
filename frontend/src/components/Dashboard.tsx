import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FolderPlus, 
  Trash2, 
  ExternalLink, 
  Settings, 
  Copy, 
  Globe, 
  Calendar, 
  FileText, 
  LogOut,
  ChevronRight,
  Sparkles,
  Code
} from 'lucide-react';

import { SettingsModal } from './SettingsModal';
import { API_URL } from '../config';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  domain?: string;
  favicon?: string;
  createdAt: string;
  updatedAt: string;
  pages?: { id: string }[];
}

interface DashboardProps {
  onSelectProject: (projectId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectProject }) => {
  const { token, logout, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);

  // Create Project Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creationMode, setCreationMode] = useState<'scratch' | 'template' | 'ai'>('scratch');
  const [creating, setCreating] = useState(false);

  // AI Prompt generation States
  const [businessName, setBusinessName] = useState('');
  const [segment, setSegment] = useState('');
  const [visualStyle, setVisualStyle] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao buscar projetos');
      const data = await res.json();
      setProjects(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [token]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;
    setCreating(true);

    try {
      let finalName = newProjectName;
      let finalDesc = newProjectDesc;

      if (creationMode === 'ai') {
        finalName = businessName || newProjectName;
        finalDesc = `Segmento: ${segment}. Estilo: ${visualStyle}. ${newProjectDesc}`;
      }

      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: finalName, description: finalDesc })
      });

      if (!res.ok) throw new Error('Falha ao criar projeto');
      const newProject = await res.json();
      
      setProjects([newProject, ...projects]);
      setShowCreateModal(false);
      
      // Reset fields
      setNewProjectName('');
      setNewProjectDesc('');
      setBusinessName('');
      setSegment('');
      setVisualStyle('');

      // Open the visual builder
      onSelectProject(newProject.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Deseja realmente deletar este projeto? Esta ação é irreversível.')) return;

    try {
      const res = await fetch(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao deletar projeto');
      setProjects(projects.filter(p => p.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/25 rounded-lg text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-wider text-white">AI Builder</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">BETA</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white">{user?.name || 'Desenvolvedor'}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Body */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Seus Projetos</h1>
            <p className="text-slate-400 mt-1">Crie, gerencie e edite seus sites com o poder da IA.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-purple-600/20 cursor-pointer"
          >
            <FolderPlus className="w-5 h-5" />
            Novo Projeto
          </button>
        </div>

        {/* Dashboard Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 bg-red-950/20 border border-red-500/20 rounded-2xl text-center">
            <p className="text-red-400 font-semibold mb-2">Erro ao carregar projetos</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 border border-slate-900 rounded-3xl text-center px-6">
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400 mb-6 animate-bounce">
              <Sparkles className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhum projeto ainda</h3>
            <p className="text-slate-400 text-sm max-w-sm mb-8">
              Comece agora criando seu primeiro site utilizando nossa inteligência artificial ou a partir de um template.
            </p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors cursor-pointer"
            >
              Criar Projeto
            </button>
          </div>
        ) : (
          /* Project List Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 rounded-2xl p-6 transition-all group cursor-pointer flex flex-col justify-between min-h-[220px]"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-bold text-lg text-white group-hover:text-purple-400 transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs capitalize font-medium shrink-0">
                      {project.status === 'development' ? 'Em Desenvolvimento' : 'Publicado'}
                    </span>
                  </div>

                  <p className="text-slate-400 text-sm line-clamp-2 mb-6">
                    {project.description || 'Nenhuma descrição fornecida.'}
                  </p>
                </div>

                <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {project.pages?.length || 1} pág.
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="p-1.5 hover:text-red-400 rounded-lg hover:bg-slate-850 transition-all cursor-pointer"
                      title="Deletar projeto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FolderPlus className="text-purple-400 w-6 h-6" />
              Criar Novo Projeto
            </h2>

            {/* Mode selection */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 border border-slate-850 rounded-xl mb-6">
              <button 
                onClick={() => setCreationMode('scratch')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${creationMode === 'scratch' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Do Zero
              </button>
              <button 
                onClick={() => setCreationMode('template')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${creationMode === 'template' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Template
              </button>
              <button 
                onClick={() => setCreationMode('ai')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${creationMode === 'ai' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Gerar com IA
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              
              {/* Basic Fields */}
              {creationMode !== 'ai' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nome do Projeto</label>
                    <input 
                      type="text"
                      required
                      placeholder="Meu Portfólio, Hamburgueria Bella Napoli..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Descrição (Opcional)</label>
                    <textarea 
                      placeholder="Descreva brevemente o objetivo do site."
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white resize-none"
                    />
                  </div>
                </>
              ) : (
                /* AI Prompt Generation Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nome do Negócio</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Bella Napoli"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Segmento</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Restaurante Italiano, Advocacia, SaaS de Marketing"
                      value={segment}
                      onChange={(e) => setSegment(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Estilo Visual & Cores</label>
                    <input 
                      type="text"
                      placeholder="Ex: Moderno, Minimalista, Cores Escuras e Roxo"
                      value={visualStyle}
                      onChange={(e) => setVisualStyle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Instruções Extras</label>
                    <textarea 
                      placeholder="Que seções deseja incluir? (Ex: Hero, Depoimentos, Cardápio)"
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white resize-none"
                    />
                  </div>
                </div>
              )}

              {creationMode === 'template' && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-300">
                  ⚠️ Os templates padrão serão carregados como ponto de partida contendo a estrutura da homepage.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800/65">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-medium rounded-xl text-sm shadow-md transition-all cursor-pointer"
                >
                  {creating ? 'Criando...' : 'Confirmar e Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

    </div>
  );
};
