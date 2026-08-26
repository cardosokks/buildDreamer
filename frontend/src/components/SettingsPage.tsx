import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  User, 
  Key, 
  Save, 
  Trash2, 
  Plus, 
  Box, 
  Sparkles, 
  Cpu, 
  Check, 
  RotateCcw, 
  Settings, 
  Database, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { API_URL } from '../config';

export interface AISkill {
  id: string;
  name: string;
  category: '3d' | 'animation' | 'hero' | 'layout' | 'conversion' | 'custom';
  description: string;
  promptSnippet: string;
  enabled: boolean;
}

export const DEFAULT_AI_SKILLS: AISkill[] = [
  {
    id: 'skill-3d-canvas',
    name: 'Elementos 3D & Efeitos Canvas WebGL',
    category: '3d',
    description: 'Integra esferas 3D flutuantes, partículas interativas em Canvas e efeitos de profundidade com iluminação dinâmica.',
    promptSnippet: 'Incorpore elementos visuais 3D avançados: adicione no JS um canvas interativo com partículas flutuantes reativas ao mouse ou geometrias 3D abstratas (com iluminação neon, wireframe dinâmico e gradientes de profundidade). Crie sensação de tecnologia de ponta.',
    enabled: true
  },
  {
    id: 'skill-parallax-gsap',
    name: 'Scroll Parallax & Transições Cinemáticas',
    category: 'animation',
    description: 'Efeitos de rolagem com velocidade diferencial, reveal suave de seções e zoom sutil em imagens.',
    promptSnippet: 'Implemente efeitos de Parallax cinemático: crie animações ativadas pelo scroll (reveal com transform translateY e opacity gradual) e utilize transform-style preserve-3d em cards ao passar o cursor (micro-tilt 3D suave).',
    enabled: true
  },
  {
    id: 'skill-hero-masterpiece',
    name: 'Hero Section de Alto Impacto & Glassmorphism',
    category: 'hero',
    description: 'Hero sections cinematográficas com tipografia imponente, badges luminosos, floating cards e CTAs com brilho pulsante.',
    promptSnippet: 'Crie uma Hero Section espetacular: use tipografia com gradiente metálico (bg-clip text), badges translúcidos com iluminação neon sutil, cards flutuantes de estatísticas e um botão de ação primária (CTA) com efeito de glow pulsante e gradiente suave.',
    enabled: true
  },
  {
    id: 'skill-micro-interactions',
    name: 'Micro-Interações & Feedback Visual Tátil',
    category: 'animation',
    description: 'Efeitos magnéticos nos botões, ripples suaves, indicadores de progresso de leitura e feedbacks táteis.',
    promptSnippet: 'Adicione micro-interações refinadas: efeitos de hover magnéticos ou elevação nos botões, ripples visuais ao clicar, bordas com gradiente animado em cards em destaque e barra de progresso de scroll discreta no topo da página.',
    enabled: true
  },
  {
    id: 'skill-cro-conversion',
    name: 'Gatilhos de Conversão (CRO) & Prova Social',
    category: 'conversion',
    description: 'Seções de depoimentos com estrelas douradas, contadores animados de métricas, cronômetros de urgência e WhatsApp flutuante.',
    promptSnippet: 'Otimize a página para alta conversão (CRO): adicione contador numérico animado para métricas de sucesso, grade de depoimentos com fotos circulares e 5 estrelas douradas, garantia visual e botão flutuante do WhatsApp no canto inferior direito com pulso de atenção.',
    enabled: true
  },
  {
    id: 'skill-dark-luxury',
    name: 'Design System Dark Luxury & Glassmorphism',
    category: 'layout',
    description: 'Paletas luxuosas em tons de obsidian, violeta profundo, ouro champagne ou neon cyan com bordas translúcidas.',
    promptSnippet: 'Utilize estética Dark Luxury de alto padrão: fundo em tons profundos (#07020d, #0b0714), painéis com glassmorphism translúcido (bg-slate-900/60 backdrop-blur-xl border border-purple-500/20), tipografia moderna (Outfit para títulos e Inter para textos) e contrastes meticulosamente calculados.',
    enabled: true
  }
];

