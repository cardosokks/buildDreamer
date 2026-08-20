import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FolderPlus, 
  Trash2, 
  Settings, 
  Calendar, 
  FileText, 
  LogOut,
  ChevronRight,
  Sparkles,
  Layout,
  Search,
  MapPin,
  Globe,
  Phone,
  Star,
  Users,
  ChevronUp,
  ChevronDown,
  Minimize2,
  Maximize2,
  Menu,
  X,
  GripVertical
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

interface Lead {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string | null;
  rating: string;
  needsWebsite: boolean;
}

interface DashboardProps {
  onSelectProject: (projectId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectProject }) => {
  const { token, logout, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab layout selection: 'general' | 'projects' | 'leads'
  const [activeTab, setActiveTab] = useState<'general' | 'projects' | 'leads'>('general');

  // Accessibility & UX Customization States
  const [navbarMinimized, setNavbarMinimized] = useState(false);
  const [navbarSize, setNavbarSize] = useState<'compact' | 'normal' | 'large'>('normal');
  const [sidebarWidth, setSidebarWidth] = useState(256); // 256px default (w-64)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // User Profile Dropdown state
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Leads state variables
  const [leadQuery, setLeadQuery] = useState('');
  const [leadLocation, setLeadLocation] = useState('');
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

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

  // Sidebar drag resizing listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = Math.max(180, Math.min(480, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  // Lead search method
  const handleSearchLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadQuery) return;
    setLoadingLeads(true);

    try {
      // Dynamic map iframe sync on text location searches (like Brasília)
      if (leadLocation) {
        const iframe = document.querySelector('iframe[title="Seletor de Região Leaflet"]') as HTMLIFrameElement;
        if (iframe) {
          iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(leadLocation)}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
        }
      }

      const res = await fetch(`${API_URL}/api/leads/search-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: leadQuery, location: leadLocation })
      });
      if (!res.ok) throw new Error('Erro ao buscar clientes');
      const data = await res.json();
      setLeadsList(data.leads || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Convert a lead directly to a project setup
  const handleCreateProjectFromLead = (lead: Lead) => {
    setCreationMode('ai');
    setBusinessName(lead.name);
    setSegment(leadQuery || 'Comércio Local');
    setVisualStyle('moderno e escuro neon com foco em conversão');
    setNewProjectDesc(`Site profissional focado em capturar clientes locais para ${lead.name}, endereço: ${lead.address}, telefone: ${lead.phone}.`);
    setShowCreateModal(true);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      let finalName = newProjectName;
      let finalDesc = newProjectDesc;

      if (creationMode === 'ai') {
        finalName = businessName;
        finalDesc = `Segmento: ${segment}. Estilo: ${visualStyle}. ${newProjectDesc}`;
      }

      // Get registered custom models from user settings
      let registeredModelIds: string[] = [];
      try {
        const stored = localStorage.getItem('custom_gemini_models');
        if (stored) registeredModelIds = JSON.parse(stored).map((m: any) => m.id);
      } catch {}

      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Gemini-Key': localStorage.getItem('gemini_api_key') || '',
          'X-Gemini-Models': JSON.stringify(registeredModelIds)
        },
        body: JSON.stringify({ 
          name: finalName, 
          description: finalDesc,
          isAIPrompt: creationMode === 'ai'
        })
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
    <div className="min-h-screen bg-[#07020d] text-slate-100 font-sans flex flex-col">
      {/* Top Navbar with Size and Minimized State Toggle */}
      <header className={`border-b border-slate-900 bg-[#0f0b18]/90 backdrop-blur-md sticky top-0 z-30 shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.4)] transition-all duration-300 ${
        navbarMinimized ? 'h-8 py-0' : navbarSize === 'compact' ? 'h-12 py-1' : navbarSize === 'large' ? 'h-20 py-3' : 'h-16 py-2'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          
          {/* Logo & Mobile Menu Trigger */}
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white md:hidden transition-all cursor-pointer"
              title="Menu Lateral"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <div className="p-1.5 bg-purple-900/30 border border-purple-500/40 rounded-lg text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            {!navbarMinimized && (
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-widest bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">REAL PREMISE</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded border border-purple-500/30 bg-purple-950/40 text-[9px] text-purple-300 font-mono tracking-widest shadow-[0_0_8px_rgba(168,85,247,0.15)]">PORTAL</span>
              </div>
            )}
          </div>

          {/* Accessibility & Density Controls */}
          <div className="flex items-center gap-2.5">
            {/* Density Selector */}
            {!navbarMinimized && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Barra:</span>
                <select
                  value={navbarSize}
                  onChange={(e) => setNavbarSize(e.target.value as any)}
                  className="bg-transparent border-none text-[10px] text-purple-300 font-mono focus:outline-none cursor-pointer"
                >
                  <option value="compact" className="bg-slate-900 text-white">Compacto</option>
                  <option value="normal" className="bg-slate-900 text-white">Normal</option>
                  <option value="large" className="bg-slate-900 text-white">Grande</option>
                </select>
              </div>
            )}

            {/* Minimize / Maximize Navbar Button */}
            <button
              onClick={() => setNavbarMinimized(!navbarMinimized)}
              className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm"
              title={navbarMinimized ? "Expandir Barra Superior" : "Minimizar Barra Superior"}
            >
              {navbarMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            {/* User Profile Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2.5 p-1 pl-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/25 transition-all cursor-pointer shadow-sm hover:border-purple-500/50"
              >
                {!navbarMinimized && (
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-white leading-tight">{user?.name || 'Desenvolvedor'}</p>
                    <p className="text-[9px] text-purple-400 font-mono">{user?.email}</p>
                  </div>
                )}
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-purple-500/20 border border-purple-400/30">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              </button>

              {/* Dropdown Menu Popup */}
              {showUserDropdown && (
                <div 
                  className="absolute right-0 mt-2 w-56 bg-[#0f0b18] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <div className="p-3 border-b border-slate-850 bg-purple-950/20">
                    <p className="text-xs font-semibold text-white truncate">{user?.name || 'Desenvolvedor'}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{user?.email}</p>
                  </div>

                  <div className="p-1.5 space-y-1">
                    <button
                      onClick={() => { setShowUserDropdown(false); setShowSettings(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 rounded-xl transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-purple-400" />
                      Configurações & Chaves
                    </button>

                    <button
                      onClick={() => { setShowUserDropdown(false); setActiveTab('leads'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 rounded-xl transition-all cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-pink-400" />
                      Buscador de Clientes
                    </button>
                  </div>

                  <div className="p-1.5 border-t border-slate-850">
                    <button
                      onClick={() => { setShowUserDropdown(false); logout(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sair da Conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Resizable Sidebar Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden flex" onClick={() => setMobileMenuOpen(false)}>
            <div 
              className="w-64 bg-[#0b0614] border-r border-slate-850 h-full p-4 flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-3 border-b border-slate-850 mb-3">
                  <span className="font-extrabold text-sm text-purple-400 tracking-wider">NAVEGAÇÃO</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => { setActiveTab('general'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'general' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Visão Geral
                </button>
                <button
                  onClick={() => { setActiveTab('projects'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'projects' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                  }`}
                >
                  <Layout className="w-4 h-4 text-indigo-400" />
                  Projetos / Sites
                </button>
                <button
                  onClick={() => { setActiveTab('leads'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'leads' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                  }`}
                >
                  <Users className="w-4 h-4 text-pink-400" />
                  Buscar Clientes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left Navigation Sidebar with Drag-to-Resize Handle */}
        <aside 
          style={{ width: `${sidebarWidth}px` }}
          className="border-r border-slate-900 bg-[#0b0614] flex flex-col justify-between shrink-0 p-4 hidden md:flex relative select-none"
        >
          <div className="space-y-1.5">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-purple-900/20 border border-purple-500/30 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="truncate">Visão Geral (Dashboard)</span>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'bg-purple-900/20 border border-purple-500/30 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
              }`}
            >
              <Layout className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Projetos / Sites</span>
            </button>
            <button
              onClick={() => setActiveTab('leads')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'leads'
                  ? 'bg-purple-900/20 border border-purple-500/30 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4 text-pink-400 shrink-0" />
              <span className="truncate">Buscar Clientes (Maps)</span>
            </button>
          </div>

          <div className="p-3 bg-slate-900/30 border border-slate-800/60 rounded-xl">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Servidor de Deploy</span>
            <span className="block text-xs text-purple-400 mt-1 font-mono truncate">Real Premise Live FTP</span>
          </div>

          {/* Draggable Resize Divider */}
          <div
            onMouseDown={() => setIsResizingSidebar(true)}
            className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-20 group flex items-center justify-center hover:bg-purple-500/20 transition-all"
            title="Arrastar para redimensionar barra lateral"
          >
            <div className="w-1 h-8 rounded-full bg-slate-700 group-hover:bg-purple-400 transition-colors" />
          </div>
        </aside>

        {/* Dynamic Content Panel */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          {activeTab === 'general' ? (
            <div className="max-w-6xl mx-auto space-y-8">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Painel Administrativo</h1>
                <p className="text-slate-400 mt-1">Monitore e configure seus recursos web com inteligência.</p>
              </div>

              {/* Status statistics grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all" />
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total de Projetos</span>
                  <p className="text-4xl font-extrabold text-white mt-3">{projects.length}</p>
                </div>
                <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl group-hover:bg-indigo-500/20 transition-all" />
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status do FTP</span>
                  <p className="text-lg font-bold text-emerald-400 mt-3 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]" />
                    Conectado
                  </p>
                </div>
                <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-xl group-hover:bg-pink-500/20 transition-all" />
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Buscar Clientes</span>
                  <button 
                    onClick={() => { setActiveTab('leads'); }}
                    className="mt-3 block w-full py-2 bg-purple-700/40 hover:bg-purple-700/60 border border-purple-500/30 text-xs font-semibold text-purple-300 rounded-xl transition-all cursor-pointer text-center animate-pulse"
                  >
                    Abrir Buscador
                  </button>
                </div>
              </div>

              {/* Quick info row */}
              <div className="p-6 bg-slate-900/30 border border-slate-800/80 rounded-2xl">
                <h3 className="font-bold text-white mb-2 text-sm">Bem-vindo ao Real Premise</h3>
                <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
                  Utilize o menu lateral para gerenciar os arquivos de seus sites. Cada alteração realizada no construtor visual é enviada instantaneamente em ambiente sandbox para os servidores de nuvem configurados, garantindo carregamento de ponta com usabilidade completa.
                </p>
              </div>
            </div>
          ) : activeTab === 'projects' ? (
            <div className="max-w-6xl mx-auto">
              {/* Welcome Section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight">Gerenciamento de Projetos</h1>
                  <p className="text-slate-400 mt-1">Crie, modifique e publique seus sites em ambiente de produção.</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-purple-700 hover:bg-purple-650 text-white font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] cursor-pointer"
                >
                  <FolderPlus className="w-5 h-5" />
                  Novo Projeto
                </button>
              </div>

              {/* Dashboard Grid */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              ) : (
                /* Project List Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div 
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className="bg-[#0f0b18] border border-slate-855 hover:border-purple-500/40 hover:bg-[#130d1e] rounded-2xl p-6 transition-all group cursor-pointer flex flex-col justify-between min-h-[220px] shadow-lg hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] animate-in fade-in duration-200"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <h3 className="font-bold text-lg text-white group-hover:text-purple-455 transition-colors line-clamp-1">
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
                          <ChevronRight className="w-5 h-5 text-slate-650 group-hover:translate-x-1 transition-transform group-hover:text-purple-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* BUSCAR CLIENTES (LEADS MAPS TAB) */
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                  <Users className="w-8 h-8 text-pink-400" />
                  Buscador de Clientes (Google Maps Leads)
                </h1>
                <p className="text-slate-450 mt-1">Busque estabelecimentos comerciais sem site ativo para oferecer serviços de Web Design de forma automatizada.</p>
              </div>

              {/* Interactive map visualization widget with OpenStreetMap and selection pointer */}
              <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-4 shadow-xl overflow-hidden">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Selecione uma Região no Mapa (Clique para Mudar a Localização)</span>
                <div className="relative h-64 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                  <iframe 
                    title="Seletor de Região Leaflet"
                    src="https://maps.google.com/maps?q=-23.5505,-46.6333&t=&z=12&ie=UTF8&iwloc=&output=embed"
                    className="w-full h-full border-0 filter invert opacity-80 contrast-125 pointer-events-auto"
                    allowFullScreen={true}
                    loading="lazy"
                  />
                  <div className="absolute bottom-3 left-3 right-3 bg-[#07020d]/90 border border-purple-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-xs">
                    <span className="text-xs text-slate-350">
                      💡 Região ativa para busca: <strong className="text-purple-400 font-semibold">{leadLocation || 'Perto de mim'}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      {[
                        { name: 'São Paulo', coords: '-23.5505,-46.6333' },
                        { name: 'Rio de Janeiro', coords: '-22.9068,-43.1729' },
                        { name: 'Belo Horizonte', coords: '-19.9173,-43.9345' },
                        { name: 'Curitiba', coords: '-25.4290,-49.2671' }
                      ].map(loc => (
                        <button
                          key={loc.name}
                          type="button"
                          onClick={() => {
                            setLeadLocation(loc.name);
                            // Dinamicamente atualiza o iframe do Maps com as coordenadas do local selecionado
                            const iframe = document.querySelector('iframe[title="Seletor de Região Leaflet"]') as HTMLIFrameElement;
                            if (iframe) {
                              iframe.src = `https://maps.google.com/maps?q=${loc.coords}&t=&z=12&ie=UTF8&iwloc=&output=embed`;
                            }
                          }}
                          className="px-2.5 py-1 bg-purple-900/30 border border-purple-500/25 hover:bg-purple-900/60 rounded-lg text-[10px] text-purple-300 font-medium transition-all cursor-pointer"
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSearchLeads} className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center gap-4">
                <div className="w-full md:flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                  <input 
                    type="text"
                    required
                    placeholder="O que está procurando? Ex: Pizzaria, Dentista, Advogado"
                    value={leadQuery}
                    onChange={(e) => setLeadQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
                  />
                </div>
                <div className="w-full md:w-80 relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Localização ou 'Perto de mim'"
                    value={leadLocation}
                    onChange={(e) => setLeadLocation(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingLeads}
                  className="w-full md:w-auto px-6 py-3 bg-purple-700 hover:bg-purple-650 text-white font-semibold rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] cursor-pointer"
                >
                  {loadingLeads ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {/* Leads results */}
              {loadingLeads ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 rounded-xl bg-[#0f0b18] border border-slate-850 animate-pulse" />
                  ))}
                </div>
              ) : leadsList.length === 0 ? (
                <div className="p-12 bg-slate-900/10 border border-slate-850 rounded-2xl text-center text-slate-500 text-sm italic">
                  Digite o segmento e clique em "Buscar" para listar potenciais clientes.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {leadsList.map(lead => (
                    <div 
                      key={lead.id}
                      className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-5 flex flex-col justify-between hover:border-purple-500/30 transition-all shadow-md"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-bold text-white text-base leading-tight">{lead.name}</h3>
                          <div className="flex items-center gap-1 shrink-0 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded text-[10px]">
                            <Star className="w-3 h-3 fill-yellow-400" />
                            {lead.rating}
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                          <span className="line-clamp-1">{lead.address}</span>
                        </p>

                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{lead.phone}</span>
                        </p>

                        <p className="text-xs flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          {lead.website ? (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline line-clamp-1">
                              {lead.website}
                            </a>
                          ) : (
                            <span className="text-red-400 font-semibold uppercase tracking-wider text-[10px] bg-red-950/30 border border-red-500/25 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.1)]">Sem Website (Oportunidade!)</span>
                          )}
                        </p>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-850/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Google Maps Lead</span>
                        <button
                          onClick={() => handleCreateProjectFromLead(lead)}
                          className="px-3.5 py-1.5 bg-purple-700/30 hover:bg-purple-700/60 border border-purple-500/40 text-xs font-bold text-purple-300 rounded-xl transition-all cursor-pointer"
                        >
                          Criar Site Para Cliente
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-[#0f0b18] border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <FolderPlus className="text-purple-400 w-6 h-6" />
              Criar Novo Site
            </h2>

            {/* Mode selection */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-955 border border-slate-850 rounded-xl mb-6">
              <button 
                type="button"
                onClick={() => setCreationMode('scratch')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${creationMode === 'scratch' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Do Zero
              </button>
              <button 
                type="button"
                onClick={() => setCreationMode('template')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${creationMode === 'template' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Template
              </button>
              <button 
                type="button"
                onClick={() => setCreationMode('ai')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${creationMode === 'ai' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                IA Gemini
              </button>
            </div>

            {/* Modal Form inputs conditionally */}
            <form onSubmit={handleCreateProject} className="space-y-4">
              {creationMode === 'ai' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Nome do Negócio</label>
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Segmento</label>
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Estilo Visual & Cores</label>
                    <input 
                      type="text"
                      placeholder="Ex: Moderno, Minimalista, Cores Escuras e Roxo"
                      value={visualStyle}
                      onChange={(e) => setVisualStyle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Instruções Extras</label>
                    <textarea 
                      placeholder="Que seções deseja incluir? (Ex: Hero, Depoimentos, Cardápio)"
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Nome do Projeto</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Meu Novo Site"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white placeholder-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Descrição (Opcional)</label>
                    <textarea 
                      placeholder="Descreva brevemente o objetivo do site."
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white resize-none placeholder-slate-700"
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
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors cursor-pointer font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-655 active:bg-purple-800 text-white font-semibold rounded-xl text-sm shadow-md transition-all cursor-pointer"
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
