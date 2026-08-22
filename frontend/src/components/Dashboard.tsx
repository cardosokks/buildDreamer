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
  Play,
  Zap,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Server,
  Code2,
  Upload,
  FileArchive,
  Loader2
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { SettingsPage } from './SettingsPage';
import { CRMManager } from './CRMManager';
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
  neighborhood?: string;
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
  totalReviews?: number;
  openingHours?: string;
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

interface DashboardProps {
  initialTab?: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings';
  onTabChange?: (tab: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings') => void;
  onSelectProject: (projectId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialTab = 'general', onTabChange, onSelectProject }) => {
  const { token, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const notify = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTabState] = useState<'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings'>(() => {
    try {
      const stored = localStorage.getItem('rp_dashboard_active_tab');
      if (stored === 'general' || stored === 'projects' || stored === 'crm' || stored === 'leads' || stored === 'saved-leads' || stored === 'presets' || stored === 'settings') {
        return stored;
      }
    } catch {}
    return initialTab === 'tunnels' as any ? 'general' : initialTab;
  });

  const setActiveTab = (tab: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings') => {
    setActiveTabState(tab);
    if (onTabChange) onTabChange(tab);
    try {
      localStorage.setItem('rp_dashboard_active_tab', tab);
    } catch {}
  };

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTabState(initialTab === 'tunnels' as any ? 'general' : initialTab);
    }
  }, [initialTab]);

  // Global System Ngrok State
  const [ngrokOnline, setNgrokOnline] = useState(false);
  const [ngrokUrl, setNgrokUrl] = useState<string | null>(null);
  const [ngrokLoading, setNgrokLoading] = useState(false);
  const [ngrokStatus, setNgrokStatus] = useState<'idle' | 'starting' | 'online' | 'error'>('idle');

  const checkNgrokStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ngrok/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNgrokOnline(!!data.active && !!data.url);
        setNgrokUrl(data.url || null);
        setNgrokStatus(data.status || (data.active ? 'online' : 'idle'));
        if (data.status === 'online' || data.status === 'idle') {
          setNgrokLoading(false);
        }
        if (data.status === 'error' && data.error) {
          setNgrokLoading(false);
        }
      }
    } catch {}
  };

  const handleToggleNgrok = async () => {
    const customToken = localStorage.getItem('ngrok_authtoken') || '';
    if (!ngrokOnline && !customToken) {
      alert('Para ligar o Ngrok, configure seu "Ngrok Authtoken" nas Configurações.');
      setShowSettings(true);
      return;
    }

    setNgrokLoading(true);
    try {
      if (ngrokOnline) {
        await fetch(`${API_URL}/api/ngrok/stop`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setNgrokOnline(false);
        setNgrokUrl(null);
        setNgrokStatus('idle');
      } else {
        setNgrokStatus('starting');
        const res = await fetch(`${API_URL}/api/ngrok/start`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-ngrok-token': customToken
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao disparar job do Ngrok');
        if (data.url && data.status === 'online') {
          setNgrokOnline(true);
          setNgrokUrl(data.url);
          setNgrokStatus('online');
        }
      }
    } catch (err: any) {
      setNgrokStatus('error');
      alert(`Falha no Ngrok: ${err.message}`);
    } finally {
      // Polling rápido para acompanhar a conclusão do job
      setTimeout(checkNgrokStatus, 600);
      setTimeout(checkNgrokStatus, 1500);
      setTimeout(checkNgrokStatus, 3000);
      setTimeout(checkNgrokStatus, 5000);
    }
  };

  useEffect(() => {
    checkNgrokStatus();
    const interval = setInterval(checkNgrokStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Accessibility & UX Customization States (Persistência no LocalStorage)
  const [navbarMinimized, setNavbarMinimized] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('rp_navbar_minimized');
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  // Remaster Wizard Modal States (Novo Fluxo em 2 Etapas com Prompts por Página e Componentes Universais)
  const [showRemasterModal, setShowRemasterModal] = useState(false);
  const [remasterTargetLead, setRemasterTargetLead] = useState<Lead | null>(null);
  const [remasterWebsiteUrl, setRemasterWebsiteUrl] = useState('');
  const [remasterBusinessName, setRemasterBusinessName] = useState('');
  const [remasterScrapeJobId, setRemasterScrapeJobId] = useState<string | null>(null);
  const [remasterScrapingStatus, setRemasterScrapingStatus] = useState<'idle' | 'scraping' | 'completed' | 'failed'>('idle');
  const [remasterProgressMsg, setRemasterProgressMsg] = useState('');
  const [remasterGlobalPrompt, setRemasterGlobalPrompt] = useState('Design ultra premium, tema escuro moderno com detalhes neon, tipografia elegante, seções de alto impacto, animações de scroll e foco em alta conversão de vendas.');
  const [remasterPages, setRemasterPages] = useState<Array<{
    name: string;
    slug: string;
    url?: string;
    customPrompt: string;
    cleanText: string;
    isHomepage: boolean;
    enabled: boolean;
  }>>([]);
  const [repeatNavbar, setRepeatNavbar] = useState(true);
  const [repeatFooter, setRepeatFooter] = useState(true);
  const [generatingRemaster, setGeneratingRemaster] = useState(false);

  // Manual Lead Creation Modal States
  const [showManualLeadModal, setShowManualLeadModal] = useState(false);

  // Project Details & Edit Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<Project | null>(null);
  const [editingProjectForm, setEditingProjectForm] = useState({
    name: '',
    description: '',
    status: 'development',
    domain: ''
  });
  const [savingProjectDetails, setSavingProjectDetails] = useState(false);

  const openProjectDetailsModal = (proj: Project) => {
    setSelectedProjectDetails(proj);
    setEditingProjectForm({
      name: proj.name || '',
      description: proj.description || '',
      status: proj.status || 'development',
      domain: (proj as any).domain || ''
    });
    setShowProjectModal(true);
  };

  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectDetails) return;
    setSavingProjectDetails(true);

    try {
      const res = await fetch(`${API_URL}/api/projects/${selectedProjectDetails.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingProjectForm)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao atualizar projeto');
      }

      const updated = await res.json();
      setProjects(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      setSelectedProjectDetails(updated);
      setShowProjectModal(false);
      notify.success(`Informações do projeto "${updated.name}" salvas no banco com sucesso!`, 'Salvo no Banco');
    } catch (err: any) {
      notify.error(err.message || 'Erro ao salvar alterações do projeto', 'Erro ao Atualizar');
    } finally {
      setSavingProjectDetails(false);
    }
  };
  const [manualLeadName, setManualLeadName] = useState('');
  const [manualLeadCategory, setManualLeadCategory] = useState('');
  const [manualLeadPhone, setManualLeadPhone] = useState('');
  const [manualLeadWebsite, setManualLeadWebsite] = useState('');
  const [manualLeadAddress, setManualLeadAddress] = useState('');
  const [manualLeadCity, setManualLeadCity] = useState('');
  const [manualLeadRating, setManualLeadRating] = useState('5.0');

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('rp_sidebar_collapsed');
      if (stored) return JSON.parse(stored);
    } catch {}
    return false;
  });

  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('rp_sidebar_hidden');
      if (stored) return JSON.parse(stored);
    } catch {}
    return false;
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

  useEffect(() => {
    try {
      localStorage.setItem('rp_sidebar_collapsed', JSON.stringify(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('rp_sidebar_hidden', JSON.stringify(sidebarHidden));
    } catch {}
  }, [sidebarHidden]);

  // Listener para redimensionar barra lateral com drag do mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = Math.min(Math.max(e.clientX, 160), 420);
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

  // User Profile Dropdown state
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Leads search states segmentados e filtros avançados
  const [leadQuery, setLeadQuery] = useState('');
  const [leadCity, setLeadCity] = useState('');
  const [leadState, setLeadState] = useState('');
  const [leadCountry, setLeadCountry] = useState('Brasil');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [minRating, setMinRating] = useState('0');
  const [minReviews, setMinReviews] = useState('0');
  const [sortBy, setSortBy] = useState<'rating' | 'reviews' | 'name'>('rating');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [crawlerPage, setCrawlerPage] = useState(1);
  const [hasMoreCrawlerLeads, setHasMoreCrawlerLeads] = useState(true);
  
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

  // Helper para salvar leads ou presets no banco de dados
  const syncSettingsToDatabase = async (payload: { savedLeads?: any; filterPresets?: any }) => {
    if (!token) return;
    try {
      await fetch(`${API_URL}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Erro ao sincronizar dados com o banco:', e);
    }
  };

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
      syncSettingsToDatabase({ savedLeads: updated });
      return updated;
    });
  };

  const handleAddManualLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLeadName.trim()) {
      alert('O nome do estabelecimento é obrigatório.');
      return;
    }

    const cleanPhone = manualLeadPhone.trim().replace(/\D/g, '');
    let cleanWebsite = manualLeadWebsite.trim();
    if (cleanWebsite && !cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
      cleanWebsite = `https://${cleanWebsite}`;
    }

    const newLead: Lead = {
      id: `manual-lead-${Date.now()}`,
      name: manualLeadName.trim(),
      category: manualLeadCategory.trim() || 'Comércio Local',
      phone: manualLeadPhone.trim() || '(Não informado)',
      website: cleanWebsite || null,
      hasWebsite: !!cleanWebsite,
      needsWebsite: !cleanWebsite,
      address: manualLeadAddress.trim() || manualLeadCity.trim() || 'Endereço não informado',
      city: manualLeadCity.trim() || 'Cidade',
      state: 'UF',
      country: 'Brasil',
      rating: manualLeadRating || '5.0',
      totalReviews: 1,
      source: 'Cadastro Manual',
      whatsappUrl: cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá! Vi o perfil da ${manualLeadName.trim()} e gostaria de conversar.`)}` : null
    };

    const updated = [newLead, ...savedLeads];
    setSavedLeads(updated);
    localStorage.setItem('builddreamer_saved_leads', JSON.stringify(updated));
    syncSettingsToDatabase({ savedLeads: updated });

    // Reset Form
    setManualLeadName('');
    setManualLeadCategory('');
    setManualLeadPhone('');
    setManualLeadWebsite('');
    setManualLeadAddress('');
    setManualLeadCity('');
    setManualLeadRating('5.0');
    setShowManualLeadModal(false);
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
      syncSettingsToDatabase({ filterPresets: updated });
    } else {
      const newPreset: FilterPreset = { ...presetForm, id: `preset-${Date.now()}` };
      const updated = [...filterPresets, newPreset];
      setFilterPresets(updated);
      localStorage.setItem('builddreamer_filter_presets', JSON.stringify(updated));
      syncSettingsToDatabase({ filterPresets: updated });
    }
    setPresetModalOpen(false);
    setEditingPresetId(null);
  };

  const handleDeletePreset = (id: string) => {
    const updated = filterPresets.filter(p => p.id !== id);
    setFilterPresets(updated);
    localStorage.setItem('builddreamer_filter_presets', JSON.stringify(updated));
    syncSettingsToDatabase({ filterPresets: updated });
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
  const [creationMode, setCreationMode] = useState<'scratch' | 'template' | 'ai' | 'zip'>('scratch');
  const [creating, setCreating] = useState(false);
  const [selectedZipBase64, setSelectedZipBase64] = useState<string | null>(null);
  const [selectedZipName, setSelectedZipName] = useState<string>('');

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

  // Carregar configurações do usuário salvas no Banco de Dados (sincronização multi-dispositivo)
  useEffect(() => {
    if (!token) return;
    const fetchUserSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const s = data.settings;
          if (s) {
            if (s.geminiApiKey) localStorage.setItem('gemini_api_key', s.geminiApiKey);
            if (s.openaiApiKey) localStorage.setItem('openai_api_key', s.openaiApiKey);
            if (s.aiProxyUrl) localStorage.setItem('ai_proxy_url', s.aiProxyUrl);
            if (s.ngrokAuthToken) localStorage.setItem('ngrok_authtoken', s.ngrokAuthToken);
            if (s.customAiModels && Array.isArray(s.customAiModels)) {
              localStorage.setItem('custom_gemini_models', JSON.stringify(s.customAiModels));
            }
            if (s.customAiSkills && Array.isArray(s.customAiSkills)) {
              localStorage.setItem('custom_ai_skills', JSON.stringify(s.customAiSkills));
            }
            if (s.savedLeads && Array.isArray(s.savedLeads)) {
              setSavedLeads(s.savedLeads);
              localStorage.setItem('builddreamer_saved_leads', JSON.stringify(s.savedLeads));
            }
            if (s.filterPresets && Array.isArray(s.filterPresets)) {
              setFilterPresets(s.filterPresets);
              localStorage.setItem('builddreamer_filter_presets', JSON.stringify(s.filterPresets));
            }
          }
        }
      } catch (e) {
        console.warn('Falha ao carregar configurações do banco:', e);
      }
    };
    fetchUserSettings();
  }, [token]);

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

  // Lead search method com Crawler Autônomo e Paginação Remota
  const handleSearchLeads = async (e?: React.FormEvent, targetPage: number = 1) => {
    if (e) e.preventDefault();
    if (!leadQuery) return;
    setLoadingLeads(true);
    setCrawlerPage(targetPage);
    setCurrentPage(1);

    try {
      // 1. Chamar Crawler Autônomo com parâmetros segmentados e página solicitada
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
          page: targetPage,
          limit: 40
        })
      });

      if (crawlerRes.ok) {
        const data = await crawlerRes.json();
        if (data.leads && Array.isArray(data.leads)) {
          setHasMoreCrawlerLeads(data.hasMore !== false);
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

  // Iniciar fluxo em 2 etapas de Melhorar com IA
  const handleStartRemasterFlow = async (leadOrUrl: { name: string; website: string } | Lead) => {
    const targetUrl = leadOrUrl.website;
    if (!targetUrl) {
      alert('Nenhum website cadastrado para este estabelecimento.');
      return;
    }

    setRemasterTargetLead(leadOrUrl as Lead);
    setRemasterWebsiteUrl(targetUrl);
    setRemasterBusinessName(leadOrUrl.name);
    setRemasterScrapingStatus('scraping');
    setRemasterProgressMsg(`Conectando e descobrindo subpáginas de ${targetUrl}...`);
    setRemasterPages([]);
    setShowRemasterModal(true);

    try {
      const res = await fetch(`${API_URL}/api/ai/remaster/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Proxy-Url': localStorage.getItem('ai_proxy_url') || ''
        },
        body: JSON.stringify({
          websiteUrl: targetUrl,
          businessName: leadOrUrl.name
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao iniciar scraping do site.');
      }

      const data = await res.json();
      setRemasterScrapeJobId(data.jobId);
    } catch (err: any) {
      console.error(err);
      setRemasterScrapingStatus('failed');
      setRemasterProgressMsg(err.message || 'Erro ao iniciar extração.');
    }
  };

  // Polling para acompanhar o status do crawler de extração do site
  useEffect(() => {
    if (!remasterScrapeJobId || remasterScrapingStatus !== 'scraping') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/ai/remaster/scrape/${remasterScrapeJobId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'completed') {
          setRemasterScrapingStatus('completed');
          setRemasterProgressMsg(data.progressMessage || 'Extração finalizada com sucesso!');
          
          const mappedPages = (data.discoveredPages || []).map((p: any) => ({
            name: p.name,
            slug: p.slug,
            url: p.url,
            customPrompt: p.isHomepage 
              ? 'Hero impactante com CTA duplo, apresentação dos diferenciais, estatísticas da empresa, depoimentos e formulário de contato/WhatsApp.'
              : `Apresentação detalhada com tópicos visuais, benefícios claros, cards ilustrativos e chamadas para ação focadas em ${p.name}.`,
            cleanText: p.cleanText || '',
            isHomepage: !!p.isHomepage,
            enabled: true
          }));

          setRemasterPages(mappedPages);
          clearInterval(interval);
        } else if (data.status === 'failed') {
          setRemasterScrapingStatus('failed');
          setRemasterProgressMsg(data.error || 'Falha durante o download das páginas.');
          clearInterval(interval);
        } else if (data.progressMessage) {
          setRemasterProgressMsg(data.progressMessage);
        }
      } catch (e) {
        console.error('Erro no polling do scraper:', e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [remasterScrapeJobId, remasterScrapingStatus, token]);

  // Executar a Geração Multi-Página com os Prompts Customizados
  const handleExecuteCustomRemaster = async () => {
    const activePages = remasterPages.filter(p => p.enabled);
    if (activePages.length === 0) {
      alert('Selecione ao menos 1 página para ser gerada.');
      return;
    }

    setGeneratingRemaster(true);

    try {
      let registeredModelIds: string[] = [];
      try {
        const stored = localStorage.getItem('custom_gemini_models');
        if (stored) registeredModelIds = JSON.parse(stored).map((m: any) => m.id);
      } catch {}

      const res = await fetch(`${API_URL}/api/ai/remaster/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Gemini-Key': localStorage.getItem('gemini_api_key') || '',
          'X-Gemini-Models': JSON.stringify(registeredModelIds),
          'X-Proxy-Url': localStorage.getItem('ai_proxy_url') || '',
          'X-AI-Skills': localStorage.getItem('custom_ai_skills') || ''
        },
        body: JSON.stringify({
          projectName: remasterBusinessName,
          globalPrompt: remasterGlobalPrompt,
          pages: activePages,
          sharedComponents: {
            repeatNavbar,
            repeatFooter
          }
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao iniciar geração do novo site.');
      }

      const newProject = await res.json();
      setProjects([newProject, ...projects]);
      setGeneratingProjectJobs(prev => ({
        ...prev,
        [newProject.id]: { status: 'processing', currentModel: 'Gerando Design System e Páginas...' }
      }));

      setShowRemasterModal(false);
      setActiveTab('projects');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGeneratingRemaster(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      if (creationMode === 'zip') {
        if (!selectedZipBase64) {
          alert('Por favor, selecione um arquivo .zip para importar.');
          setCreating(false);
          return;
        }

        const res = await fetch(`${API_URL}/api/projects/import-zip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: newProjectName || selectedZipName.replace(/\.zip$/i, '') || 'Site Importado (ZIP)',
            description: newProjectDesc || 'Projeto importado via arquivo .zip.',
            zipBase64: selectedZipBase64
          })
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Falha ao importar arquivo ZIP.');
        }

        const newProject = await res.json();
        setProjects([newProject, ...projects]);
        setShowCreateModal(false);
        onSelectProject(newProject.id);
        
        setSelectedZipBase64(null);
        setSelectedZipName('');
        setNewProjectName('');
        setNewProjectDesc('');
        return;
      }

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
          'X-Proxy-Url': localStorage.getItem('ai_proxy_url') || '',
          'X-AI-Skills': localStorage.getItem('custom_ai_skills') || ''
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
      setSelectedZipBase64(null);
      setSelectedZipName('');
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
      notify.success('Projeto excluído do banco de dados com sucesso.', 'Projeto Deletado');
    } catch (err: any) {
      notify.error(err.message || 'Erro ao excluir projeto', 'Falha');
    }
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-200 ${
      theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0c10] text-slate-100'
    }`}>
      {/* Top Navbar with Size and Minimized State Toggle */}
      <header className={`border-b sticky top-0 z-30 shrink-0 transition-all duration-300 backdrop-blur-md ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200 shadow-sm'
          : 'bg-[#0f1117]/95 border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      } ${
        navbarMinimized ? 'h-9 py-0' : navbarSize === 'compact' ? 'h-13 py-1' : navbarSize === 'large' ? 'h-18 py-2' : 'h-15 py-1.5'
      }`}>
        <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-xl border md:hidden transition-all cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Menu Lateral"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <div className={`w-8 h-8 rounded-xl overflow-hidden border shrink-0 flex items-center justify-center shadow-inner ${
              theme === 'light' ? 'border-amber-600/30 bg-amber-50' : 'border-amber-500/30 bg-black/40'
            }`}>
              <img src="/logo.png" alt="Real Premise" className="w-full h-full object-cover" />
            </div>
            {!navbarMinimized && (
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-sm sm:text-base tracking-wider ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}>REAL PREMISE</span>
                <span className={`hidden sm:inline-block px-2 py-0.5 rounded-md border text-[9px] font-mono tracking-widest ${
                  theme === 'light'
                    ? 'border-slate-300 bg-slate-100 text-slate-600 font-semibold'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300'
                }`}>STUDIO</span>
              </div>
            )}
          </div>

          {/* Quick Actions & Topbar Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            {/* Botão de Conexão Ngrok do Sistema */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleToggleNgrok}
                disabled={ngrokLoading || ngrokStatus === 'starting'}
                className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  ngrokOnline
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                    : ngrokStatus === 'starting'
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                    : theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
                title={
                  ngrokOnline 
                    ? `Sistema Online no Ngrok (${ngrokUrl}) - Clique para desligar` 
                    : ngrokStatus === 'starting' 
                    ? 'Iniciando túnel do Ngrok em background...' 
                    : 'Subir URL do sistema no Ngrok para acesso externo e previews'
                }
              >
                {ngrokLoading || ngrokStatus === 'starting' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span className="hidden sm:inline">Conectando...</span>
                  </>
                ) : ngrokOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Ngrok Online</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Ligar Ngrok</span>
                  </>
                )}
              </button>

              {ngrokOnline && ngrokUrl && (
                <a
                  href={ngrokUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-2.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 hover:bg-slate-850 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  title="Abrir Dashboard no Link Público do Ngrok"
                >
                  <span className="max-w-[130px] truncate hidden md:inline">{ngrokUrl.replace('https://', '')}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              )}
            </div>

            {/* Alternador de Modo Escuro / Claro */}
            <button
              onClick={toggleTheme}
              className={`h-9 px-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
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

            {/* Controles de Visibilidade da Barra Lateral (Ícones / Ocultar) */}
            <div className="hidden md:flex items-center gap-1 p-0.5 h-9 border rounded-xl bg-slate-950/40 border-slate-800">
              <button
                onClick={() => {
                  if (sidebarHidden) {
                    setSidebarHidden(false);
                    setSidebarCollapsed(true);
                  } else {
                    setSidebarCollapsed(!sidebarCollapsed);
                  }
                }}
                className={`h-7 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  sidebarCollapsed && !sidebarHidden
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850'
                }`}
                title={sidebarCollapsed ? "Expandir Menu Lateral (Mostrar Textos)" : "Menu Lateral Compacto (Apenas Ícones)"}
              >
                <Minimize2 className={`w-3.5 h-3.5 ${sidebarCollapsed ? 'text-white' : ''}`} />
                <span className="text-[10px] hidden xl:inline font-mono">
                  {sidebarCollapsed ? "Expandir" : "Ícones"}
                </span>
              </button>

              <button
                onClick={() => setSidebarHidden(!sidebarHidden)}
                className={`h-7 px-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  sidebarHidden
                    ? 'bg-amber-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850'
                }`}
                title={sidebarHidden ? "Mostrar Menu Lateral" : "Ocultar Menu Lateral Totalmente (Ganhar Espaço Máximo)"}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden xl:inline font-mono">
                  {sidebarHidden ? "Mostrar Barra" : "Ocultar"}
                </span>
              </button>
            </div>

            {/* Botão de Minimizar Cabeçalho */}
            <button
              onClick={() => setNavbarMinimized(!navbarMinimized)}
              className={`w-9 h-9 border rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title={navbarMinimized ? "Expandir Barra Superior" : "Minimizar Barra Superior"}
            >
              {navbarMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            {/* Menu Dropdown do Usuário */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`h-9 flex items-center gap-2.5 p-1 pl-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
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
                    <p className={`text-[9px] font-mono leading-tight ${
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
                      onClick={() => { setShowUserDropdown(false); setActiveTab('settings'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 rounded-xl transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-purple-400" />
                      Configurações & Preferências
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
                <button
                  onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'settings' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                  }`}
                >
                  <Settings className="w-4 h-4 text-purple-400" />
                  Configurações
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Left Navigation Sidebar with Collapse (Icons Only), Hide & Drag-to-Resize Handle */}
        {!sidebarHidden && (
          <aside 
            style={{ width: sidebarCollapsed ? '64px' : `${sidebarWidth}px` }}
            className={`border-r flex flex-col justify-between shrink-0 ${
              sidebarCollapsed ? 'p-2' : 'p-4'
            } hidden md:flex relative select-none transition-[width,padding] duration-200 ${
              theme === 'light'
                ? 'bg-white border-slate-200'
                : 'bg-[#0b0d13] border-slate-800/80'
            }`}
          >
            <div className="space-y-1">
              {/* Toggle Collapse/Expand Header on Sidebar */}
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center pb-3' : 'justify-between pb-2'} border-b border-slate-850/60 mb-2`}>
                {!sidebarCollapsed && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    Navegação
                  </span>
                )}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
                  title={sidebarCollapsed ? "Expandir barra lateral (Mostrar texto)" : "Diminuir barra lateral (Apenas ícones)"}
                >
                  <Minimize2 className={`w-3.5 h-3.5 ${sidebarCollapsed ? 'rotate-90 text-purple-400' : ''}`} />
                </button>
              </div>

              {/* Seção 1: Criação & Projetos */}
              {!sidebarCollapsed ? (
                <div className={`pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Principal
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'general'
                    ? theme === 'light'
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'bg-slate-800 text-white font-bold'
                    : theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title="Visão Geral"
              >
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Visão Geral</span>}
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'projects'
                    ? theme === 'light'
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'bg-slate-800 text-white font-bold'
                    : theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title="Meus Sites"
              >
                <Layout className="w-4 h-4 text-indigo-400 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate flex-1 text-left">Meus Sites</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {projects.length}
                    </span>
                  </>
                )}
              </button>
              
              {/* Seção 2: CRM & Vendas */}
              {!sidebarCollapsed ? (
                <div className={`pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Vendas & CRM
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('crm')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'crm'
                    ? theme === 'light'
                      ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm'
                      : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-bold shadow-sm'
                    : theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title="Funil de Vendas"
              >
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate flex-1 text-left">Funil de Vendas</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-bold">
                      CRM
                    </span>
                  </>
                )}
              </button>

              {/* Seção 3: Prospecção & Captação */}
              {!sidebarCollapsed ? (
                <div className={`pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Prospecção
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('leads')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'leads'
                    ? theme === 'light'
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'bg-slate-800 text-white font-bold'
                    : theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title="Buscador de Clientes"
              >
                <Users className="w-4 h-4 text-sky-400 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Buscador de Clientes</span>}
              </button>

              <button
                onClick={() => setActiveTab('saved-leads')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5 relative' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'saved-leads'
                    ? theme === 'light'
                      ? 'bg-amber-50 text-amber-800 font-bold'
                      : 'bg-slate-800 text-amber-300 font-bold'
                    : theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title={`Leads Salvos (${savedLeads.length})`}
              >
                <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
                {!sidebarCollapsed ? (
                  <>
                    <span className="truncate flex-1 text-left">Leads Salvos</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      theme === 'light' ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                    }`}>
                      {savedLeads.length}
                    </span>
                  </>
                ) : savedLeads.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('presets')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5 relative' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'presets'
                    ? theme === 'light'
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'bg-slate-800 text-white font-bold'
                    : theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title={`Filtros Salvos (${filterPresets.length})`}
              >
                <SlidersHorizontal className="w-4 h-4 text-indigo-400 shrink-0" />
                {!sidebarCollapsed ? (
                  <>
                    <span className="truncate flex-1 text-left">Filtros Salvos</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {filterPresets.length}
                    </span>
                  </>
                ) : filterPresets.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
                )}
              </button>

              {/* Seção 4: Configurações & Conta */}
              {!sidebarCollapsed ? (
                <div className={`pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${
                  theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Geral
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? theme === 'light'
                      ? 'bg-purple-50 text-purple-700 font-bold'
                      : 'bg-gradient-to-r from-purple-900/50 to-indigo-900/50 text-white font-bold border border-purple-500/40 shadow-sm'
                    : theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
                title="Configurações"
              >
                <Settings className="w-4 h-4 text-purple-400 shrink-0" />
                {!sidebarCollapsed && <span className="truncate flex-1 text-left">Configurações</span>}
              </button>
            </div>

            {/* Rodapé da Sidebar: Exibe link do Ngrok apenas quando online */}
            {!sidebarCollapsed && ngrokOnline && ngrokUrl && (
              <div className={`p-3 border rounded-xl animate-in fade-in duration-200 ${
                theme === 'light' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/30 border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      theme === 'light' ? 'text-emerald-800' : 'text-emerald-400'
                    }`}>Ngrok Online</span>
                  </div>
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <a
                  href={ngrokUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-xs font-mono truncate block hover:underline transition-colors flex items-center justify-between gap-1 ${
                    theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'
                  }`}
                  title={ngrokUrl}
                >
                  <span className="truncate">{ngrokUrl.replace('https://', '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}

            {/* Draggable Resize Divider */}
            {!sidebarCollapsed && (
              <div
                onMouseDown={() => setIsResizingSidebar(true)}
                className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-20 group flex items-center justify-center hover:bg-purple-500/20 transition-all"
                title="Arrastar para redimensionar barra lateral"
              >
                <div className="w-1 h-8 rounded-full bg-slate-700 group-hover:bg-purple-400 transition-colors" />
              </div>
            )}
          </aside>
        )}

        {/* Floating Trigger to Restore Sidebar when Hidden */}
        {sidebarHidden && (
          <div className="absolute left-3 top-3 z-30 animate-in fade-in slide-in-from-left duration-200">
            <button
              onClick={() => { setSidebarHidden(false); setSidebarCollapsed(false); }}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-900/40 shadow-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-2"
              title="Mostrar Barra Lateral de Navegação"
            >
              <Menu className="w-4 h-4" />
              <span className="text-xs font-semibold hidden sm:inline">Mostrar Menu</span>
            </button>
          </div>
        )}

        {/* Dynamic Content Panel */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          {activeTab === 'general' ? (
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Header com Boas-Vindas e Ação Principal */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                    Visão Geral da Plataforma
                  </h1>
                  <p className="text-slate-400 mt-1">
                    Central de comando: crie sites com IA, prospecte clientes e publique em produção.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => { setCreationMode('ai'); setShowCreateModal(true); }}
                    className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    Criar Site com IA
                  </button>
                  <button
                    onClick={() => setActiveTab('leads')}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-pink-400" />
                    Buscar Novos Leads
                  </button>
                </div>
              </div>

              {/* Status & Estatísticas em Grid Principal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total de Projetos */}
                <div 
                  onClick={() => setActiveTab('projects')}
                  className="bg-[#0f0b18] border border-slate-850 hover:border-purple-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer transition-all"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total de Sites</span>
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Layout className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-white mt-2">{projects.length}</p>
                  <span className="text-[11px] text-purple-400 font-medium flex items-center gap-1 mt-2">
                    Gerenciar projetos <ChevronRight className="w-3 h-3" />
                  </span>
                </div>

                {/* CRM de Vendas de Sites */}
                <div 
                  onClick={() => setActiveTab('crm')}
                  className="bg-[#0f0b18] border border-slate-850 hover:border-emerald-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer transition-all"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">CRM de Vendas</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-emerald-400 mt-2">Pipeline</p>
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-2">
                    Acessar Funil de Vendas <ChevronRight className="w-3 h-3" />
                  </span>
                </div>

                {/* Leads Prospectados & Salvos */}
                <div 
                  onClick={() => setActiveTab('saved-leads')}
                  className="bg-[#0f0b18] border border-slate-850 hover:border-amber-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer transition-all"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Leads Salvos</span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Bookmark className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-black text-white mt-2">{savedLeads.length}</p>
                  <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-2">
                    Ver oportunidades <ChevronRight className="w-3 h-3" />
                  </span>
                </div>

                {/* Status do Servidor e Deploy */}
                <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Servidor FTP</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Server className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]" />
                    Conectado
                  </p>
                  <span className="text-[11px] text-slate-500 font-mono mt-2 block">
                    Sync Sandbox Live
                  </span>
                </div>
              </div>

              {/* Seção Central: Ações Rápidas & IA Copilot Pipeline */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Card de Atalhos Rápidos */}
                <div className="lg:col-span-2 bg-[#0f0b18] border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-400" />
                    Fluxos Rápidos de Produção
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => { setCreationMode('ai'); setShowCreateModal(true); }}
                      className="p-4 bg-slate-950 border border-slate-800/80 hover:border-purple-500/50 rounded-xl text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Zap className="w-4 h-4" />
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 transition-colors" />
                      </div>
                      <span className="font-bold text-white text-sm block">Gerar Site Completo com IA</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">Crie Home e subpáginas com base no nicho</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('leads')}
                      className="p-4 bg-slate-950 border border-slate-800/80 hover:border-pink-500/50 rounded-xl text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="p-2 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
                          <Users className="w-4 h-4" />
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-pink-400 transition-colors" />
                      </div>
                      <span className="font-bold text-white text-sm block">Buscador de Clientes Locais</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">Prospecte comércios sem website e WhatsApp</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('presets')}
                      className="p-4 bg-slate-950 border border-slate-800/80 hover:border-cyan-500/50 rounded-xl text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <SlidersHorizontal className="w-4 h-4" />
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <span className="font-bold text-white text-sm block">Filtros Pré-Configurados</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">Buscas automatizadas com 1 clique</span>
                    </button>

                    <button
                      onClick={() => setShowSettings(true)}
                      className="p-4 bg-slate-950 border border-slate-800/80 hover:border-amber-500/50 rounded-xl text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Settings className="w-4 h-4" />
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
                      </div>
                      <span className="font-bold text-white text-sm block">Configurar IA & Proxies</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">Chaves de API do Gemini e Proxies</span>
                    </button>
                  </div>
                </div>

                {/* Painel Lateral: Atalhos Rápidos e Estatísticas de Conversão */}
                <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-white text-base flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-400" />
                        Ações Rápidas
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => { setCreationMode('ai'); setShowCreateModal(true); }}
                        className="w-full p-3 bg-slate-950 hover:bg-purple-950/30 border border-slate-800 hover:border-purple-500/40 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <div>
                            <span className="text-xs font-bold text-white block">Novo Site com IA</span>
                            <span className="text-[10px] text-slate-500">Crie páginas completas em segundos</span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 transition-colors" />
                      </button>

                      <button
                        onClick={() => setActiveTab('leads')}
                        className="w-full p-3 bg-slate-950 hover:bg-pink-950/30 border border-slate-800 hover:border-pink-500/40 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-pink-400" />
                          <div>
                            <span className="text-xs font-bold text-white block">Prospectar Empresas</span>
                            <span className="text-[10px] text-slate-500">Varredura no Google Maps</span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-pink-400 transition-colors" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('projects')}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all text-center cursor-pointer"
                  >
                    Ver Todos os Projetos
                  </button>
                </div>
              </div>

              {/* Projetos Recentes */}
              {projects.length > 0 && (
                <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Layout className="w-5 h-5 text-purple-400" />
                      Projetos Recentes
                    </h3>
                    <button
                      onClick={() => setActiveTab('projects')}
                      className="text-xs font-bold text-purple-400 hover:underline flex items-center gap-1"
                    >
                      Ver Todos ({projects.length}) <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {projects.slice(0, 3).map(p => (
                      <div
                        key={p.id}
                        onClick={() => onSelectProject(p.id)}
                        className="p-4 bg-slate-950 border border-slate-800/80 hover:border-purple-500/40 rounded-xl space-y-2 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors truncate">{p.name}</h4>
                          <span className="text-[10px] px-2 py-0.5 bg-purple-950/60 text-purple-300 border border-purple-500/30 rounded-full font-mono">
                            {p.pages?.length || 1} pág(s)
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1">{p.description || 'Site criado no Real Premise'}</p>
                        <span className="text-[10px] text-slate-500 block">Atualizado em: {new Date(p.updatedAt || p.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openProjectDetailsModal(project);
                              }}
                              className="p-1.5 text-slate-400 hover:text-purple-300 rounded-lg hover:bg-purple-950/40 border border-transparent hover:border-purple-500/30 transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                              title="Ver informações e editar projeto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="font-semibold">Editar</span>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id, e);
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-850 transition-all cursor-pointer"
                              title="Deletar projeto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setShowManualLeadModal(true)}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-yellow-500/20 flex items-center gap-2 cursor-pointer"
                    title="Cadastrar um novo lead manualmente"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Lead Manual
                  </button>
                  <button
                    onClick={() => setActiveTab('leads')}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    Buscar no Maps
                  </button>
                </div>
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

                                        {/* Botão: Gerar Site Normal */}
                                        <button
                                          onClick={() => handleCreateProjectFromLead(lead)}
                                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                                        >
                                          <Sparkles className="w-3.5 h-3.5" />
                                          Gerar Site
                                        </button>

                                        {/* Botão: Melhorar com IA (Apenas se tiver website) */}
                                        {lead.website && (
                                          <button
                                            onClick={() => handleStartRemasterFlow(lead)}
                                            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer flex items-center gap-1"
                                            title="Analisar todas as páginas e subpáginas e recriar versão moderna com IA"
                                          >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Melhorar com IA
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
                                   className="px-3.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 text-xs font-bold text-indigo-200 hover:text-white rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1"
                                 >
                                   <Layout className="w-3.5 h-3.5" />
                                   Gerar Site
                                 </button>
                                 {lead.website && (
                                   <button
                                     onClick={() => handleStartRemasterFlow(lead)}
                                     className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-md shadow-purple-600/20 flex items-center gap-1"
                                     title="Analisar site original e remasterizar com IA"
                                   >
                                     <Sparkles className="w-3.5 h-3.5" />
                                     Melhorar com IA
                                   </button>
                                 )}
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
          ) : activeTab === 'crm' ? (
            /* CRM DE VENDAS DE SITES */
            <CRMManager
              onOpenRemasterModal={(lead) => handleStartRemasterFlow(lead as any)}
              onOpenProject={(projId) => onSelectProject(projId)}
              projects={projects}
            />
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
          ) : activeTab === 'leads' ? (
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

                {/* Barra de Filtros Rápidos & Painel Expansível de Filtros Avançados */}
                <div className="pt-2.5 border-t border-slate-900 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                      <input 
                        type="checkbox"
                        checked={onlyWithoutWebsite}
                        onChange={(e) => setOnlyWithoutWebsite(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span>Apenas <strong>Sem Website</strong> (Oportunidades)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none hover:text-white transition-colors">
                      <input 
                        type="checkbox"
                        checked={hasPhoneOnly}
                        onChange={(e) => setHasPhoneOnly(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span>Com <strong>Telefone/WhatsApp</strong></span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        showAdvancedFilters || minRating !== '0' || minReviews !== '0'
                          ? 'bg-purple-950/40 border-purple-500/50 text-purple-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Filtros Avançados</span>
                      {minRating !== '0' || minReviews !== '0' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      ) : null}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-slate-500">Ordenar por:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
                    >
                      <option value="rating">Melhor Avaliados ★</option>
                      <option value="reviews">Mais Avaliações (Popularidade)</option>
                      <option value="name">Nome (A–Z)</option>
                    </select>
                  </div>
                </div>

                {/* Gaveta de Filtros Avançados */}
                {showAdvancedFilters && (
                  <div className="p-4 bg-slate-950/70 border border-purple-500/20 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-in fade-in zoom-in-95 duration-150">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">Avaliação Mínima Google</label>
                      <select
                        value={minRating}
                        onChange={(e) => setMinRating(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="0">Qualquer nota</option>
                        <option value="3.5">★ 3.5 ou mais</option>
                        <option value="4.0">★ 4.0 ou mais</option>
                        <option value="4.5">★ 4.5 ou mais</option>
                        <option value="4.8">★ 4.8 ou mais</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">Mínimo de Avaliações / Reviews</label>
                      <select
                        value={minReviews}
                        onChange={(e) => setMinReviews(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="0">Qualquer quantidade</option>
                        <option value="10">Mais de 10 avaliações</option>
                        <option value="30">Mais de 30 avaliações</option>
                        <option value="50">Mais de 50 avaliações</option>
                        <option value="100">Mais de 100 avaliações</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          setMinRating('0');
                          setMinReviews('0');
                          setOnlyWithoutWebsite(false);
                          setHasPhoneOnly(false);
                        }}
                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      >
                        Limpar Filtros Avançados
                      </button>
                    </div>
                  </div>
                )}
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
                  {(() => {
                    // Filtra e Ordena os leads dinamicamente
                    const filteredAndSorted = leadsList
                      .filter(lead => {
                        if (onlyWithoutWebsite && (lead.hasWebsite || lead.website)) return false;
                        if (hasPhoneOnly && (!lead.phone || lead.phone === 'Não informado')) return false;
                        if (minRating !== '0' && parseFloat(lead.rating || '0') < parseFloat(minRating)) return false;
                        if (minReviews !== '0' && (lead.totalReviews || 0) < parseInt(minReviews)) return false;
                        return true;
                      })
                      .sort((a, b) => {
                        if (sortBy === 'rating') {
                          return parseFloat(b.rating || '0') - parseFloat(a.rating || '0');
                        }
                        if (sortBy === 'reviews') {
                          return (b.totalReviews || 0) - (a.totalReviews || 0);
                        }
                        if (sortBy === 'name') {
                          return a.name.localeCompare(b.name);
                        }
                        return 0;
                      });

                    const totalItems = filteredAndSorted.length;
                    const paginatedLeads = filteredAndSorted.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

                    return (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f0b18] border border-slate-850 px-4 py-3 rounded-2xl text-xs">
                          <div className="flex items-center gap-2 text-slate-400">
                            <span>
                              Exibindo <strong>{totalItems > 0 ? (currentPage - 1) * leadsPerPage + 1 : 0}</strong>–<strong>{Math.min(currentPage * leadsPerPage, totalItems)}</strong> de <strong>{totalItems}</strong> estabelecimentos
                            </span>
                            {totalItems !== leadsList.length && (
                              <span className="text-[10px] bg-purple-950/40 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md font-mono">
                                (filtrado de {leadsList.length})
                              </span>
                            )}
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
                                  {paginatedLeads.map(lead => {
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
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-lg text-xs font-bold">
                                          <Star className="w-3 h-3 fill-yellow-400" />
                                          {lead.rating}
                                        </span>
                                        {lead.totalReviews !== undefined && (
                                          <span className="text-[10px] text-slate-500 font-mono">
                                            ({lead.totalReviews} avaliações)
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {/* Botão Ver no Maps */}
                                        <a
                                          href={mapsSearchUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-2 bg-slate-900 hover:bg-pink-950/40 border border-slate-800 hover:border-pink-500/40 text-pink-400 rounded-xl transition-all shadow-sm"
                                          title="Ver localização no Google Maps"
                                        >
                                          <MapPin className="w-4 h-4" />
                                        </a>

                                        {/* WhatsApp */}
                                        {lead.whatsappUrl && (
                                          <a
                                            href={lead.whatsappUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-400 rounded-xl transition-all shadow-sm"
                                            title={`Conversar com ${lead.name} no WhatsApp`}
                                          >
                                            <Phone className="w-4 h-4" />
                                          </a>
                                        )}

                                        {/* Salvar Lead */}
                                        <button
                                          onClick={() => handleToggleSaveLead(lead)}
                                          className={`p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                                            isSaved 
                                              ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' 
                                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-yellow-400 hover:border-yellow-500/30'
                                          }`}
                                          title={isSaved ? 'Lead salvo nos favoritos (clique para remover)' : 'Salvar lead nos favoritos'}
                                        >
                                          {isSaved ? <BookmarkCheck className="w-4 h-4 fill-yellow-400" /> : <Bookmark className="w-4 h-4" />}
                                        </button>

                                        {/* Botão: Gerar Site Normal */}
                                        <button
                                          onClick={() => handleCreateProjectFromLead(lead)}
                                          className="p-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-xl transition-all shadow-sm cursor-pointer"
                                          title="Gerar Site Completo para este Estabelecimento"
                                        >
                                          <Layout className="w-4 h-4" />
                                        </button>

                                        {/* Botão: Melhorar com IA (Apenas se o cliente tiver website) */}
                                        {lead.website && (
                                           <button
                                             onClick={() => handleStartRemasterFlow(lead)}
                                             className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition-all shadow-md hover:shadow-purple-500/30 cursor-pointer"
                                             title={`Melhorar com IA: Analisar páginas de ${lead.website} e reconstruir com prompts customizados`}
                                           >
                                             <Sparkles className="w-4 h-4" />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paginatedLeads.map(lead => {
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

                              {lead.openingHours && (
                                <p className="text-[11px] text-emerald-400/90 flex items-center gap-1.5 font-sans">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                  <span>{lead.openingHours}</span>
                                </p>
                              )}

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
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={mapsSearchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-slate-900 hover:bg-pink-950/40 border border-slate-800 hover:border-pink-500/40 text-pink-400 rounded-xl transition-all shadow-sm"
                                  title="Ver localização no Google Maps"
                                >
                                  <MapPin className="w-4 h-4" />
                                </a>
                                {lead.whatsappUrl && (
                                  <a
                                    href={lead.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-400 rounded-xl transition-all shadow-sm"
                                    title={`Conversar com ${lead.name} no WhatsApp`}
                                  >
                                    <Phone className="w-4 h-4" />
                                  </a>
                                )}
                                
                                {/* Botão: Gerar Site Normal */}
                                <button
                                  onClick={() => handleCreateProjectFromLead(lead)}
                                  className="p-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-xl transition-all shadow-sm cursor-pointer"
                                  title="Gerar Site Completo para este Estabelecimento"
                                >
                                  <Layout className="w-4 h-4" />
                                </button>

                                {/* Botão: Melhorar com IA (Apenas se o cliente tiver website) */}
                                {lead.website && (
                                   <button
                                     onClick={() => handleStartRemasterFlow(lead)}
                                     className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition-all shadow-md hover:shadow-purple-500/30 cursor-pointer"
                                     title={`Melhorar com IA: Analisar páginas de ${lead.website} e reconstruir com prompts customizados`}
                                   >
                                     <Sparkles className="w-4 h-4" />
                                   </button>
                                 )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Controles de Navegação e Busca de Novas Páginas do Google Maps */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-850">
                    {/* Paginação Local dos Leads Atuais */}
                    {Math.ceil(totalItems / leadsPerPage) > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          Anterior
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.ceil(totalItems / leadsPerPage) }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
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
                          onClick={() => setCurrentPage(p => Math.min(p + 1, Math.ceil(totalItems / leadsPerPage)))}
                          disabled={currentPage === Math.ceil(totalItems / leadsPerPage)}
                          className="px-3 py-1.5 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          Próxima
                        </button>
                      </div>
                    )}

                    {/* Paginação Contínua/Infinita do Motor Google Maps */}
                    <div className="flex items-center gap-3 ml-auto">
                      <div className="text-xs text-slate-400 font-medium">
                        Lote Google Maps: <strong className="text-purple-400 font-mono">Página {crawlerPage}</strong>
                      </div>

                      {crawlerPage > 1 && (
                        <button
                          onClick={() => handleSearchLeads(undefined, crawlerPage - 1)}
                          disabled={loadingLeads}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          ← Página Anterior do Maps
                        </button>
                      )}

                      <button
                        onClick={() => handleSearchLeads(undefined, crawlerPage + 1)}
                        disabled={loadingLeads || !hasMoreCrawlerLeads}
                        className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Busca o próximo lote de clientes diretamente no Google Maps"
                      >
                        {loadingLeads ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Raspando Lote {crawlerPage + 1}...
                          </>
                        ) : (
                          <>
                            <span>Próxima Página do Maps ({crawlerPage + 1})</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
                </div>
              )}
            </div>
          ) : activeTab === 'settings' ? (
            /* PÁGINA NATIVA DE CONFIGURAÇÕES DO SISTEMA */
            <SettingsPage />
          ) : null}
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
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-955 border border-slate-850 rounded-xl mb-6">
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
              <button 
                type="button"
                onClick={() => setCreationMode('zip')}
                className={`py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${creationMode === 'zip' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Upload className="w-3 h-3" />
                ZIP
              </button>
            </div>

            {/* Modal Form inputs conditionally */}
            <form onSubmit={handleCreateProject} className="space-y-4">
              {creationMode === 'zip' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Arquivo ZIP do Site</label>
                    <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 text-center transition-all bg-slate-950/50">
                      <input 
                        type="file" 
                        id="dashboard-zip-input"
                        accept=".zip"
                        required={!selectedZipBase64}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.name.endsWith('.zip')) {
                            alert('Selecione um arquivo .zip');
                            return;
                          }
                          setSelectedZipName(file.name);
                          if (!newProjectName) {
                            setNewProjectName(file.name.replace(/\.zip$/i, ''));
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setSelectedZipBase64(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                      <label htmlFor="dashboard-zip-input" className="cursor-pointer flex flex-col items-center justify-center">
                        <FileArchive className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
                        {selectedZipName ? (
                          <>
                            <span className="text-sm font-bold text-cyan-300">{selectedZipName}</span>
                            <span className="text-[11px] text-slate-400 mt-1">Clique para trocar de arquivo</span>
                          </>
                        ) : (
                          <>
                            <span className="text-sm font-bold text-white">Clique para selecionar seu arquivo .ZIP</span>
                            <span className="text-[11px] text-slate-400 mt-1">Extrai automaticamente todas as páginas HTML, CSS e JS</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Nome do Projeto</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Site Exportado"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">Descrição (Opcional)</label>
                    <textarea 
                      placeholder="Ex: Site importado para edição e preview no Ngrok"
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm text-white resize-none"
                    />
                  </div>
                </div>
              ) : creationMode === 'ai' ? (
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

      {/* Modal de Remasterização Inteligente em 2 Etapas (Scraping + Planejador de Prompts por Página e Navbar Compartilhada) */}
      {showRemasterModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-4xl bg-[#0d0a17] border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-purple-950/60 to-slate-900 border-b border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Remasterizador & Modernizador com IA
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40 font-mono">
                      Fluxo Inteligente
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {remasterBusinessName} • <span className="font-mono text-cyan-400">{remasterWebsiteUrl}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRemasterModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 pr-3">
              
              {/* ETAPA 1: Status do Crawler / Scraping */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-400" />
                    Etapa 1: Varredura e Download das Páginas Existentes
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                    remasterScrapingStatus === 'scraping' 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      : remasterScrapingStatus === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {remasterScrapingStatus === 'scraping' ? 'Extraindo...' : remasterScrapingStatus === 'completed' ? 'Concluído' : 'Atenção'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {remasterScrapingStatus === 'scraping' && (
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  )}
                  <p className="text-xs text-slate-300 font-mono">
                    {remasterProgressMsg}
                  </p>
                </div>
              </div>

              {/* ETAPA 2: Configuração de Prompts e Componentes (Disponível quando o scraping conclui) */}
              {remasterScrapingStatus === 'completed' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  
                  {/* Prompt Global do Site */}
                  <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-2">
                    <label className="block text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        Prompt Principal do Site (Aplica-se a Todas as Páginas)
                      </span>
                      <span className="text-[10px] text-purple-300 font-normal lowercase italic">estilo, paleta e tom de voz</span>
                    </label>
                    <textarea
                      rows={2}
                      value={remasterGlobalPrompt}
                      onChange={(e) => setRemasterGlobalPrompt(e.target.value)}
                      placeholder="Ex: Tema moderno escuro com neon cyan, tipografia Inter, seções de alto impacto, animações e botão de WhatsApp..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none leading-relaxed"
                    />
                  </div>

                  {/* Componentes Compartilhados Universais (Não duplicar geração) */}
                  <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Code2 className="w-4 h-4 text-purple-400" />
                          Componentes Compartilhados Universais (Sem Duplicação)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          A IA gera a Navbar e o Footer apenas 1 vez na Home e os integra de forma idêntica e consistente em todas as subpáginas.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <label className="flex items-center gap-2 p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl cursor-pointer hover:border-purple-500/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={repeatNavbar}
                          onChange={(e) => setRepeatNavbar(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="text-xs text-slate-200">
                          <span className="font-semibold block">Navbar Universal Idêntica</span>
                          <span className="text-[10px] text-slate-400">Mesma logo, menu de navegação e botões em todas as páginas</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl cursor-pointer hover:border-purple-500/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={repeatFooter}
                          onChange={(e) => setRepeatFooter(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                        />
                        <div className="text-xs text-slate-200">
                          <span className="font-semibold block">Footer Universal Idêntico</span>
                          <span className="text-[10px] text-slate-400">Mesmos links rápidos, copyright e canais de contato na base</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Lista de Páginas com Prompt Individual */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Layout className="w-4 h-4 text-pink-400" />
                        Páginas Identificadas & Prompts Individuais ({remasterPages.filter(p => p.enabled).length}/{remasterPages.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const newSlug = `pagina-${remasterPages.length + 1}`;
                          setRemasterPages([...remasterPages, {
                            name: `Nova Página ${remasterPages.length + 1}`,
                            slug: newSlug,
                            customPrompt: 'Apresente os detalhes desta nova seção com design harmônico e interativo.',
                            cleanText: '',
                            isHomepage: false,
                            enabled: true
                          }]);
                        }}
                        className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar Subpágina
                      </button>
                    </div>

                    <div className="space-y-3">
                      {remasterPages.map((page, idx) => (
                        <div 
                          key={idx}
                          className={`p-3.5 border rounded-xl transition-all space-y-2.5 ${
                            page.enabled 
                              ? 'bg-slate-950 border-purple-500/30 shadow-sm' 
                              : 'bg-slate-950/40 border-slate-850 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={page.enabled}
                                onChange={(e) => {
                                  const updated = [...remasterPages];
                                  updated[idx].enabled = e.target.checked;
                                  setRemasterPages(updated);
                                }}
                                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={page.name}
                                onChange={(e) => {
                                  const updated = [...remasterPages];
                                  updated[idx].name = e.target.value;
                                  setRemasterPages(updated);
                                }}
                                className="bg-transparent font-bold text-xs text-white border-b border-transparent hover:border-purple-500 focus:border-purple-500 focus:outline-none px-1"
                              />
                              <span className="text-[10px] text-slate-500 font-mono">
                                (/{page.slug}.html)
                              </span>
                              {page.isHomepage && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-950 text-pink-300 border border-pink-500/30 font-mono uppercase">
                                  Home Principal
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {!page.isHomepage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemasterPages(remasterPages.filter((_, i) => i !== idx));
                                  }}
                                  className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                                  title="Remover esta página do plano"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Campo de Prompt Específico para esta página */}
                          {page.enabled && (
                            <div className="space-y-1">
                              <label className="block text-[10px] text-slate-400 flex items-center justify-between">
                                <span>Prompt Específico para a página "{page.name}":</span>
                                {page.cleanText && (
                                  <span className="text-[9px] text-emerald-400 font-mono">
                                    ✓ Conteúdo original extraído ({page.cleanText.length} carac.)
                                  </span>
                                )}
                              </label>
                              <textarea
                                rows={2}
                                value={page.customPrompt}
                                onChange={(e) => {
                                  const updated = [...remasterPages];
                                  updated[idx].customPrompt = e.target.value;
                                  setRemasterPages(updated);
                                }}
                                placeholder={`Descreva o que deseja que a IA implemente especificamente na página ${page.name}...`}
                                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-sans focus:border-purple-500 focus:outline-none leading-relaxed"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-purple-500/20 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">
                {remasterScrapingStatus === 'completed' 
                  ? `${remasterPages.filter(p => p.enabled).length} páginas prontas para geração sincronizada`
                  : 'Aguardando conclusão do crawler...'
                }
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRemasterModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                
                <button
                  type="button"
                  disabled={remasterScrapingStatus !== 'completed' || generatingRemaster}
                  onClick={handleExecuteCustomRemaster}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingRemaster ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Iniciando Criação...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Continuar e Gerar Novo Site com IA
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Cadastro Manual de Lead */}
      {showManualLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg bg-[#0d0a17] border border-yellow-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-yellow-950/40 to-slate-900 border-b border-yellow-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-yellow-500 text-slate-950 shadow-lg shadow-yellow-500/30">
                  <BookmarkCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Cadastrar Lead Manualmente
                  </h3>
                  <p className="text-xs text-slate-400">Adicione um novo cliente aos seus favoritos.</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualLeadModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddManualLead} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome do Estabelecimento / Empresa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Padaria Central Pão Quente"
                  value={manualLeadName}
                  onChange={(e) => setManualLeadName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nicho / Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Padaria, Dentista, Barbearia"
                    value={manualLeadCategory}
                    onChange={(e) => setManualLeadCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (61) 98765-4321"
                    value={manualLeadPhone}
                    onChange={(e) => setManualLeadPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Website Atual (Opcional)</span>
                  <span className="text-[10px] text-cyan-400 font-normal lowercase italic">se preenchido, habilita o 'Melhorar com IA'</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: https://meusiteantigo.com.br"
                  value={manualLeadWebsite}
                  onChange={(e) => setManualLeadWebsite(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Endereço Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Av. Central, 123, Centro"
                    value={manualLeadAddress}
                    onChange={(e) => setManualLeadAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Cidade
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Brasília"
                    value={manualLeadCity}
                    onChange={(e) => setManualLeadCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowManualLeadModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-yellow-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Salvar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Informações e Edição do Projeto */}
      {showProjectModal && selectedProjectDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-purple-950/40 to-slate-900 border-b border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-600/30">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Informações do Projeto
                  </h3>
                  <p className="text-xs text-slate-400">Edite as configurações, nome, status e visualize metadados.</p>
                </div>
              </div>
              <button
                onClick={() => setShowProjectModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form & Info */}
            <form onSubmit={handleSaveProjectDetails} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nome do Projeto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Landing Page Tech"
                    value={editingProjectForm.name}
                    onChange={(e) => setEditingProjectForm({ ...editingProjectForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Status de Publicação
                  </label>
                  <select
                    value={editingProjectForm.status}
                    onChange={(e) => setEditingProjectForm({ ...editingProjectForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="development">Em Desenvolvimento (Rascunho)</option>
                    <option value="published">Publicado / Ativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Descrição do Negócio / Site
                </label>
                <textarea
                  rows={3}
                  placeholder="Breve descrição dos serviços ou objetivo do site..."
                  value={editingProjectForm.description}
                  onChange={(e) => setEditingProjectForm({ ...editingProjectForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Domínio Customizado (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: meusite.com.br"
                  value={editingProjectForm.domain}
                  onChange={(e) => setEditingProjectForm({ ...editingProjectForm, domain: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                />
              </div>

              {/* Metadados e Informações Técnicas */}
              <div className="p-3.5 bg-slate-900/60 border border-slate-850 rounded-2xl space-y-2 text-xs">
                <span className="font-bold text-purple-300 text-[11px] uppercase tracking-wider block">Metadados do Projeto:</span>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div>
                    <span className="text-slate-500 block text-[10px]">ID do Projeto:</span>
                    <span className="font-mono text-[11px] text-slate-300 truncate block">{selectedProjectDetails.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Total de Páginas:</span>
                    <span className="font-bold text-white">{selectedProjectDetails.pages?.length || 1} página(s)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Data de Criação:</span>
                    <span className="text-slate-300">{new Date(selectedProjectDetails.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Última Modificação:</span>
                    <span className="text-slate-300">{new Date(selectedProjectDetails.updatedAt || selectedProjectDetails.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-850 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectModal(false);
                    onSelectProject(selectedProjectDetails.id);
                  }}
                  className="px-4 py-2.5 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Abrir no Editor Visual
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProjectModal(false)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingProjectDetails}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingProjectDetails ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
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
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings' ? 'text-purple-400 font-bold' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Ajustes</span>
        </button>
      </nav>
    </div>
  );
};
