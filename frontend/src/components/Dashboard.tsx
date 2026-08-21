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
  GripVertical,
  Bookmark,
  BookmarkCheck,
  Sliders,
  Plus,
  SlidersHorizontal,
  ExternalLink,
  MessageSquare,
  Edit2,
  Check,
  Sun,
  Moon,
  Radio,
  Square,
  Play
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';
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
  category?: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  phone: string;
  whatsappUrl?: string | null;
  email?: string | null;
  website: string | null;
  hasWebsite?: boolean;
  source?: string;
  rating: string;
  needsWebsite?: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  niche: string;
  city: string;
  state: string;
  country: string;
  onlyWithoutWebsite: boolean;
  hasPhoneOnly: boolean;
  minRating: number;
}

interface NgrokTunnel {
  projectId: string;
  projectName: string;
  url: string;
  startedAt: string;
}

interface DashboardProps {
  initialTab?: 'general' | 'projects' | 'leads' | 'saved-leads' | 'presets' | 'tunnels';
  onTabChange?: (tab: 'general' | 'projects' | 'leads' | 'saved-leads' | 'presets' | 'tunnels') => void;
  onSelectProject: (projectId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialTab = 'general', onTabChange, onSelectProject }) => {
  const { token, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTabState] = useState<'general' | 'projects' | 'leads' | 'saved-leads' | 'presets' | 'tunnels'>(() => {
    try {
      const stored = localStorage.getItem('rp_dashboard_active_tab');
      if (stored === 'general' || stored === 'projects' || stored === 'leads' || stored === 'saved-leads' || stored === 'presets' || stored === 'tunnels') {
        return stored;
      }
    } catch {}
    return initialTab;
  });

  const setActiveTab = (tab: 'general' | 'projects' | 'leads' | 'saved-leads' | 'presets' | 'tunnels') => {
    setActiveTabState(tab);
    if (onTabChange) onTabChange(tab);
    try {
      localStorage.setItem('rp_dashboard_active_tab', tab);
    } catch {}
  };

  // Ngrok Active Tunnels State
  const [activeTunnels, setActiveTunnels] = useState<NgrokTunnel[]>([]);
  const [loadingTunnels, setLoadingTunnels] = useState(false);

  const fetchActiveTunnels = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ngrok/tunnels`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTunnels(data.tunnels || []);
      }
    } catch (err) {
      console.error('Erro ao buscar túneis Ngrok:', err);
    }
  };

  const handleStopTunnel = async (projectId: string) => {
    try {
      await fetch(`${API_URL}/api/ngrok/stop/${projectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchActiveTunnels();
    } catch (err: any) {
      alert(`Erro ao parar túnel: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchActiveTunnels();
    const interval = setInterval(fetchActiveTunnels, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTabState(initialTab);
    }
  }, [initialTab]);

  // Accessibility & UX Customization States (Persistência no LocalStorage)
  const [navbarMinimized, setNavbarMinimized] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('rp_navbar_minimized');
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [navbarSize, setNavbarSize] = useState<'compact' | 'normal' | 'large'>(() => {
    try {
      const stored = localStorage.getItem('rp_navbar_size');
      if (stored === 'compact' || stored === 'normal' || stored === 'large') return stored;
    } catch {}
    return 'normal';
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('rp_sidebar_width');
      if (stored) return Number(stored);
    } catch {}
    return 256;
  });

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Efeitos para sincronizar preferências de interface com o LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('rp_navbar_minimized', JSON.stringify(navbarMinimized));
    } catch {}
  }, [navbarMinimized]);

  useEffect(() => {
    try {
      localStorage.setItem('rp_navbar_size', navbarSize);
    } catch {}
  }, [navbarSize]);

  useEffect(() => {
    try {
      localStorage.setItem('rp_sidebar_width', sidebarWidth.toString());
    } catch {}
  }, [sidebarWidth]);

  // User Profile Dropdown state
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Leads search states segmentados
  const [leadQuery, setLeadQuery] = useState('');
  const [leadCity, setLeadCity] = useState('');
  const [leadState, setLeadState] = useState('');
  const [leadCountry, setLeadCountry] = useState('Brasil');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [minRating, setMinRating] = useState('0');
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  
  // Paginação e Modo de Visualização (Persistência no LocalStorage)
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    try {
      const stored = localStorage.getItem('rp_leads_view_mode');
      if (stored === 'table' || stored === 'cards') return stored;
    } catch {}
    return 'table';
  });

  useEffect(() => {
    try {
      localStorage.setItem('rp_leads_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  // Modo de Visualização e Paginação para Leads Salvos
  const [savedViewMode, setSavedViewMode] = useState<'table' | 'cards'>(() => {
    try {
      const stored = localStorage.getItem('rp_saved_leads_view_mode');
      if (stored === 'table' || stored === 'cards') return stored;
    } catch {}
    return 'table';
  });

  useEffect(() => {
    try {
      localStorage.setItem('rp_saved_leads_view_mode', savedViewMode);
    } catch {}
  }, [savedViewMode]);
  const [savedCurrentPage, setSavedCurrentPage] = useState(1);
  const [savedPerPage, setSavedPerPage] = useState(10);

  // Saved Leads State (Persistência no LocalStorage)
  const [savedLeads, setSavedLeads] = useState<Lead[]>(() => {
    try {
      const stored = localStorage.getItem('builddreamer_saved_leads');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleToggleSaveLead = (lead: Lead) => {
    setSavedLeads(prev => {
      const exists = prev.some(l => l.id === lead.id || l.name === lead.name);
      let updated;
      if (exists) {
        updated = prev.filter(l => l.id !== lead.id && l.name !== lead.name);
      } else {
        updated = [...prev, lead];
      }
      localStorage.setItem('builddreamer_saved_leads', JSON.stringify(updated));
      return updated;
    });
  };

  // Filter Presets State (CRUD de Filtros Pré-Prontos)
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => {
    try {
      const stored = localStorage.getItem('builddreamer_filter_presets');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { id: '1', name: 'Padarias Sem Site (DF)', niche: 'Padaria', city: 'Brasília', state: 'DF', country: 'Brasil', onlyWithoutWebsite: true, hasPhoneOnly: true, minRating: 4 },
      { id: '2', name: 'Dentistas em Formosa (GO)', niche: 'Dentista', city: 'Formosa', state: 'GO', country: 'Brasil', onlyWithoutWebsite: false, hasPhoneOnly: true, minRating: 4.5 },
      { id: '3', name: 'Pizzarias em Goiânia (GO)', niche: 'Pizzaria', city: 'Goiânia', state: 'GO', country: 'Brasil', onlyWithoutWebsite: true, hasPhoneOnly: false, minRating: 0 },
      { id: '4', name: 'Academias em São Paulo (SP)', niche: 'Academia', city: 'São Paulo', state: 'SP', country: 'Brasil', onlyWithoutWebsite: true, hasPhoneOnly: true, minRating: 4 }
    ];
  });

  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetForm, setPresetForm] = useState<Omit<FilterPreset, 'id'>>({
    name: '',
    niche: '',
    city: '',
    state: '',
    country: 'Brasil',
    onlyWithoutWebsite: true,
    hasPhoneOnly: false,
    minRating: 0
  });

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetForm.name || !presetForm.niche) return;

    if (editingPresetId) {
      const updated = filterPresets.map(p => p.id === editingPresetId ? { ...presetForm, id: editingPresetId } : p);
      setFilterPresets(updated);
      localStorage.setItem('builddreamer_filter_presets', JSON.stringify(updated));
    } else {
      const newPreset: FilterPreset = { ...presetForm, id: `preset-${Date.now()}` };
      const updated = [...filterPresets, newPreset];
      setFilterPresets(updated);
      localStorage.setItem('builddreamer_filter_presets', JSON.stringify(updated));
    }
    setPresetModalOpen(false);
    setEditingPresetId(null);
  };

  const handleDeletePreset = (id: string) => {
    const updated = filterPresets.filter(p => p.id !== id);
    setFilterPresets(updated);
    localStorage.setItem('builddreamer_filter_presets', JSON.stringify(updated));
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    setLeadQuery(preset.niche);
    setLeadCity(preset.city);
    setLeadState(preset.state);
    setLeadCountry(preset.country || 'Brasil');
    setOnlyWithoutWebsite(preset.onlyWithoutWebsite);
    setHasPhoneOnly(preset.hasPhoneOnly);
    setMinRating(preset.minRating.toString());
    setActiveTab('leads');
  };

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

  // Rastreamento de projetos sendo gerados pela IA no momento
  const [generatingProjectJobs, setGeneratingProjectJobs] = useState<Record<string, { status: string; currentModel?: string; attempt?: number; total?: number }>>({});

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

  // Monitorar em tempo real todos os projetos que estão sendo construídos pela IA
  useEffect(() => {
    const activeProjectIds = Object.keys(generatingProjectJobs);
    if (activeProjectIds.length === 0) return;

    const interval = setInterval(async () => {
      for (const pId of activeProjectIds) {
        try {
          const res = await fetch(`${API_URL}/api/projects/jobs/${pId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) continue;
          const job = await res.json();

          if (job.status === 'completed' || job.status === 'failed') {
            setGeneratingProjectJobs(prev => {
              const copy = { ...prev };
              delete copy[pId];
              return copy;
            });
            fetchProjects();
          } else {
            setGeneratingProjectJobs(prev => ({
              ...prev,
              [pId]: job
            }));
          }
        } catch {}
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [generatingProjectJobs, token]);

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

  // Lead search method com Crawler Autônomo
  const handleSearchLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadQuery) return;
    setLoadingLeads(true);
    setCurrentPage(1);

    try {
      // 1. Chamar Crawler Autônomo com parâmetros segmentados
      const crawlerRes = await fetch(`${API_URL}/api/crawler/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          niche: leadQuery,
          city: leadCity,
          state: leadState,
          country: leadCountry,
          onlyWithoutWebsite,
          hasPhoneOnly,
          minRating,
          limit: 40
        })
      });

      if (crawlerRes.ok) {
        const data = await crawlerRes.json();
        if (data.leads && data.leads.length > 0) {
          setLeadsList(data.leads.map((l: any) => ({
            ...l,
            needsWebsite: l.hasWebsite === false || !l.website
          })));
          return;
        }
      }

      // 2. Fallback para busca anterior
      const res = await fetch(`${API_URL}/api/leads/search-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: leadQuery, location: `${leadCity} ${leadState} ${leadCountry}`.trim() })
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

  // Melhorar/Remasterizar site existente analisando todas as páginas e subpáginas com IA
  const handleRemasterClientWebsite = async (lead: Lead) => {
    if (!lead.website) {
      alert('Este lead não possui um website cadastrado.');
      return;
    }

    if (!confirm(`Deseja analisar e remasterizar todo o site "${lead.website}" de ${lead.name} com IA? A IA irá clonar a estrutura de páginas e subpáginas gerando um design 10x superior.`)) {
      return;
    }

    try {
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
          'X-Gemini-Models': JSON.stringify(registeredModelIds),
          'X-Proxy-Url': localStorage.getItem('ai_proxy_url') || ''
        },
        body: JSON.stringify({ 
          name: `${lead.name} (Remaster)`, 
          description: `Site completo remasterizado a partir de ${lead.website}`,
          remasterWebsiteUrl: lead.website
        })
      });

      if (!res.ok) throw new Error('Falha ao iniciar remasterização com IA');
      const newProject = await res.json();
      
      setProjects([newProject, ...projects]);
      setGeneratingProjectJobs(prev => ({
        ...prev,
        [newProject.id]: { status: 'processing', currentModel: 'Analisando páginas do site original...' }
      }));
      setActiveTab('projects');
    } catch (err: any) {
      alert(err.message);
    }
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
          'X-Gemini-Models': JSON.stringify(registeredModelIds),
          'X-Proxy-Url': localStorage.getItem('ai_proxy_url') || ''
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

      // Se for geração com IA, marcamos o projeto como 'em geração' e mantemos o usuário na aba de Projetos para acompanhar o status
      if (creationMode === 'ai') {
        setGeneratingProjectJobs(prev => ({
          ...prev,
          [newProject.id]: { status: 'processing' }
        }));
        setActiveTab('projects');
      } else {
        // Se for do zero ou template tradicional, abre direto o editor
        onSelectProject(newProject.id);
      }
      
      // Reset fields
      setNewProjectName('');
      setNewProjectDesc('');
      setBusinessName('');
      setSegment('');
      setVisualStyle('');
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
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-200 ${
      theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0c10] text-slate-100'
    }`}>
      {/* Top Navbar with Size and Minimized State Toggle */}
      <header className={`border-b sticky top-0 z-30 shrink-0 transition-all duration-300 backdrop-blur-md ${
        theme === 'light'
          ? 'bg-white/90 border-slate-200 shadow-sm'
          : 'bg-[#0f1117]/90 border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      } ${
        navbarMinimized ? 'h-8 py-0' : navbarSize === 'compact' ? 'h-12 py-1' : navbarSize === 'large' ? 'h-20 py-3' : 'h-16 py-2'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          
          {/* Logo & Mobile Menu Trigger */}
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-1.5 rounded-lg border md:hidden transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Menu Lateral"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <div className={`w-8 h-8 rounded-full overflow-hidden border shrink-0 flex items-center justify-center ${
              theme === 'light' ? 'border-amber-600/30 bg-amber-50' : 'border-amber-500/30 bg-black/40'
            }`}>
              <img src="/logo.png" alt="Real Premise" className="w-full h-full object-cover" />
            </div>
            {!navbarMinimized && (
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-base sm:text-lg tracking-wider ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>REAL PREMISE</span>
                <span className={`hidden sm:inline-block px-2 py-0.5 rounded border text-[9px] font-mono tracking-widest ${
                  theme === 'light'
                    ? 'border-slate-300 bg-slate-100 text-slate-600 font-semibold'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300'
                }`}>STUDIO</span>
              </div>
            )}
          </div>

          {/* Accessibility & Theme Controls */}
          <div className="flex items-center gap-2.5">
            {/* Botão de Alternar Modo Escuro / Modo Claro */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 shadow-sm'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-amber-300 shadow-sm'
              }`}
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline text-xs font-semibold text-amber-300">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="hidden sm:inline text-xs font-semibold text-slate-700">Escuro</span>
                </>
              )}
            </button>

            {/* Density Selector */}
            {!navbarMinimized && (
              <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 border rounded-xl ${
                theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/80 border-slate-800'
              }`}>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}>Barra:</span>
                <select
                  value={navbarSize}
                  onChange={(e) => setNavbarSize(e.target.value as any)}
                  className={`bg-transparent border-none text-[10px] font-mono focus:outline-none cursor-pointer ${
                    theme === 'light' ? 'text-slate-800' : 'text-slate-200'
                  }`}
                >
                  <option value="compact" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>Compacto</option>
                  <option value="normal" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>Normal</option>
                  <option value="large" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>Grande</option>
                </select>
              </div>
            )}

            {/* Minimize / Maximize Navbar Button */}
            <button
              onClick={() => setNavbarMinimized(!navbarMinimized)}
              className={`p-1.5 border rounded-xl transition-all cursor-pointer shadow-sm ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={navbarMinimized ? "Expandir Barra Superior" : "Minimizar Barra Superior"}
            >
              {navbarMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>

            {/* User Profile Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`flex items-center gap-2.5 p-1 pl-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800'
                }`}
              >
                {!navbarMinimized && (
                  <div className="text-right hidden sm:block">
                    <p className={`text-xs font-bold leading-tight ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}>{user?.name || 'Desenvolvedor'}</p>
                    <p className={`text-[9px] font-mono ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>{user?.email}</p>
                  </div>
                )}
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-100 flex items-center justify-center font-bold text-xs shadow border border-slate-700">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              </button>

              {/* Dropdown Menu Popup */}
              {showUserDropdown && (
                <div 
                  className={`absolute right-0 mt-2 w-56 border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl ${
                    theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-900'
                      : 'bg-[#0f1117] border-slate-800 text-slate-100'
                  }`}
                  onClick={() => setShowUserDropdown(false)}
                >
                  <div className={`p-3 border-b ${
                    theme === 'light' ? 'border-slate-100 bg-slate-50' : 'border-slate-800 bg-slate-900/50'
                  }`}>
                    <p className="text-xs font-semibold truncate">{user?.name || 'Desenvolvedor'}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</p>
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
          className={`border-r flex flex-col justify-between shrink-0 p-4 hidden md:flex relative select-none transition-colors duration-200 ${
            theme === 'light'
              ? 'bg-white border-slate-200'
              : 'bg-[#0b0d13] border-slate-800/80'
          }`}
        >
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'general'
                  ? theme === 'light'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'bg-slate-800 text-white font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">Visão Geral</span>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? theme === 'light'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'bg-slate-800 text-white font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <Layout className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">Projetos / Sites</span>
            </button>
            
            {/* Prospecting Section Divider */}
            <div className={`pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Prospecção de Leads
            </div>

            <button
              onClick={() => setActiveTab('leads')}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'leads'
                  ? theme === 'light'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'bg-slate-800 text-white font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate">Buscador de Clientes</span>
            </button>

            <button
              onClick={() => setActiveTab('saved-leads')}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'saved-leads'
                  ? theme === 'light'
                    ? 'bg-amber-50 text-amber-800 font-bold'
                    : 'bg-slate-800 text-amber-300 font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate flex-1 text-left">Leads Salvos</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                theme === 'light' ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
              }`}>
                {savedLeads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('presets')}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'presets'
                  ? theme === 'light'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'bg-slate-800 text-white font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="truncate flex-1 text-left">Filtros Pré-Prontos</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {filterPresets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tunnels')}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'tunnels'
                  ? theme === 'light'
                    ? 'bg-cyan-50 text-cyan-700 font-bold'
                    : 'bg-slate-800 text-cyan-300 font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <Radio className={`w-4 h-4 text-cyan-500 shrink-0 ${activeTunnels.length > 0 ? 'animate-pulse' : ''}`} />
              <span className="truncate flex-1 text-left">Previews Ngrok</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTunnels.length > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                  : theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {activeTunnels.length}
              </span>
            </button>
          </div>

          <div className={`p-3 border rounded-xl ${
            theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800/80'
          }`}>
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${
              theme === 'light' ? 'text-slate-400' : 'text-slate-500'
            }`}>Ambiente de Deploy</span>
            <span className={`block text-xs mt-0.5 font-mono truncate ${
              theme === 'light' ? 'text-indigo-600 font-semibold' : 'text-indigo-400'
            }`}>Real Premise Live FTP</span>
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
                  {projects.map((project) => {
                    const isGenerating = !!generatingProjectJobs[project.id];
                    const jobInfo = generatingProjectJobs[project.id];

                    return (
                      <div 
                        key={project.id}
                        onClick={() => {
                          if (isGenerating) {
                            alert('Aguarde! A IA ainda está finalizando a geração do site.');
                            return;
                          }
                          onSelectProject(project.id);
                        }}
                        className={`bg-[#0f0b18] border rounded-2xl p-6 transition-all group flex flex-col justify-between min-h-[220px] shadow-lg animate-in fade-in duration-200 ${
                          isGenerating 
                            ? 'border-amber-500/50 shadow-[0_0_25px_rgba(229,185,95,0.2)] cursor-not-allowed relative overflow-hidden' 
                            : 'border-slate-855 hover:border-purple-500/40 hover:bg-[#130d1e] cursor-pointer hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]'
                        }`}
                      >
                        {isGenerating && (
                          <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-4 text-center">
                            <div className="w-10 h-10 rounded-full border-2 border-amber-500/50 p-1 mb-2 animate-spin shadow-[0_0_15px_rgba(229,185,95,0.4)] flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                            </div>
                            <span className="text-xs font-bold text-amber-300 tracking-wide">Construindo com IA...</span>
                            <span className="text-[10px] text-slate-300 font-mono mt-1 animate-pulse">
                              {jobInfo?.currentModel ? `${jobInfo.currentModel} (${jobInfo.attempt}/${jobInfo.total})` : 'Estruturando HTML, CSS e Seções'}
                            </span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h3 className="font-bold text-lg text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                              {project.name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-xs capitalize font-medium shrink-0 border ${
                              isGenerating 
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}>
                              {isGenerating ? 'Gerando com IA...' : project.status === 'development' ? 'Em Desenvolvimento' : 'Publicado'}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id, e);
                              }}
                              className="p-1.5 hover:text-red-400 rounded-lg hover:bg-slate-850 transition-all cursor-pointer"
                              title="Deletar projeto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <ChevronRight className="w-5 h-5 text-slate-650 group-hover:translate-x-1 transition-transform group-hover:text-amber-400" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'saved-leads' ? (
            /* LEADS SALVOS SUBMENU TAB */
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                    <Bookmark className="w-8 h-8 text-yellow-400" />
                    Leads Salvos ({savedLeads.length})
                  </h1>
                  <p className="text-slate-450 mt-1">Gerencie os potenciais clientes favoritados para abordagem e criação de sites.</p>
                </div>
                <button
                  onClick={() => setActiveTab('leads')}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  Buscar Mais Leads
                </button>
              </div>

              {savedLeads.length === 0 ? (
                <div className="p-16 bg-[#0f0b18] border border-slate-850 rounded-2xl text-center space-y-3">
                  <Bookmark className="w-12 h-12 text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-white">Nenhum lead salvo no momento</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Navegue até o <strong>Buscador de Clientes</strong>, faça buscas e clique no ícone de salvar em qualquer estabelecimento para adicioná-lo aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Barra Superior da Listagem de Salvos: Contador e Alternador de Layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f0b18] border border-slate-850 px-4 py-3 rounded-2xl text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>Exibindo <strong>{Math.min((savedCurrentPage - 1) * savedPerPage + 1, savedLeads.length)}</strong>–<strong>{Math.min(savedCurrentPage * savedPerPage, savedLeads.length)}</strong> de <strong>{savedLeads.length}</strong> leads favoritados</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Itens por página */}
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span>Por página:</span>
                        <select
                          value={savedPerPage}
                          onChange={(e) => {
                            setSavedPerPage(Number(e.target.value));
                            setSavedCurrentPage(1);
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      {/* Alternador Tabela / Cards */}
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => setSavedViewMode('table')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            savedViewMode === 'table' ? 'bg-purple-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Visualização em Lista Compacta"
                        >
                          Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setSavedViewMode('cards')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            savedViewMode === 'cards' ? 'bg-purple-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Visualização em Cards"
                        >
                          Cards
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Renderização em Lista Compacta / Tabela para Leads Salvos */}
                  {savedViewMode === 'table' ? (
                    <div className="bg-[#0f0b18] border border-yellow-500/20 rounded-2xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              <th className="py-3.5 px-4">Estabelecimento / Categoria</th>
                              <th className="py-3.5 px-4">Endereço</th>
                              <th className="py-3.5 px-4">Contato & Presença</th>
                              <th className="py-3.5 px-4 text-center">Nota</th>
                              <th className="py-3.5 px-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/60 text-xs">
                            {savedLeads
                              .slice((savedCurrentPage - 1) * savedPerPage, savedCurrentPage * savedPerPage)
                              .map(lead => {
                                const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || lead.city || ''}`)}`;

                                return (
                                  <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                                    <td className="py-3.5 px-4">
                                      <div className="font-bold text-white text-sm flex items-center gap-2">
                                        <span className="truncate max-w-[220px]" title={lead.name}>{lead.name}</span>
                                        <BookmarkCheck className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                                      </div>
                                      {lead.category && (
                                        <span className="text-[10px] text-yellow-400 font-mono mt-0.5 block">{lead.category}</span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 text-slate-300 max-w-[260px]">
                                      <div className="flex items-start gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2 text-xs text-slate-300" title={lead.address}>
                                          {lead.address || `${lead.city || ''} - ${lead.state || ''}`}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                                          <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                                          <span>{lead.phone}</span>
                                        </div>
                                        <div>
                                          {lead.website ? (
                                            <a 
                                              href={lead.website} 
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 truncate max-w-[180px]"
                                              title={lead.website}
                                            >
                                              <Globe className="w-3 h-3 shrink-0" />
                                              <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                                            </a>
                                          ) : (
                                            <span className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-500/20 px-1.5 py-0.5 rounded">
                                              Sem Website
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4 text-center">
                                      <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-lg text-xs font-bold">
                                        <Star className="w-3 h-3 fill-yellow-400" />
                                        {lead.rating}
                                      </span>
                                    </td>

                                    <td className="py-3.5 px-4 text-right">
                                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                        <a
                                          href={mapsSearchUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/40 text-pink-400 rounded-lg transition-all"
                                          title="Ver no Google Maps"
                                        >
                                          <MapPin className="w-3.5 h-3.5" />
                                        </a>

                                        {lead.whatsappUrl && (
                                          <a
                                            href={lead.whatsappUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-lg transition-all"
                                            title="WhatsApp"
                                          >
                                            WhatsApp
                                          </a>
                                        )}

                                        <button
                                          onClick={() => handleToggleSaveLead(lead)}
                                          className="p-1.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                                          title="Remover dos salvos"
                                        >
                                          <BookmarkCheck className="w-3.5 h-3.5 fill-yellow-400" />
                                        </button>

                                        {lead.website ? (
                                          <button
                                            onClick={() => handleRemasterClientWebsite(lead)}
                                            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                                            title="Analisar todas as páginas e subpáginas e recriar versão moderna com IA"
                                          >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Melhorar com IA
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleCreateProjectFromLead(lead)}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                                          >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Gerar Site
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Renderização em Cards para Leads Salvos */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedLeads
                        .slice((savedCurrentPage - 1) * savedPerPage, savedCurrentPage * savedPerPage)
                        .map(lead => (
                          <div 
                            key={lead.id}
                            className="bg-[#0f0b18] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between hover:border-yellow-500/40 transition-all shadow-md"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="font-bold text-white text-base leading-tight">{lead.name}</h3>
                                  {lead.category && (
                                    <span className="text-[10px] text-yellow-400 font-mono">{lead.category}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleToggleSaveLead(lead)}
                                  className="p-1 text-yellow-400 hover:text-red-400 transition-colors cursor-pointer"
                                  title="Remover dos salvos"
                                >
                                  <BookmarkCheck className="w-5 h-5 fill-yellow-400" />
                                </button>
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
                                  <span className="text-red-400 font-semibold uppercase tracking-wider text-[10px] bg-red-950/30 border border-red-500/25 px-1.5 py-0.5 rounded">Sem Website (Oportunidade!)</span>
                                )}
                              </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-850/80 flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] text-slate-500 font-mono">Salvo na Lista</span>
                              <div className="flex items-center gap-2">
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || lead.city || ''}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-pink-950/30 hover:bg-pink-900/50 border border-pink-500/30 text-pink-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
                                  title="Ver no Google Maps"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                  Maps
                                </a>
                                {lead.whatsappUrl && (
                                  <a
                                    href={lead.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl transition-all"
                                  >
                                    WhatsApp
                                  </a>
                                )}
                                <button
                                  onClick={() => handleCreateProjectFromLead(lead)}
                                  className="px-3.5 py-1.5 bg-purple-700/40 hover:bg-purple-700/80 border border-purple-500/50 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-sm"
                                >
                                  Gerar Site com IA
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Paginação para Leads Salvos */}
                  {Math.ceil(savedLeads.length / savedPerPage) > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        onClick={() => setSavedCurrentPage(p => Math.max(p - 1, 1))}
                        disabled={savedCurrentPage === 1}
                        className="px-3.5 py-2 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Anterior
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(savedLeads.length / savedPerPage) }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setSavedCurrentPage(page)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                              savedCurrentPage === page
                                ? 'bg-purple-700 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                                : 'bg-[#0f0b18] border border-slate-850 text-slate-400 hover:text-white'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setSavedCurrentPage(p => Math.min(p + 1, Math.ceil(savedLeads.length / savedPerPage)))}
                        disabled={savedCurrentPage === Math.ceil(savedLeads.length / savedPerPage)}
                        className="px-3.5 py-2 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === 'presets' ? (
            /* FILTROS PRÉ-PRONTOS (CRUD DE PRESETS) */
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                    <SlidersHorizontal className="w-8 h-8 text-cyan-400" />
                    Filtros Pré-Prontos de Prospecção
                  </h1>
                  <p className="text-slate-450 mt-1">Configure modelos de busca frequentes para prospectar estabelecimentos com 1 clique.</p>
                </div>
                <button
                  onClick={() => {
                    setEditingPresetId(null);
                    setPresetForm({
                      name: '',
                      niche: '',
                      city: '',
                      state: '',
                      country: 'Brasil',
                      onlyWithoutWebsite: true,
                      hasPhoneOnly: false,
                      minRating: 0
                    });
                    setPresetModalOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Novo Filtro
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterPresets.map(preset => (
                  <div 
                    key={preset.id}
                    className="bg-[#0f0b18] border border-slate-850 hover:border-cyan-500/30 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-bold text-white text-base leading-tight">{preset.name}</h3>
                        <span className="px-2 py-0.5 bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 rounded-md text-[10px] font-mono">
                          {preset.niche}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-400 mt-3">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-pink-400" />
                          <span>Região: <strong>{preset.city}{preset.state ? ` - ${preset.state}` : ''} ({preset.country || 'Brasil'})</strong></span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Apenas sem site: <strong>{preset.onlyWithoutWebsite ? 'Sim' : 'Não'}</strong></span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Com telefone: <strong>{preset.hasPhoneOnly ? 'Sim' : 'Qualquer'}</strong></span>
                        </p>
                        {preset.minRating > 0 && (
                          <p className="flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-yellow-400" />
                            <span>Avaliação mínima: <strong>★ {preset.minRating}</strong></span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-850 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingPresetId(preset.id);
                            setPresetForm({
                              name: preset.name,
                              niche: preset.niche,
                              city: preset.city,
                              state: preset.state,
                              country: preset.country || 'Brasil',
                              onlyWithoutWebsite: preset.onlyWithoutWebsite,
                              hasPhoneOnly: preset.hasPhoneOnly,
                              minRating: preset.minRating
                            });
                            setPresetModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
                          title="Editar preset"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="p-1.5 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                          title="Excluir preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleApplyPreset(preset)}
                        className="px-4 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                      >
                        Executar Busca
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'tunnels' ? (
            /* SEÇÃO DE TÚNEIS NGROK ATIVOS */
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                    <Radio className="w-8 h-8 text-cyan-400" />
                    Previews Ngrok Ativos
                  </h1>
                  <p className="text-slate-400 mt-1">Gerencie todos os links públicos compartilhados com clientes em tempo real.</p>
                </div>

                <button
                  onClick={fetchActiveTunnels}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  Atualizar Lista
                </button>
              </div>

              {activeTunnels.length === 0 ? (
                <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-12 text-center space-y-3">
                  <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto">
                    <Globe className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Nenhum túnel Ngrok ativo no momento</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Você pode subir um preview online a qualquer momento dentro do editor do site clicando na opção <strong>Preview &gt; Subir Preview no Ngrok</strong>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {activeTunnels.map(tunnel => (
                    <div 
                      key={tunnel.projectId}
                      className="bg-[#0f0b18] border border-cyan-500/30 hover:border-cyan-500/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-xl"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                          <h3 className="font-bold text-white text-base truncate">{tunnel.projectName}</h3>
                          <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono rounded-full">
                            Online
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 font-medium">Link Público:</span>
                          <a 
                            href={tunnel.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="font-mono text-cyan-400 hover:underline flex items-center gap-1 truncate"
                          >
                            {tunnel.url}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>

                        <p className="text-[10px] text-slate-500">
                          Iniciado em: {new Date(tunnel.startedAt).toLocaleString('pt-BR')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onSelectProject(tunnel.projectId)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                          Abrir no Editor
                        </button>
                        <button
                          onClick={() => handleStopTunnel(tunnel.projectId)}
                          className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5" />
                          Parar Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* BUSCAR CLIENTES (LEADS CRAWLER TAB SEM MAPA PESADO) */
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                    <Users className="w-8 h-8 text-pink-400" />
                    Buscador de Leads Autônomo
                  </h1>
                  <p className="text-slate-450 mt-1">Prospecte estabelecimentos comerciais locais sem website com o motor de extração Overpass e Web Index.</p>
                </div>
                
                {/* Botões rápidos de atalho */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab('saved-leads')}
                    className="px-3.5 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Ver Salvos ({savedLeads.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('presets')}
                    className="px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Filtros Prontos
                  </button>
                </div>
              </div>

              {/* Formulário de Busca Avançada Segmentada */}
              <form onSubmit={handleSearchLeads} className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                    <input 
                      type="text"
                      required
                      placeholder="Nicho: Padaria, Dentista, Supermercado..."
                      value={leadQuery}
                      onChange={(e) => setLeadQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
                    />
                  </div>
                  <div className="md:col-span-3 relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                    <input 
                      type="text"
                      required
                      placeholder="Cidade (ex: Formosa, Brasília)"
                      value={leadCity}
                      onChange={(e) => setLeadCity(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
                    />
                  </div>
                  <div className="md:col-span-2 relative">
                    <input 
                      type="text"
                      placeholder="Estado (ex: GO, DF, SP)"
                      value={leadState}
                      onChange={(e) => setLeadState(e.target.value)}
                      className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600 uppercase"
                    />
                  </div>
                  <div className="md:col-span-1 relative">
                    <input 
                      type="text"
                      placeholder="País"
                      value={leadCountry}
                      onChange={(e) => setLeadCountry(e.target.value)}
                      className="w-full px-3 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={loadingLeads}
                      className="w-full h-full py-3 bg-purple-700 hover:bg-purple-650 text-white font-bold rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] cursor-pointer flex items-center justify-center gap-2"
                    >
                      {loadingLeads ? 'Raspando...' : 'Buscar Leads'}
                    </button>
                  </div>
                </div>

                {/* Filtros Detalhados */}
                <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={onlyWithoutWebsite}
                        onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
                      />
                      <span>Apenas <strong>Sem Website</strong> (Oportunidades)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={hasPhoneOnly}
                        onChange={(e) => setHasPhoneOnly(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
                      />
                      <span>Com <strong>Telefone/WhatsApp</strong></span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Avaliação Mínima:</span>
                    <select
                      value={minRating}
                      onChange={(e) => setMinRating(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="0">Todas as notas</option>
                      <option value="4.0">★ 4.0 ou mais</option>
                      <option value="4.5">★ 4.5 ou mais</option>
                      <option value="4.8">★ 4.8 ou mais</option>
                    </select>
                  </div>
                </div>
              </form>

              {/* Leads results list com Controles de Visualização e Paginação */}
              {loadingLeads ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 rounded-2xl bg-[#0f0b18] border border-slate-850 animate-pulse" />
                  ))}
                </div>
              ) : leadsList.length === 0 ? (
                <div className="p-16 bg-[#0f0b18] border border-slate-850 rounded-2xl text-center space-y-3">
                  <Search className="w-12 h-12 text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-white">Nenhum lead exibido</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Digite um nicho comercial (ex: <em>Advocacia</em>, <em>Dentista</em>, <em>Padaria</em>) e uma cidade, ou use um dos nossos <strong>Filtros Prontos</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Barra Superior da Listagem: Contador, Filtros de Paginação e Alternador de Layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f0b18] border border-slate-850 px-4 py-3 rounded-2xl text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>Exibindo <strong>{Math.min((currentPage - 1) * leadsPerPage + 1, leadsList.length)}</strong>–<strong>{Math.min(currentPage * leadsPerPage, leadsList.length)}</strong> de <strong>{leadsList.length}</strong> estabelecimentos</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Seletor de itens por página */}
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span>Por página:</span>
                        <select
                          value={leadsPerPage}
                          onChange={(e) => {
                            setLeadsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      {/* Alternador Tabela / Cards */}
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={() => setViewMode('table')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            viewMode === 'table' ? 'bg-purple-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Visualização em Lista Compacta"
                        >
                          Lista
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('cards')}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            viewMode === 'cards' ? 'bg-purple-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Visualização em Cards"
                        >
                          Cards
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Renderização em Tabela / Lista Compacta com Ações ao Final */}
                  {viewMode === 'table' ? (
                    <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              <th className="py-3.5 px-4">Estabelecimento / Nicho</th>
                              <th className="py-3.5 px-4">Endereço & Localização</th>
                              <th className="py-3.5 px-4">Telefone / Presença</th>
                              <th className="py-3.5 px-4 text-center">Nota</th>
                              <th className="py-3.5 px-4 text-right">Ações Rápidas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/60 text-xs">
                            {leadsList
                              .slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage)
                              .map(lead => {
                                const isSaved = savedLeads.some(l => l.id === lead.id || l.name === lead.name);
                                const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || lead.city || ''}`)}`;

                                return (
                                  <tr 
                                    key={lead.id} 
                                    className={`hover:bg-slate-900/40 transition-colors group ${
                                      isSaved ? 'bg-yellow-500/5' : ''
                                    }`}
                                  >
                                    <td className="py-3.5 px-4">
                                      <div className="font-bold text-white text-sm flex items-center gap-2">
                                        <span className="truncate max-w-[220px]" title={lead.name}>{lead.name}</span>
                                        {isSaved && (
                                          <BookmarkCheck className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-purple-400 font-mono">{lead.category}</span>
                                        <span className="text-[10px] text-slate-500">• {lead.source}</span>
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4 text-slate-300 max-w-[260px]">
                                      <div className="flex items-start gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2 text-xs text-slate-300" title={lead.address}>
                                          {lead.address || `${lead.city || ''} - ${lead.state || ''}`}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                                          <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                                          <span>{lead.phone}</span>
                                        </div>
                                        <div>
                                          {lead.website ? (
                                            <a 
                                              href={lead.website} 
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 truncate max-w-[180px]"
                                              title={lead.website}
                                            >
                                              <Globe className="w-3 h-3 shrink-0" />
                                              <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                                            </a>
                                          ) : (
                                            <span className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-500/20 px-1.5 py-0.5 rounded">
                                              Sem Website
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4 text-center">
                                      <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-lg text-xs font-bold">
                                        <Star className="w-3 h-3 fill-yellow-400" />
                                        {lead.rating}
                                      </span>
                                    </td>

                                    <td className="py-3.5 px-4 text-right">
                                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                        {/* Botão Ver no Maps */}
                                        <a
                                          href={mapsSearchUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/40 text-pink-400 rounded-lg transition-all"
                                          title="Ver localização no Google Maps"
                                        >
                                          <MapPin className="w-3.5 h-3.5" />
                                        </a>

                                        {/* WhatsApp */}
                                        {lead.whatsappUrl && (
                                          <a
                                            href={lead.whatsappUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-lg transition-all"
                                            title="Chamar no WhatsApp"
                                          >
                                            WhatsApp
                                          </a>
                                        )}

                                        {/* Salvar Lead */}
                                        <button
                                          onClick={() => handleToggleSaveLead(lead)}
                                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                            isSaved 
                                              ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' 
                                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-yellow-400'
                                          }`}
                                          title={isSaved ? 'Salvo' : 'Salvar Lead'}
                                        >
                                          {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 fill-yellow-400" /> : <Bookmark className="w-3.5 h-3.5" />}
                                        </button>

                                        {/* Criar Site ou Melhorar com IA caso tenha website */}
                                        {lead.website ? (
                                          <button
                                            onClick={() => handleRemasterClientWebsite(lead)}
                                            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                                            title="Analisar todas as páginas e subpáginas e recriar versão moderna com IA"
                                          >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Melhorar com IA
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleCreateProjectFromLead(lead)}
                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                                          >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Gerar Site
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Renderização em Cards */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {leadsList
                        .slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage)
                        .map(lead => {
                          const isSaved = savedLeads.some(l => l.id === lead.id || l.name === lead.name);
                          const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || lead.city || ''}`)}`;

                          return (
                            <div 
                              key={lead.id}
                              className={`bg-[#0f0b18] border rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md ${
                                isSaved ? 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-slate-850 hover:border-purple-500/30'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <h3 className="font-bold text-white text-base leading-tight">{lead.name}</h3>
                                    {lead.category && (
                                      <span className="text-[10px] text-purple-400 font-mono">{lead.category}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => handleToggleSaveLead(lead)}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                        isSaved 
                                          ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' 
                                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-yellow-400'
                                      }`}
                                      title={isSaved ? 'Salvo nos favoritos' : 'Salvar lead para depois'}
                                    >
                                      {isSaved ? <BookmarkCheck className="w-4 h-4 fill-yellow-400" /> : <Bookmark className="w-4 h-4" />}
                                    </button>
                                    <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded text-[10px]">
                                      <Star className="w-3 h-3 fill-yellow-400" />
                                      {lead.rating}
                                    </div>
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

                              <div className="mt-4 pt-4 border-t border-slate-850/80 flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {lead.source || 'Crawler Autônomo'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <a
                                    href={mapsSearchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 bg-pink-950/30 hover:bg-pink-900/50 border border-pink-500/30 text-pink-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
                                    title="Ver no Google Maps"
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                    Maps
                                  </a>
                                  {lead.whatsappUrl && (
                                    <a
                                      href={lead.whatsappUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-xl transition-all"
                                    >
                                      WhatsApp
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleCreateProjectFromLead(lead)}
                                    className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                                  >
                                    Gerar Site
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Controles de Paginação (Anterior / Próxima e Números de Página) */}
                  {Math.ceil(leadsList.length / leadsPerPage) > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3.5 py-2 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Anterior
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(leadsList.length / leadsPerPage) }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                              currentPage === page
                                ? 'bg-purple-700 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                                : 'bg-[#0f0b18] border border-slate-850 text-slate-400 hover:text-white'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(p + 1, Math.ceil(leadsList.length / leadsPerPage)))}
                        disabled={currentPage === Math.ceil(leadsList.length / leadsPerPage)}
                        className="px-3.5 py-2 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Preset Create / Edit Modal */}
      {presetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-[#0f0b18] border border-cyan-500/30 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="text-cyan-400 w-5 h-5" />
                {editingPresetId ? 'Editar Filtro Pré-Pronto' : 'Novo Filtro Pré-Pronto'}
              </h2>
              <button onClick={() => setPresetModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Título do Filtro</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Padarias Sem Site no DF"
                  value={presetForm.name}
                  onChange={(e) => setPresetForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Nicho / Categoria</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Padaria, Dentista, Pizzaria"
                    value={presetForm.niche}
                    onChange={(e) => setPresetForm(p => ({ ...p, niche: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Cidade</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Formosa"
                    value={presetForm.city}
                    onChange={(e) => setPresetForm(p => ({ ...p, city: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Estado (UF)</label>
                  <input 
                    type="text"
                    placeholder="Ex: GO"
                    value={presetForm.state}
                    onChange={(e) => setPresetForm(p => ({ ...p, state: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">País</label>
                  <input 
                    type="text"
                    placeholder="Ex: Brasil"
                    value={presetForm.country}
                    onChange={(e) => setPresetForm(p => ({ ...p, country: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-850">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={presetForm.onlyWithoutWebsite}
                    onChange={(e) => setPresetForm(p => ({ ...p, onlyWithoutWebsite: e.target.checked }))}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>Apenas estabelecimentos sem website</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={presetForm.hasPhoneOnly}
                    onChange={(e) => setPresetForm(p => ({ ...p, hasPhoneOnly: e.target.checked }))}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>Apenas estabelecimentos com telefone / WhatsApp</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPresetModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/30"
                >
                  Salvar Filtro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Mobile Bottom Navigation Bar (Android / Smartphone) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0c0616]/95 border-t border-purple-500/20 backdrop-blur-lg flex items-center justify-around px-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'general' ? 'text-purple-400 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px]">Geral</span>
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'projects' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Layout className="w-5 h-5" />
          <span className="text-[10px]">Sites</span>
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex flex-col items-center justify-center -mt-5 w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] cursor-pointer"
          title="Novo Projeto"
        >
          <FolderPlus className="w-6 h-6" />
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'leads' ? 'text-pink-400 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">Clientes</span>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Ajustes</span>
        </button>
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};