export const SettingsPage: React.FC = () => {
  const { token, user, login } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'models' | 'skills'>('profile');
  const [loading, setLoading] = useState(false);
  const [savingRemote, setSavingRemote] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // AI, Proxy & Ngrok credentials
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [proxyUrl, setProxyUrl] = useState(localStorage.getItem('ai_proxy_url') || '');
  const [ngrokToken, setNgrokToken] = useState(localStorage.getItem('ngrok_authtoken') || '');

  // Preferências de Interface / Navbar Size
  const [navbarSize, setNavbarSize] = useState<'compact' | 'normal' | 'large'>(() => {
    try {
      const stored = localStorage.getItem('rp_navbar_size');
      if (stored === 'compact' || stored === 'normal' || stored === 'large') return stored;
    } catch {}
    return 'normal';
  });

  // Models CRUD fields
  const getStoredModels = () => {
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Recomendado)' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
    ];
  };

  const [models, setModels] = useState<Array<{ id: string; name: string }>>(getStoredModels());
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  // Skills CRUD State
  const getStoredSkills = (): AISkill[] => {
    const stored = localStorage.getItem('custom_ai_skills');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return DEFAULT_AI_SKILLS;
  };

  const [skills, setSkills] = useState<AISkill[]>(getStoredSkills());
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'3d' | 'animation' | 'hero' | 'layout' | 'conversion' | 'custom'>('animation');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillSnippet, setNewSkillSnippet] = useState('');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  // Sincronizar configurações do Banco de Dados ao carregar a página
  useEffect(() => {
    if (!token) return;
    const loadUserSettingsFromDatabase = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/auth/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const s = data.settings;
          if (s) {
            if (s.name) setName(s.name);
            if (s.email) setEmail(s.email);
            if (s.geminiApiKey) {
              setGeminiKey(s.geminiApiKey);
              localStorage.setItem('gemini_api_key', s.geminiApiKey);
            }
            if (s.openaiApiKey) {
              setOpenaiKey(s.openaiApiKey);
              localStorage.setItem('openai_api_key', s.openaiApiKey);
            }
            if (s.aiProxyUrl) {
              setProxyUrl(s.aiProxyUrl);
              localStorage.setItem('ai_proxy_url', s.aiProxyUrl);
            }
            if (s.ngrokAuthToken) {
              setNgrokToken(s.ngrokAuthToken);
              localStorage.setItem('ngrok_authtoken', s.ngrokAuthToken);
            }
            if (s.customAiModels && Array.isArray(s.customAiModels)) {
              setModels(s.customAiModels);
              localStorage.setItem('custom_gemini_models', JSON.stringify(s.customAiModels));
            }
            if (s.customAiSkills && Array.isArray(s.customAiSkills)) {
              setSkills(s.customAiSkills);
              localStorage.setItem('custom_ai_skills', JSON.stringify(s.customAiSkills));
            }
            if (s.navbarSize && (s.navbarSize === 'compact' || s.navbarSize === 'normal' || s.navbarSize === 'large')) {
              setNavbarSize(s.navbarSize);
              localStorage.setItem('rp_navbar_size', s.navbarSize);
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar do banco:', err);
      } finally {
        setLoading(false);
      }
    };
    loadUserSettingsFromDatabase();
  }, [token]);

  // Função central para persistir qualquer alteração no Banco de Dados
  const saveToDatabase = async (payload: any) => {
    if (!token) return;
    setSavingRemote(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar no banco');
      }
    } catch (e: any) {
      console.error('Falha ao sincronizar com banco de dados:', e);
    } finally {
      setSavingRemote(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      if (user) {
        const updatedUser = { ...user, name, email };
        login(token!, updatedUser);
        localStorage.setItem('rp_navbar_size', navbarSize);
        await saveToDatabase({ name, navbarSize });
        setSuccessMsg('Perfil atualizado com sucesso!');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAIKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    
    // Atualiza localmente
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('openai_api_key', openaiKey);
    localStorage.setItem('ai_proxy_url', proxyUrl);
    localStorage.setItem('ngrok_authtoken', ngrokToken);

    // Salva no banco de dados
    await saveToDatabase({
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      aiProxyUrl: proxyUrl,
      ngrokAuthToken: ngrokToken
    });

    setSuccessMsg('Configurações salvas com sucesso!');
    setLoading(false);
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId || !newModelName) return;

    if (models.some(m => m.id === newModelId)) {
      setErrorMsg('Este ID de modelo já está cadastrado.');
      return;
    }

    const updated = [...models, { id: newModelId, name: newModelName }];
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    await saveToDatabase({ customAiModels: updated });
    
    setNewModelId('');
    setNewModelName('');
    setSuccessMsg('Modelo adicionado com sucesso!');
  };

  const handleDeleteModel = async (id: string) => {
    const updated = models.filter(m => m.id !== id);
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    await saveToDatabase({ customAiModels: updated });
    setSuccessMsg('Modelo excluído com sucesso!');
  };

  const [fetchingApiModels, setFetchingApiModels] = useState(false);

  const handleAutoDiscoverModels = async () => {
    const activeKey = geminiKey || localStorage.getItem('gemini_api_key') || '';
    if (!activeKey) {
      setErrorMsg('Insira e salve sua Chave da API do Gemini na aba "Chaves de API" antes de buscar modelos.');
      return;
    }

    setFetchingApiModels(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const safeHeader = (val: string) => {
      try { return btoa(unescape(encodeURIComponent(val))); } catch { return ''; }
    };

    try {
      const res = await fetch(`${API_URL}/api/ai/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-gemini-key': safeHeader(geminiKey || localStorage.getItem('gemini_api_key') || ''),
          'x-proxy-url': safeHeader(proxyUrl || localStorage.getItem('ai_proxy_url') || '')
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao consultar modelos disponíveis na API do Gemini.');
      }

      const data = await res.json();
      const apiModels: Array<{ id: string; name: string }> = data.models || [];

      if (apiModels.length === 0) {
        setErrorMsg('Nenhum modelo compatível com geração de texto foi retornado pela API.');
        return;
      }

      const existingIds = new Set(models.map(m => m.id));
      const newDiscovered = apiModels.filter(m => !existingIds.has(m.id));

      if (newDiscovered.length === 0) {
        setSuccessMsg(`Todos os ${apiModels.length} modelos retornados pela API já estão cadastrados!`);
      } else {
        const updated = [...models, ...newDiscovered];
        setModels(updated);
        localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
        await saveToDatabase({ customAiModels: updated });
        setSuccessMsg(`Sucesso! ${newDiscovered.length} novos modelos foram encontrados na sua chave e salvos.`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Erro ao conectar à API do Gemini');
    } finally {
      setFetchingApiModels(false);
    }
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillSnippet.trim()) {
      setErrorMsg('Nome da Skill e Diretriz de Prompt são obrigatórios.');
      return;
    }

    let updated: AISkill[];
    if (editingSkillId) {
      updated = skills.map(s => s.id === editingSkillId ? {
        ...s,
        name: newSkillName.trim(),
        category: newSkillCategory,
        description: newSkillDesc.trim(),
        promptSnippet: newSkillSnippet.trim()
      } : s);
      setEditingSkillId(null);
      setSuccessMsg('Skill atualizada com sucesso!');
    } else {
      const newSkill: AISkill = {
        id: `skill-${Date.now()}`,
        name: newSkillName.trim(),
        category: newSkillCategory,
        description: newSkillDesc.trim(),
        promptSnippet: newSkillSnippet.trim(),
        enabled: true
      };
      updated = [...skills, newSkill];
      setSuccessMsg('Nova Skill cadastrada com sucesso!');
    }

    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });

    setNewSkillName('');
    setNewSkillDesc('');
    setNewSkillSnippet('');
  };

  const handleToggleSkill = async (id: string) => {
    const updated = skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });
  };

  const handleDeleteSkill = async (id: string) => {
    const updated = skills.filter(s => s.id !== id);
    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });
    setSuccessMsg('Skill removida com sucesso.');
  };

  const handleStartEditSkill = (s: AISkill) => {
    setEditingSkillId(s.id);
    setNewSkillName(s.name);
    setNewSkillCategory(s.category);
    setNewSkillDesc(s.description);
    setNewSkillSnippet(s.promptSnippet);
  };

  const handleResetDefaultSkills = async () => {
    setSkills(DEFAULT_AI_SKILLS);
    localStorage.setItem('custom_ai_skills', JSON.stringify(DEFAULT_AI_SKILLS));
    await saveToDatabase({ customAiSkills: DEFAULT_AI_SKILLS });
    setSuccessMsg('Skills restauradas para os padrões com sucesso!');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      
      {/* Header Principal da Página de Configurações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
              <Settings className="w-7 h-7" />
            </div>
            Configurações da Conta & Sistema
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm flex items-center gap-2">
            <span>Credenciais, inteligência artificial, proxy e preferências</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
              <Database className="w-3 h-3" />
              Sincronizado
            </span>
          </p>
        </div>

        {savingRemote && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-950/50 border border-purple-500/30 rounded-xl text-purple-300 text-xs font-mono animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sincronizando com o PostgreSQL...
          </div>
        )}
      </div>

      {/* Alertas de Sucesso e Erro */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2.5 shadow-lg shadow-emerald-950/30 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs text-red-300 flex items-center gap-2.5 shadow-lg shadow-red-950/30 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Layout Grid: Menu de Abas Lateral + Painel de Conteúdo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        
        {/* Menu de Abas Vertical */}
        <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-2.5 space-y-1.5 shadow-xl">
          <button 
            onClick={() => { setActiveTab('profile'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`w-full px-4 py-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-3 ${
              activeTab === 'profile' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <span className="block leading-tight">Perfil de Usuário</span>
              <span className="text-[10px] font-normal opacity-80">Dados da conta</span>
            </div>
          </button>

          <button 
            onClick={() => { setActiveTab('ai'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`w-full px-4 py-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-3 ${
              activeTab === 'ai' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Key className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <span className="block leading-tight">Chaves de API & Proxy</span>
              <span className="text-[10px] font-normal opacity-80">Gemini, OpenAI, Ngrok</span>
            </div>
          </button>

          <button 
            onClick={() => { setActiveTab('models'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`w-full px-4 py-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-3 ${
              activeTab === 'models' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Box className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <span className="block leading-tight">Modelos de IA</span>
              <span className="text-[10px] font-normal opacity-80">Catálogo e auto-descoberta</span>
            </div>
          </button>

          <button 
            onClick={() => { setActiveTab('skills'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`w-full px-4 py-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-3 ${
              activeTab === 'skills' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
            <div className="text-left">
              <span className="block leading-tight">Skills & Prompts IA</span>
              <span className="text-[10px] font-normal opacity-80">3D, Parallax, Hero, CRO</span>
            </div>
          </button>
        </div>

        {/* Conteúdo da Aba Selecionada */}
        <div className="md:col-span-3 bg-[#0f0b18] border border-slate-850 rounded-2xl p-8 shadow-xl">
          
          {/* TAB 1: PERFIL */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-6 max-w-xl">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Informações Pessoais
                </h3>
                <p className="text-xs text-slate-400">Atualize seu nome de exibição e credenciais da conta.</p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Endereço de E-mail
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-4 py-3 bg-slate-950/60 border border-slate-850 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">O e-mail é o identificador único da sua conta.</span>
                </div>

                {/* Seletor de Tamanho da Navbar */}
                <div className="pt-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Tamanho & Densidade da Barra Superior (Topbar)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setNavbarSize('compact')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        navbarSize === 'compact'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block">Compacto</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Espaço reduzido (h-13)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNavbarSize('normal')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        navbarSize === 'normal'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block">Normal</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Padrão equilibrado (h-15)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNavbarSize('large')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        navbarSize === 'large'
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block">Grande</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Maior destaque (h-18)</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Salvando...' : 'Salvar Alterações no Perfil'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CHAVES DE API & PROXY */}
          {activeTab === 'ai' && (
            <form onSubmit={handleSaveAIKeys} className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-400" />
                  Chaves de API & Conexões de Infraestrutura
                </h3>
                <p className="text-xs text-slate-400">
                  Configure suas chaves para os motores de inteligência artificial e túnel de acesso remoto.
                </p>
              </div>

              <div className="space-y-5 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Google Gemini API Key (Recomendado)</span>
                    <span className="text-[10px] text-purple-400 font-mono">Gratuito / Pago</span>
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:border-purple-500 focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Utilizado para geração ultra-rápida de sites, chat de IA e remasterização multi-página.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    OpenAI API Key (Opcional)
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Proxy / Reverse Proxy Endpoint (Opcional)</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Custom API URL</span>
                  </label>
                  <input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="https://meu-proxy-gemini.meudominio.com"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:border-purple-500 focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Permite rotear as chamadas para gateways próprios sem bloqueio de região.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Ngrok Authtoken</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Túnel Público</span>
                  </label>
                  <input
                    type="password"
                    value={ngrokToken}
                    onChange={(e) => setNgrokToken(e.target.value)}
                    placeholder="2abc..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-white focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-850">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MODELOS DE IA */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Box className="w-5 h-5 text-purple-400" />
                  Gerenciamento de Modelos Gemini
                </h3>
                <p className="text-xs text-slate-400">
                  Adicione IDs de modelos específicos do Google AI ou execute a auto-descoberta.
                </p>
              </div>

              {/* Botão de Auto-Descoberta */}
              <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">Auto-Descoberta de Modelos</span>
                  <span className="text-[11px] text-slate-400">Varre os modelos disponíveis na sua chave do Gemini.</span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoDiscoverModels}
                  disabled={fetchingApiModels}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  {fetchingApiModels ? 'Consultando...' : 'Buscar Modelos na API'}
                </button>
              </div>

              {/* Formulário Manual */}
              <form onSubmit={handleAddModel} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-white block">Cadastrar Modelo Manualmente</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="ID do Modelo (ex: gemini-2.0-flash)"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Nome Amigável (ex: Gemini 2.5 Flash)"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Modelo
                </button>
              </form>

              {/* Lista de Modelos */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Modelos Cadastrados ({models.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {models.map((m) => (
                    <div key={m.id} className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between group hover:border-purple-500/40 transition-all">
                      <div>
                        <span className="text-xs font-bold text-white block">{m.name}</span>
                        <span className="text-[10px] text-purple-400 font-mono">{m.id}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteModel(m.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                        title="Remover modelo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SKILLS DE DESIGN */}
          {activeTab === 'skills' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Skills de Design & Engenharia de Prompts
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ative ou crie novas diretrizes técnicas que a IA incorporará ao gerar páginas e códigos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetDefaultSkills}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold border border-slate-800 transition-all cursor-pointer flex items-center gap-1.5 self-start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrões
                </button>
              </div>

              {/* Formulário de Criação/Edição de Skill */}
              <form onSubmit={handleSaveSkill} className="p-5 bg-slate-950/40 border border-purple-500/30 rounded-2xl space-y-4">
                <span className="text-xs font-bold text-white block">
                  {editingSkillId ? 'Editar Skill' : 'Criar Nova Skill de Design'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Nome da Skill *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Glassmorphism Ultra Premium"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Categoria
                    </label>
                    <select
                      value={newSkillCategory}
                      onChange={(e: any) => setNewSkillCategory(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none cursor-pointer"
                    >
                      <option value="3d">3D & WebGL</option>
                      <option value="animation">Animações & Scroll</option>
                      <option value="hero">Hero Sections</option>
                      <option value="layout">Layout & Dark</option>
                      <option value="conversion">Conversão & CRO</option>
                      <option value="custom">Customizada</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Descrição Curta
                  </label>
                  <input
                    type="text"
                    placeholder="Breve resumo da finalidade desta skill..."
                    value={newSkillDesc}
                    onChange={(e) => setNewSkillDesc(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                    <span>Instrução / Prompt Técnico da Skill *</span>
                    <span className="text-[10px] text-purple-400 font-mono">HTML, CSS, JS</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Ex: Implemente componentes usando Tailwind com efeitos de gradiente..."
                    value={newSkillSnippet}
                    onChange={(e) => setNewSkillSnippet(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingSkillId ? 'Salvar Alterações da Skill' : 'Adicionar Skill ao Banco'}
                </button>
              </form>

              {/* Lista de Skills com Checkboxes Ativas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Skills Cadastradas ({skills.length})
                  </span>
                  <span className="text-xs text-purple-400 font-mono">
                    {skills.filter(s => s.enabled).length} ativas na geração
                  </span>
                </div>

                <div className="space-y-3">
                  {skills.map(s => (
                    <div
                      key={s.id}
                      className={`p-4 border rounded-2xl transition-all space-y-2 ${
                        s.enabled 
                          ? 'bg-slate-950 border-purple-500/40 shadow-sm' 
                          : 'bg-slate-950/40 border-slate-850 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={s.enabled}
                            onChange={() => handleToggleSkill(s.id)}
                            className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer w-4 h-4"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{s.name}</h4>
                              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/30 font-mono">
                                {s.category}
                              </span>
                            </div>
                            {s.description && (
                              <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditSkill(s)}
                            className="p-2 text-slate-400 hover:text-purple-300 hover:bg-slate-900 rounded-xl transition-all cursor-pointer"
                            title="Editar Skill"
                          >
                            <Cpu className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSkill(s.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-xl transition-all cursor-pointer"
                            title="Excluir Skill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-900/70 border border-slate-850 rounded-xl">
                        <p className="text-xs text-slate-400 font-mono italic leading-relaxed">
                          {s.promptSnippet}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
};
