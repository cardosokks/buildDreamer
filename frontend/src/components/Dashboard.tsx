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
  Loader2,
  List,
  LayoutGrid,
  Clock,
  SortAsc,
  SortDesc,
  User,
  Link as LinkIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  UserPlus,
  UserCheck
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { SettingsPage } from './SettingsPage';
import { CRMManager } from './CRMManager';
import { API_URL } from '../config';
import { GeneralTab } from './dashboard/GeneralTab';
import { ProjectsTab } from './dashboard/ProjectsTab';
import { LeadsSearchTab } from './dashboard/LeadsSearchTab';
import { SavedLeadsTab } from './dashboard/SavedLeadsTab';

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
  crmLead?: { id: string; name: string; company?: string; status?: string; phone?: string; email?: string } | null;
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
    } catch { }
    return initialTab === 'tunnels' as any ? 'general' : initialTab;
  });

  const setActiveTab = (tab: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings') => {
    setActiveTabState(tab);
    if (onTabChange) onTabChange(tab);
    try {
      localStorage.setItem('rp_dashboard_active_tab', tab);
    } catch { }
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
    } catch { }
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
    html?: string;
    css?: string;
    js?: string;
    isHomepage: boolean;
    enabled: boolean;
    media?: Array<{
      url: string;
      alt?: string;
      type: 'image' | 'video' | 'logo' | 'icon';
      role?: 'logo' | 'hero' | 'card' | 'gallery' | 'content' | 'video';
      localUrl?: string;
    }>;
  }>>([]);
  const [remasterPageTabs, setRemasterPageTabs] = useState<Record<number, 'prompt' | 'content' | 'html' | 'css' | 'js'>>({});
  const [repeatNavbar, setRepeatNavbar] = useState(true);
  const [repeatFooter, setRepeatFooter] = useState(true);
  const [generatingRemaster, setGeneratingRemaster] = useState(false);
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
      notify.success(`Informações do projeto "${updated.name}" salvas com sucesso!`, 'Salvo');
    } catch (err: any) {
      notify.error(err.message || 'Erro ao salvar alterações do projeto', 'Erro');
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
    } catch { }
    return 'normal';
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('rp_sidebar_width');
      if (stored) return Number(stored);
    } catch { }
    return 256;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('rp_sidebar_collapsed');
      if (stored) return JSON.parse(stored);
    } catch { }
    return false;
  });

  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('rp_sidebar_hidden');
      if (stored) return JSON.parse(stored);
    } catch { }
    return false;
  });

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Efeitos para sincronizar preferências de interface com o LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('rp_navbar_minimized', JSON.stringify(navbarMinimized));
    } catch { }
  }, [navbarMinimized]);

  useEffect(() => {
    try {
      localStorage.setItem('rp_navbar_size', navbarSize);
    } catch { }
  }, [navbarSize]);

  useEffect(() => {
    try {
      localStorage.setItem('rp_sidebar_width', sidebarWidth.toString());
    } catch { }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem('rp_sidebar_collapsed', JSON.stringify(sidebarCollapsed));
    } catch { }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('rp_sidebar_hidden', JSON.stringify(sidebarHidden));
    } catch { }
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
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const { bellNotifications, unreadBellCount, markBellRead, markAllBellRead, removeBellNotification, clearBell, addBellNotification } = useNotification();

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
    } catch { }
    return 'table';
  });

  useEffect(() => {
    try {
      localStorage.setItem('rp_leads_view_mode', viewMode);
    } catch { }
  }, [viewMode]);

  // Modo de Visualização e Paginação para Leads Salvos
  const [savedViewMode, setSavedViewMode] = useState<'table' | 'cards'>(() => {
    try {
      const stored = localStorage.getItem('rp_saved_leads_view_mode');
      if (stored === 'table' || stored === 'cards') return stored;
    } catch { }
    return 'table';
  });

  useEffect(() => {
    try {
      localStorage.setItem('rp_saved_leads_view_mode', savedViewMode);
    } catch { }
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
    } catch { }
    return [
      { id: '1', name: 'Padarias Sem Site (DF)', niche: 'Padaria', city: 'Brasília', state: 'DF', country: 'Brasil', onlyWithoutWebsite: true, hasPhoneOnly: true, minRating: 4 },
      { id: '2', name: 'Dentistas em Formosa (GO)', niche: 'Dentista', city: 'Formosa', state: 'GO', country: 'Brasil', onlyWithoutWebsite: false, hasPhoneOnly: true, minRating: 4.5 },
      { id: '3', name: 'Pizzarias em Goiânia (GO)', niche: 'Pizzaria', city: 'Goiânia', state: 'GO', country: 'Brasil', onlyWithoutWebsite: true, hasPhoneOnly: false, minRating: 0 },
      { id: '4', name: 'Academias em São Paulo (SP)', niche: 'Academia', city: 'São Paulo', state: 'SP', country: 'Brasil', onlyWithoutWebsite: true, hasPhoneOnly: true, minRating: 4 }
    ];
  });

  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [showPresetListModal, setShowPresetListModal] = useState(false);
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
    setShowPresetListModal(false);
  };

  // Cadastrar Lead Salvo no CRM no Funil de Vendas como "Novo Lead"
  const handleCadastrarLeadNoCRM = async (lead: Lead) => {
    try {
      const res = await fetch(`${API_URL}/api/leads/crm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: lead.name,
          company: lead.category || 'Comércio Local',
          phone: lead.phone || null,
          website: lead.website || null,
          address: lead.address || null,
          dealValue: 1500,
          status: 'PROSPECT',
          notes: 'Cadastrado a partir dos Leads Salvos'
        })
      });
      const data = await res.json();
      if (res.ok && data.lead) {
        notify.success(`"${lead.name}" foi cadastrado no CRM como Novo Lead!`, 'CRM Atualizado');
        addBellNotification({
          type: 'success',
          emoji: '🤝',
          title: 'Lead Adicionado ao CRM',
          message: `"${lead.name}" foi inserido no funil de vendas na etapa Novo Lead.`
        });
      } else {
        throw new Error(data.error || 'Erro ao cadastrar lead no CRM');
      }
    } catch (err: any) {
      notify.error(err.message || 'Erro ao cadastrar lead no CRM', 'Erro');
    }
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
  const [targetLeadForProject, setTargetLeadForProject] = useState<Lead | null>(null);

  // Rastreamento de projetos sendo gerados pela IA no momento
  const [generatingProjectJobs, setGeneratingProjectJobs] = useState<Record<string, { status: string; currentModel?: string; attempt?: number; total?: number }>>({});

  // Projetos: modo de visualização, ordenação e busca
  const [projectsViewMode, setProjectsViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const stored = localStorage.getItem('rp_projects_view_mode');
      if (stored === 'grid' || stored === 'list') return stored;
    } catch { }
    return 'grid';
  });

  const [projectsSort, setProjectsSort] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>(() => {
    try {
      const stored = localStorage.getItem('rp_projects_sort');
      if (['newest', 'oldest', 'name_asc', 'name_desc'].includes(stored || '')) return stored as any;
    } catch { }
    return 'newest';
  });

  const [projectsSearch, setProjectsSearch] = useState('');

  useEffect(() => {
    try { localStorage.setItem('rp_projects_view_mode', projectsViewMode); } catch { }
  }, [projectsViewMode]);

  useEffect(() => {
    try { localStorage.setItem('rp_projects_sort', projectsSort); } catch { }
  }, [projectsSort]);

  // Horário do servidor
  const [serverTime, setServerTime] = useState<string>('');
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);

  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch(`${API_URL}/api/auth/time`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const { time } = await res.json();
          const t1 = Date.now();
          const serverMs = new Date(time).getTime();
          const offset = serverMs - ((t0 + t1) / 2);
          setServerTimeOffset(offset);
        }
      } catch { }
    };
    fetchServerTime();
    const syncInterval = setInterval(fetchServerTime, 60000);
    const tickInterval = setInterval(() => {
      const now = new Date(Date.now() + serverTimeOffset);
      setServerTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => { clearInterval(syncInterval); clearInterval(tickInterval); };
  }, [token, serverTimeOffset]);

  // Projetos filtrados e ordenados
  const filteredProjects = React.useMemo(() => {
    let list = [...projects];
    if (projectsSearch.trim()) {
      const q = projectsSearch.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    switch (projectsSort) {
      case 'newest': list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'oldest': list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case 'name_asc': list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name_desc': list.sort((a, b) => b.name.localeCompare(a.name)); break;
    }
    return list;
  }, [projects, projectsSearch, projectsSort]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao buscar projetos');
      const data = await res.json();
      let finalProjects = data;
      // Busca dados de CRM vinculados a cada projeto
      try {
        const crmRes = await fetch(`${API_URL}/api/leads/crm`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (crmRes.ok) {
          const crmData = await crmRes.json();
          const crmLeads: any[] = crmData.leads || [];
          finalProjects = data.map((p: Project) => {
            const linked = crmLeads.find((l: any) => l.projectId === p.id);
            return { ...p, crmLead: linked ? { id: linked.id, name: linked.name, company: linked.company, status: linked.status, phone: linked.phone, email: linked.email } : null };
          });
        }
      } catch { }
      setProjects(finalProjects);

      // Auto-discover generating projects and add to generatingProjectJobs
      const activeJobsMap: Record<string, { status: string }> = {};
      finalProjects.forEach((p: Project) => {
        if (p.status === 'generating' || p.status === 'pending') {
          activeJobsMap[p.id] = { status: 'generating' };
        }
      });
      if (Object.keys(activeJobsMap).length > 0) {
        setGeneratingProjectJobs(prev => ({ ...activeJobsMap, ...prev }));
      }
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
        if (res.status === 401) {
          // Token inválido ou expirado (ex: token do backend antigo Node.js) → fazer logout
          logout();
          return;
        }
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
            // 🔔 Bell notification for AI site generation
            const proj = projects.find(p => p.id === pId);
            if (job.status === 'completed') {
              addBellNotification({
                type: 'success',
                emoji: '✨',
                title: 'Site gerado com sucesso!',
                message: `O site "${proj?.name || 'Novo Projeto'}" foi criado pela IA e está pronto para edição.`,
              });
              notify.success(`Site "${proj?.name || 'Novo Projeto'}" gerado! Clique para editar.`, '✨ Criação Completa!');
            } else {
              addBellNotification({
                type: 'error',
                emoji: '⚠️',
                title: 'Falha na geração do site',
                message: `Ocorreu um erro ao gerar o site "${proj?.name || 'Projeto'}". Tente novamente.`,
              });
            }
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
        } catch { }
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
    setTargetLeadForProject(lead);
    setBusinessName(lead.name);
    setSegment(leadQuery || lead.category || 'Comércio Local');
    setVisualStyle('moderno e escuro neon com foco em conversão');
    setNewProjectDesc(`Site profissional focado em capturar clientes locais para ${lead.name}, endereço: ${lead.address}, telefone: ${lead.phone}.`);
    setShowCreateModal(true);
  };

  // Iniciar fluxo em 2 etapas de Melhorar com IA
  const handleStartRemasterFlow = async (leadOrUrl: { name: string; website: string } | Lead) => {
    let targetUrl = (leadOrUrl.website || '').trim();
    if (!targetUrl || targetUrl === 'null' || targetUrl === 'undefined' || targetUrl.length < 4) {
      alert('Este estabelecimento não possui um website válido cadastrado para ser remasterizado/melhorado. Use a opção de Criar Projeto para gerar um site novo!');
      return;
    }

    setRemasterTargetLead(leadOrUrl as Lead);
    setRemasterWebsiteUrl(targetUrl);
    setRemasterBusinessName(leadOrUrl.name);
    setRemasterScrapingStatus('scraping');
    setRemasterProgressMsg(`Conectando e descobrindo subpáginas de ${targetUrl}...`);
    setRemasterPages([]);
    setShowRemasterModal(true);

    const safeHeader = (val: string) => {
      try { return btoa(unescape(encodeURIComponent(val))); } catch { return ''; }
    };

    try {
      const res = await fetch(`${API_URL}/api/ai/remaster/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Proxy-Url': safeHeader(localStorage.getItem('ai_proxy_url') || '')
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
            html: p.html || '',
            css: p.css || '',
            js: p.js || '',
            isHomepage: !!p.isHomepage,
            enabled: true,
            media: p.media || []
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
      } catch { }

      const safeHeader = (val: string) => {
        try { return btoa(unescape(encodeURIComponent(val))); } catch { return ''; }
      };

      const res = await fetch(`${API_URL}/api/ai/remaster/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Gemini-Key': safeHeader(localStorage.getItem('gemini_api_key') || ''),
          'X-Gemini-Models': safeHeader(JSON.stringify(registeredModelIds)),
          'X-Proxy-Url': safeHeader(localStorage.getItem('ai_proxy_url') || ''),
          'X-AI-Skills': safeHeader(localStorage.getItem('custom_ai_skills') || '')
        },
        body: JSON.stringify({
          projectName: remasterBusinessName,
          globalPrompt: remasterGlobalPrompt,
          pages: activePages,
          leadId: remasterTargetLead?.id || undefined,
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

      // Vincula no CRM se o lead for originário do buscador ou salvos
      if (remasterTargetLead) {
        try {
          if (remasterTargetLead.id) {
            // Lead já existe no CRM → atualiza com o projectId do novo site
            await fetch(`${API_URL}/api/leads/crm/${remasterTargetLead.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                status: 'PROPOSAL_SENT',
                notes: 'Site remasterizado com IA pronto para apresentação de proposta comercial.',
                projectId: newProject.id
              })
            });
          } else {
            // Lead novo (veio do buscador) → cria no CRM
            await fetch(`${API_URL}/api/leads/crm`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: remasterTargetLead.name,
                company: remasterTargetLead.category || 'Comércio',
                phone: remasterTargetLead.phone || null,
                website: remasterTargetLead.website || null,
                address: remasterTargetLead.address || null,
                dealValue: 1500,
                status: 'PROPOSAL_SENT',
                notes: 'Site remasterizado com IA pronto para apresentação de proposta comercial.',
                projectId: newProject.id
              })
            });
          }
        } catch { }
      }

      setProjects([newProject, ...projects]);
      setGeneratingProjectJobs(prev => ({
        ...prev,
        [newProject.id]: { status: 'processing', currentModel: 'Gerando Design System e Páginas...' }
      }));

      // Registra a solicitação no Histórico do Chat de IA para acompanhar o progresso e log de erros
      if (newProject.jobId) {
        const promptText = `Remasterização IA de "${remasterBusinessName}": Recriar estrutura visual com HTML5 e Tailwind.`;
        const initialMsg = { role: 'user', text: promptText };
        
        localStorage.setItem(`chat_history_proj_${newProject.id}`, JSON.stringify([initialMsg]));
        
        if (newProject.pages && newProject.pages.length > 0) {
          const firstPageId = newProject.pages[0].id;
          localStorage.setItem(`chat_history_${firstPageId}`, JSON.stringify([initialMsg]));
          localStorage.setItem(`active_ai_job_${firstPageId}`, JSON.stringify({
            jobId: newProject.jobId,
            currentModel: 'gemini-3.6-flash'
          }));
        }
      }

      setShowRemasterModal(false);
      setActiveTab('projects');
      fetchProjects();
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

      let finalName = newProjectName.trim();
      let finalDesc = newProjectDesc.trim();

      if (creationMode === 'ai') {
        finalName = businessName.trim() || 'Novo Negócio IA';
        finalDesc = `Segmento: ${segment.trim() || 'Geral'}. Estilo: ${visualStyle.trim() || 'Moderno'}. ${newProjectDesc.trim()}`;
      }

      if (!finalName) {
        throw new Error('Por favor, informe o nome do projeto ou empresa.');
      }

      // Get registered custom models from user settings
      let registeredModelIds: string[] = [];
      try {
        const stored = localStorage.getItem('custom_gemini_models');
        if (stored) registeredModelIds = JSON.parse(stored).map((m: any) => m.id);
      } catch { }

      const safeHeader = (val: string) => {
        try { return btoa(unescape(encodeURIComponent(val))); } catch { return ''; }
      };

      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Gemini-Key': safeHeader(localStorage.getItem('gemini_api_key') || ''),
          'X-Gemini-Models': safeHeader(JSON.stringify(registeredModelIds)),
          'X-Proxy-Url': safeHeader(localStorage.getItem('ai_proxy_url') || ''),
          'X-AI-Skills': safeHeader(localStorage.getItem('custom_ai_skills') || '')
        },
        body: JSON.stringify({
          name: finalName,
          description: finalDesc,
          isAIPrompt: creationMode === 'ai',
          leadId: targetLeadForProject?.id || undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao criar projeto.');
      }
      const newProject = await res.json();

      // Se foi gerado a partir de um Lead do buscador/salvos, adiciona ou atualiza no CRM como PROPOSAL_SENT
      if (targetLeadForProject) {
        try {
          await fetch(`${API_URL}/api/leads/crm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: targetLeadForProject.name,
              company: targetLeadForProject.category || 'Comércio Local',
              phone: targetLeadForProject.phone || null,
              website: targetLeadForProject.website || null,
              address: targetLeadForProject.address || null,
              dealValue: 1500,
              status: 'PROPOSAL_SENT',
              notes: `Site criado automaticamente via IA para proposta comercial.`,
              projectId: newProject.id
            })
          });
        } catch { }
      }

      setProjects([newProject, ...projects]);
      setShowCreateModal(false);
      setTargetLeadForProject(null);
      fetchProjects();
      notify.success(`Projeto "${finalName}" criado com sucesso!`, 'Criado');

      // 🔔 Bell: project created
      if (creationMode === 'ai') {
        addBellNotification({
          type: 'info',
          emoji: '🤖',
          title: 'IA trabalhando no seu site!',
          message: `Gerando todas as páginas de "${finalName}" com inteligência artificial...`,
        });
      } else {
        addBellNotification({
          type: 'success',
          emoji: '🚀',
          title: 'Novo projeto criado!',
          message: `"${finalName}" foi criado com sucesso. Clique para começar a editar.`,
        });
      }

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
      notify.error(err.message || 'Falha ao criar projeto', 'Erro');
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
      const deletedProject = projects.find(p => p.id === id);
      setProjects(projects.filter(p => p.id !== id));
      notify.success('Projeto excluído com sucesso.', 'Projeto Excluído');
      addBellNotification({
        type: 'warning',
        emoji: '🗑️',
        title: 'Projeto excluído',
        message: `"${deletedProject?.name || 'Projeto'}" foi removido permanentemente.`,
      });
    } catch (err: any) {
      notify.error(err.message || 'Erro ao excluir projeto', 'Falha');
    }
  };

  return (
    <div className={`h-screen w-screen font-sans flex flex-col overflow-hidden transition-colors duration-200 ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0c10] text-slate-100'
      }`}>
      {/* Top Navbar with Size and Minimized State Toggle */}
      <header className={`border-b sticky top-0 z-30 shrink-0 transition-all duration-300 backdrop-blur-md ${theme === 'light'
        ? 'bg-white/95 border-slate-200 shadow-sm'
        : 'bg-[#0f1117]/95 border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
        } ${navbarMinimized ? 'h-9 py-0' : navbarSize === 'compact' ? 'h-11 py-1' : navbarSize === 'large' ? 'h-14 py-1.5' : 'h-12 py-1'
        }`}>
        <div className="w-full px-4 sm:px-6 h-full flex items-center justify-between gap-4">

          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`p-2 rounded-xl border md:hidden transition-all cursor-pointer ${theme === 'light'
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              title="Menu Lateral"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <div className={`w-7 h-7 rounded-xl overflow-hidden border shrink-0 flex items-center justify-center shadow-inner ${theme === 'light' ? 'border-amber-600/30 bg-amber-50' : 'border-amber-500/30 bg-black/40'
              }`}>
              <img src="/logo.png" alt="Real Premise" className="w-full h-full object-cover" />
            </div>
            {!navbarMinimized && (
              <div className="flex items-center gap-2">
                <span className={`font-extrabold text-xs sm:text-sm tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>REAL PREMISE</span>
                <span className={`hidden sm:inline-block px-1.5 py-0.5 rounded-md border text-[8px] font-mono tracking-widest ${theme === 'light'
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
                className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${ngrokOnline
                  ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60'
                  : ngrokStatus === 'starting'
                    ? 'bg-zinc-900/60 border-zinc-700 text-zinc-300'
                    : theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-400'
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
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    <span className="hidden sm:inline">Conectando...</span>
                  </>
                ) : ngrokOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Ngrok Online</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="hidden sm:inline">Ligar Ngrok</span>
                  </>
                )}
              </button>

              {ngrokOnline && ngrokUrl && (
                <a
                  href={ngrokUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-2.5 rounded-xl bg-zinc-900 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-zinc-800 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
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
              className={`h-9 px-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 shadow-sm'
                : 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-400 shadow-sm'
                }`}
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-zinc-400" />
                  <span className="hidden sm:inline text-xs font-semibold text-zinc-400">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline text-xs font-semibold text-slate-600">Escuro</span>
                </>
              )}
            </button>



            {/* 🔔 Sino de Notificações */}
            <div className="relative">
              <button
                onClick={() => { setShowBellDropdown(!showBellDropdown); setShowUserDropdown(false); if (!showBellDropdown) markAllBellRead(); }}
                className={`relative w-9 h-9 border rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600' : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'}`}
                title="Notificações"
              >
                <Bell className="w-4 h-4" />
                {unreadBellCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-red-500/40 animate-bounce">
                    {unreadBellCount > 9 ? '9+' : unreadBellCount}
                  </span>
                )}
              </button>

              {showBellDropdown && (
                <div
                  className={`absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] border rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden flex flex-col ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f1117] border-slate-800'}`}
                  style={{ maxHeight: '520px' }}
                >
                  {/* Header */}
                  <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${theme === 'light' ? 'border-slate-100 bg-slate-50' : 'border-slate-800 bg-slate-900/60'}`}>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-purple-400" />
                      <span className={`text-sm font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Notificações</span>
                      {unreadBellCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">{unreadBellCount} nova{unreadBellCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {bellNotifications.length > 0 && (
                        <button onClick={clearBell} className="text-[10px] text-slate-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer font-semibold">Limpar tudo</button>
                      )}
                      <button onClick={() => setShowBellDropdown(false)} className={`p-1.5 rounded-lg transition-colors cursor-pointer ${theme === 'light' ? 'text-slate-400 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'}`}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Lista */}
                  <div className="overflow-y-auto flex-1">
                    {bellNotifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center text-2xl">🔔</div>
                        <p className={`text-sm font-semibold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma notificação</p>
                        <p className={`text-xs ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Ações importantes aparecerão aqui</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/40">
                        {bellNotifications.map((n) => {
                          const timeAgo = (() => {
                            const diff = Date.now() - new Date(n.createdAt).getTime();
                            if (diff < 60000) return 'agora';
                            if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
                            if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
                            return `${Math.floor(diff / 86400000)}d atrás`;
                          })();
                          return (
                            <div
                              key={n.id}
                              onClick={() => markBellRead(n.id)}
                              className={`flex items-start gap-3 px-4 py-3 transition-all cursor-default group ${
                                !n.read
                                  ? theme === 'light' ? 'bg-slate-50 hover:bg-slate-100' : 'bg-zinc-900/40 hover:bg-zinc-900/60'
                                  : theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-zinc-900/20'
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm ${
                                n.type === 'success' ? 'bg-zinc-800/50 border border-zinc-700/50'
                                : n.type === 'error' ? 'bg-zinc-800/50 border border-red-900/30'
                                : n.type === 'warning' ? 'bg-zinc-800/50 border border-zinc-700/50'
                                : 'bg-zinc-800/50 border border-zinc-700/50'
                              }`}>
                                {n.emoji}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-xs font-bold leading-tight truncate ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>{n.title}</p>
                                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">{timeAgo}</span>
                                </div>
                                <p className={`text-[11px] mt-0.5 leading-snug ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{n.message}</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeBellNotification(n.id); }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Botão de Minimizar Cabeçalho */}
            <button
              onClick={() => setNavbarMinimized(!navbarMinimized)}
              className={`w-9 h-9 border rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm ${theme === 'light'
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
                className={`h-9 flex items-center gap-2.5 p-1 pl-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800'
                  }`}
              >
                {!navbarMinimized && (
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center justify-end gap-1.5">
                      <p className={`text-xs font-bold leading-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'
                        }`}>{user?.name || 'Desenvolvedor'}</p>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold font-mono ${
                        user?.role === 'ADMIN' ? 'bg-purple-950 text-purple-300 border border-purple-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {user?.role || 'USER'}
                      </span>
                    </div>
                    <p className={`text-[9px] font-mono leading-tight ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'
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
                  className={`absolute right-0 mt-2 w-56 border rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl ${theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-[#0f1117] border-slate-800 text-slate-100'
                    }`}
                  onClick={() => setShowUserDropdown(false)}
                >
                  <div className={`p-3 border-b ${theme === 'light' ? 'border-slate-100 bg-slate-50' : 'border-slate-800 bg-slate-900/50'
                    }`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold truncate">{user?.name || 'Desenvolvedor'}</p>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold font-mono ${
                        user?.role === 'ADMIN' ? 'bg-purple-950 text-purple-300 border border-purple-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {user?.role || 'USER'}
                      </span>
                    </div>
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'general' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                    }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Visão Geral
                </button>
                <button
                  onClick={() => { setActiveTab('projects'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'projects' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                    }`}
                >
                  <Layout className="w-4 h-4 text-indigo-400" />
                  Projetos / Sites
                </button>
                <button
                  onClick={() => { setActiveTab('leads'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'leads' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
                    }`}
                >
                  <Users className="w-4 h-4 text-pink-400" />
                  Buscar Clientes
                </button>
                <button
                  onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30' : 'text-slate-400'
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
        {sidebarHidden ? (
          <div
            className={`hidden md:flex flex-col items-center justify-start pt-3 pb-3 gap-2 w-8 shrink-0 h-full border-r transition-all duration-200 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0b0d13] border-slate-800/80'}`}
          >
            <button
              onClick={() => setSidebarHidden(false)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${theme === 'light' ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
              title="Abrir barra lateral"
            >
              <PanelLeftOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <aside
            style={{ width: sidebarCollapsed ? '60px' : `${sidebarWidth}px` }}
            className={`border-r flex flex-col justify-between shrink-0 h-full overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-3.5'
              } hidden md:flex relative select-none transition-[width,padding] duration-200 ${theme === 'light'
                ? 'bg-white border-slate-200'
                : 'bg-[#0b0d13] border-slate-800/80'
              }`}
          >
            <div className="space-y-1">
              {/* Toggle Collapse/Expand Header on Sidebar */}
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center pb-2' : 'justify-between pb-2'} border-b border-slate-850/60 mb-2`}>
                {!sidebarCollapsed && (
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                    Navegação
                  </span>
                )}
                <button
                  onClick={() => {
                    if (!sidebarCollapsed) {
                      setSidebarCollapsed(true);
                    } else {
                      setSidebarHidden(true);
                      setSidebarCollapsed(false);
                    }
                  }}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer group ${theme === 'light' ? 'text-slate-400 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  title={sidebarCollapsed ? "Ocultar barra lateral" : "Recolher barra lateral (somente ícones)"}
                >
                  {sidebarCollapsed
                    ? <PanelLeftClose className="w-3.5 h-3.5 text-purple-400" />
                    : <PanelLeftClose className="w-3.5 h-3.5" />
                  }
                </button>
              </div>

              {/* Seção 1: Criação & Projetos */}
              {!sidebarCollapsed ? (
                <div className={`pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                  Principal
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'general'
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
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'projects'
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
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                      {projects.length}
                    </span>
                  </>
                )}
              </button>

              {/* Seção 2: CRM & Vendas */}
              {!sidebarCollapsed ? (
                <div className={`pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                  Vendas & CRM
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('crm')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'crm'
                  ? theme === 'light'
                    ? 'bg-slate-100 text-slate-900 font-bold shadow-sm border border-slate-200'
                    : 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/50 font-bold shadow-sm'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                  }`}
                title="Funil de Vendas"
              >
                <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="truncate flex-1 text-left">Funil de Vendas</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono bg-zinc-800 border border-zinc-700 text-zinc-400 font-bold">
                      CRM
                    </span>
                  </>
                )}
              </button>

              {/* Seção 3: Prospecção & Captação */}
              {!sidebarCollapsed ? (
                <div className={`pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                  Prospecção
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('leads')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'leads'
                  ? theme === 'light'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'bg-slate-800 text-white font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                  }`}
                title="Buscador de Clientes"
              >
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Buscador de Clientes</span>}
              </button>

              <button
                onClick={() => setActiveTab('saved-leads')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5 relative' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'saved-leads'
                  ? theme === 'light'
                    ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200'
                    : 'bg-zinc-800/60 text-zinc-200 border border-zinc-700/50 font-bold'
                  : theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-slate-200'
                  }`}
                title={`Leads Salvos (${savedLeads.length})`}
              >
                <Bookmark className="w-4 h-4 text-slate-400 shrink-0" />
                {!sidebarCollapsed ? (
                  <>
                    <span className="truncate flex-1 text-left">Leads Salvos</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${theme === 'light' ? 'bg-slate-200 text-slate-700' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                      {savedLeads.length}
                    </span>
                  </>
                ) : savedLeads.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-zinc-500" />
                )}
              </button>



              {/* Seção 4: Configurações & Conta */}
              {!sidebarCollapsed ? (
                <div className={`pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                  Geral
                </div>
              ) : (
                <div className="border-t border-slate-850/60 my-2" />
              )}

              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'settings'
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

            {/* Rodapé da Sidebar: Horário do servidor + link Ngrok */}
            {!sidebarCollapsed && (
              <div className="space-y-2">
                {/* Relógio do Servidor */}
                {serverTime && (
                  <div className={`p-2.5 border rounded-xl ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-3 h-3 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`} />
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Servidor</span>
                      </div>
                      <span className={`font-mono text-xs font-bold tabular-nums ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{serverTime}</span>
                    </div>
                  </div>
                )}

                {/* Link Ngrok quando online */}
                {ngrokOnline && ngrokUrl && (
                  <div className={`p-3 border rounded-xl animate-in fade-in duration-200 ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-zinc-900/60 border-zinc-800'
                    }`}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-700' : 'text-zinc-400'
                          }`}>Ngrok Online</span>
                      </div>
                      <Globe className="w-3.5 h-3.5 text-zinc-500" />
                    </div>
                    <a
                      href={ngrokUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-xs font-mono truncate block hover:underline transition-colors flex items-center justify-between gap-1 ${theme === 'light' ? 'text-slate-700' : 'text-zinc-400'
                        }`}
                      title={ngrokUrl}
                    >
                      <span className="truncate">{ngrokUrl.replace('https://', '')}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
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

        {/* Dynamic Content Panel */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {activeTab === 'general' ? (
            <GeneralTab
              projects={projects}
              savedLeads={savedLeads}
              setActiveTab={setActiveTab}
              setCreationMode={setCreationMode}
              setShowCreateModal={setShowCreateModal}
              setShowSettings={setShowSettings}
              onSelectProject={onSelectProject}
            />
          ) : activeTab === 'projects' ? (
            <ProjectsTab
              token={token || ''}
              theme={theme}
              projects={projects}
              loading={loading}
              error={error}
              generatingProjectJobs={generatingProjectJobs}
              onSelectProject={onSelectProject}
              openProjectDetailsModal={openProjectDetailsModal}
              handleDeleteProject={handleDeleteProject}
              setActiveTab={setActiveTab}
              setShowCreateModal={setShowCreateModal}
            />
          ) : activeTab === 'saved-leads' ? (
            <SavedLeadsTab
              theme={theme}
              savedLeads={savedLeads}
              onToggleSaveLead={handleToggleSaveLead}
              onCadastrarLeadNoCRM={handleCadastrarLeadNoCRM}
              onCreateProjectFromLead={handleCreateProjectFromLead}
              onStartRemasterFlow={(lead) => handleStartRemasterFlow(lead as any)}
              setShowManualLeadModal={setShowManualLeadModal}
              setActiveTab={setActiveTab}
            />
          ) : activeTab === 'crm' ? (
            <CRMManager
              onOpenRemasterModal={(lead) => handleStartRemasterFlow(lead as any)}
              onOpenProject={(projId) => onSelectProject(projId)}
              projects={projects}
            />
          ) : activeTab === 'leads' ? (
            <LeadsSearchTab
              token={token || ''}
              theme={theme}
              savedLeads={savedLeads}
              onToggleSaveLead={handleToggleSaveLead}
              onStartRemasterFlow={(lead) => handleStartRemasterFlow(lead as any)}
            />
          ) : activeTab === 'settings' ? (
            /* PÁGINA NATIVA DE CONFIGURAÇÕES DO SISTEMA */
            <SettingsPage />
          ) : null}
        </main>
      </div>

      {/* Preset List / Manager Modal */}
      {showPresetListModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-[#0f0b18] border border-cyan-500/30 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="text-cyan-400 w-5 h-5" />
                  Filtros Pré-Prontos Salvos
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Selecione um modelo de busca para prospectar com 1 clique.</p>
              </div>
              <div className="flex items-center gap-2">
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
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Filtro
                </button>
                <button onClick={() => setShowPresetListModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto py-4 space-y-3 pr-1 flex-1">
              {filterPresets.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                  <SlidersHorizontal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Nenhum filtro salvo ainda.</p>
                  <button
                    onClick={() => {
                      setEditingPresetId(null);
                      setPresetForm({
                        name: '', niche: '', city: '', state: '', country: 'Brasil', onlyWithoutWebsite: true, hasPhoneOnly: false, minRating: 0
                      });
                      setPresetModalOpen(true);
                    }}
                    className="mt-3 text-xs text-cyan-400 hover:underline font-semibold"
                  >
                    Criar primeiro filtro
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterPresets.map(preset => (
                    <div
                      key={preset.id}
                      className="bg-slate-950/70 border border-slate-850 hover:border-cyan-500/40 rounded-xl p-4 flex flex-col justify-between transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-bold text-white text-sm line-clamp-1">{preset.name}</h3>
                          <span className="px-2 py-0.5 bg-cyan-950/50 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-mono shrink-0">
                            {preset.niche}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-400 mt-2">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-pink-400 shrink-0" />
                            <span className="truncate">{preset.city}{preset.state ? ` - ${preset.state}` : ''} ({preset.country || 'Brasil'})</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>Sem site: <strong>{preset.onlyWithoutWebsite ? 'Sim' : 'Não'}</strong></span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>Telefone: <strong>{preset.hasPhoneOnly ? 'Sim' : 'Qualquer'}</strong></span>
                          </p>
                          {preset.minRating > 0 && (
                            <p className="flex items-center gap-1.5">
                              <Star className="w-3 h-3 text-yellow-400 shrink-0" />
                              <span>Nota mín: <strong>★ {preset.minRating}</strong></span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between">
                        <div className="flex items-center gap-1">
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
                            title="Editar filtro"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="p-1.5 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Excluir filtro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleApplyPreset(preset)}
                          className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600 border border-cyan-500/40 text-cyan-200 hover:text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Buscar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeTab === 'general' ? 'text-purple-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px]">Geral</span>
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeTab === 'projects' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
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
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeTab === 'leads' ? 'text-pink-400 font-bold' : 'text-slate-500 hover:text-slate-300'
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
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${remasterScrapingStatus === 'scraping'
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
                          className={`p-3.5 border rounded-xl transition-all space-y-2.5 ${page.enabled
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
                              {(page as any).media && (page as any).media.length > 0 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono">
                                  {(page as any).media.length} mídias
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

                          {/* Abas de Prompt Específico, Texto e Código Original Extraído (HTML, CSS, JS) */}
                          {page.enabled && (
                            <div className="space-y-2 pt-1 border-t border-slate-850/60">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setRemasterPageTabs(prev => ({ ...prev, [idx]: 'prompt' }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${(remasterPageTabs[idx] || 'prompt') === 'prompt' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                  >
                                    Prompt
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemasterPageTabs(prev => ({ ...prev, [idx]: 'content' }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${(remasterPageTabs[idx] || 'prompt') === 'content' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                  >
                                    Texto ({page.cleanText ? page.cleanText.length : 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemasterPageTabs(prev => ({ ...prev, [idx]: 'media' as any }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${(remasterPageTabs[idx] as any) === 'media' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                  >
                                    Mídias ({(page as any).media ? (page as any).media.length : 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemasterPageTabs(prev => ({ ...prev, [idx]: 'html' }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${(remasterPageTabs[idx] || 'prompt') === 'html' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                  >
                                    HTML ({page.html ? page.html.length : 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemasterPageTabs(prev => ({ ...prev, [idx]: 'css' }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${(remasterPageTabs[idx] || 'prompt') === 'css' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                  >
                                    CSS ({page.css ? page.css.length : 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRemasterPageTabs(prev => ({ ...prev, [idx]: 'js' }))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${(remasterPageTabs[idx] || 'prompt') === 'js' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                                  >
                                    JS ({page.js ? page.js.length : 0})
                                  </button>
                                </div>

                                <span className="text-[9px] text-emerald-400 font-mono hidden sm:inline">
                                  ✓ Passado para a IA analisar a estrutura antiga
                                </span>
                              </div>

                              {(remasterPageTabs[idx] || 'prompt') === 'prompt' && (
                                <div>
                                  <textarea
                                    rows={2}
                                    value={page.customPrompt}
                                    onChange={(e) => {
                                      const updated = [...remasterPages];
                                      updated[idx].customPrompt = e.target.value;
                                      setRemasterPages(updated);
                                    }}
                                    placeholder={`Descreva o que deseja que a IA implemente especificamente na página ${page.name}...`}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-sans focus:border-purple-500 focus:outline-none leading-relaxed resize-none"
                                  />
                                </div>
                              )}

                              {(remasterPageTabs[idx] || 'prompt') === 'content' && (
                                <div>
                                  <textarea
                                    rows={4}
                                    value={page.cleanText || 'Nenhum texto extraído desta página.'}
                                    onChange={(e) => {
                                      const updated = [...remasterPages];
                                      updated[idx].cleanText = e.target.value;
                                      setRemasterPages(updated);
                                    }}
                                    placeholder="Texto e informações reais extraídos do site original..."
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-emerald-300 font-mono focus:border-purple-500 focus:outline-none leading-relaxed"
                                  />
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Conteúdo textual original que a IA usará como base para melhorar o site.
                                  </p>
                                </div>
                              )}

                              {(remasterPageTabs[idx] || 'prompt') === 'html' && (
                                <div>
                                  <textarea
                                    rows={5}
                                    value={page.html || 'Nenhum HTML bruto capturado.'}
                                    onChange={(e) => {
                                      const updated = [...remasterPages];
                                      updated[idx].html = e.target.value;
                                      setRemasterPages(updated);
                                    }}
                                    placeholder="HTML original da página raspada..."
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-indigo-300 font-mono focus:border-indigo-500 focus:outline-none leading-relaxed"
                                  />
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Código HTML da página antiga. A IA analisa as tags, distribuição e seções para reconstruir uma versão muito superior.
                                  </p>
                                </div>
                              )}

                              {(remasterPageTabs[idx] || 'prompt') === 'css' && (
                                <div>
                                  <textarea
                                    rows={4}
                                    value={page.css || 'Nenhum CSS inline capturado.'}
                                    onChange={(e) => {
                                      const updated = [...remasterPages];
                                      updated[idx].css = e.target.value;
                                      setRemasterPages(updated);
                                    }}
                                    placeholder="Estilos CSS originais capturados..."
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-cyan-300 font-mono focus:border-cyan-500 focus:outline-none leading-relaxed"
                                  />
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Estilos CSS antigos que ajudam a IA a captar paleta de cores e identidades originais da marca.
                                  </p>
                                </div>
                              )}

                              {(remasterPageTabs[idx] as any) === 'media' && (
                                <div className="space-y-2">
                                  {page.media && page.media.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                                      {page.media.map((m, mIdx) => (
                                        <div key={mIdx} className="relative group bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col items-center">
                                          {m.type === 'video' ? (
                                            <div className="w-full h-20 bg-purple-950/40 flex items-center justify-center text-[10px] text-purple-300 font-bold">
                                              🎬 Vídeo
                                            </div>
                                          ) : (
                                            <img
                                              src={m.url}
                                              alt={m.alt || 'Mídia do site'}
                                              className="w-full h-20 object-cover bg-slate-900"
                                              onError={(e) => {
                                                (e.target as HTMLElement).style.opacity = '0.3';
                                              }}
                                            />
                                          )}
                                          <div className="p-1.5 w-full bg-slate-900/90 text-center border-t border-slate-800/80">
                                            <span className="text-[9px] text-purple-300 font-bold font-mono block truncate">
                                              {m.role ? `[${m.role.toUpperCase()}]` : m.type}
                                            </span>
                                            <span className="text-[8px] text-slate-500 block truncate" title={m.alt || m.url}>
                                              {m.alt || m.url.split('/').pop()}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-800 text-xs text-slate-500 text-center">
                                      Nenhuma imagem ou vídeo identificado nesta subpágina.
                                    </div>
                                  )}
                                  <p className="text-[10px] text-slate-500">
                                    Mídias reais encontradas pelo crawler nesta página. A IA usará estas fotos nos blocos, cards e hero sections.
                                  </p>
                                </div>
                              )}

                              {(remasterPageTabs[idx] || 'prompt') === 'js' && (
                                <div>
                                  <textarea
                                    rows={4}
                                    value={page.js || 'Nenhum JavaScript inline capturado.'}
                                    onChange={(e) => {
                                      const updated = [...remasterPages];
                                      updated[idx].js = e.target.value;
                                      setRemasterPages(updated);
                                    }}
                                    placeholder="Scripts JS originais capturados..."
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-amber-300 font-mono focus:border-amber-500 focus:outline-none leading-relaxed"
                                  />
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Comportamentos e scripts interativos originais de referência.
                                  </p>
                                </div>
                              )}
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
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeTab === 'general' ? 'text-purple-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px]">Geral</span>
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeTab === 'projects' ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
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
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeTab === 'leads' ? 'text-pink-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px]">Clientes</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${activeTab === 'settings' ? 'text-purple-400 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Ajustes</span>
        </button>
      </nav>
    </div>
  );
};
