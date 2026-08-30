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
  Loader2,
  HardDrive,
  Radio,
  Zap,
  Activity,
  Layers,
  ShieldCheck,
  Server,
  Cloud,
  HelpCircle,
  RefreshCw,
  Sliders,
  Laptop,
  DownloadCloud
} from 'lucide-react';
import { API_URL, safeJson } from '../config';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'ollama' | 'minio' | 'models' | 'skills'>('ai');
  const [loading, setLoading] = useState(false);
  const [savingRemote, setSavingRemote] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // AI Provider & Credentials
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama' | 'openai' | 'custom'>(() => {
    return (localStorage.getItem('preferred_ai_provider') as any) || 'gemini';
  });
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [proxyUrl, setProxyUrl] = useState(localStorage.getItem('ai_proxy_url') || '');
  const [ngrokToken, setNgrokToken] = useState(localStorage.getItem('ngrok_authtoken') || '');

  // Ollama & Low-Spec PC Settings
  const [ollamaEndpoint, setOllamaEndpoint] = useState(localStorage.getItem('ollama_endpoint') || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem('ollama_selected_model') || 'qwen2.5-coder:1.5b');
  const [lowSpecMode, setLowSpecMode] = useState<boolean>(() => {
    const val = localStorage.getItem('ollama_low_spec_mode');
    return val === null ? true : val === 'true';
  });
  const [testingOllama, setTestingOllama] = useState(false);
  const [fetchingGeminiModels, setFetchingGeminiModels] = useState(false);
  const [fetchingOllamaModels, setFetchingOllamaModels] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; message: string; models: any[] } | null>(null);

  // MinIO / S3 Settings
  const [minioEndpoint, setMinioEndpoint] = useState(localStorage.getItem('minio_endpoint') || '');
  const [minioPort, setMinioPort] = useState(localStorage.getItem('minio_port') || '12000');
  const [minioUseSSL, setMinioUseSSL] = useState<boolean>(localStorage.getItem('minio_use_ssl') === 'true');
  const [minioAccessKey, setMinioAccessKey] = useState(localStorage.getItem('minio_access_key') || '');
  const [minioSecretKey, setMinioSecretKey] = useState(localStorage.getItem('minio_secret_key') || '');
  const [minioBucket, setMinioBucket] = useState(localStorage.getItem('minio_bucket') || 'builddreamer-assets');
  const [minioPublicUrl, setMinioPublicUrl] = useState(localStorage.getItem('minio_public_url') || '');
  const [testingMinio, setTestingMinio] = useState(false);
  const [minioStatus, setMinioStatus] = useState<{ success: boolean; message: string; buckets?: string[] } | null>(null);

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
        let parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migração: substitui IDs inválidos (gemini-2.5-*) por válidos (gemini-2.0-*)
          let changed = false;
          parsed = parsed.map((m: any) => {
            if (m.id === 'gemini-2.5-flash') {
              changed = true;
              return { ...m, id: 'gemini-2.0-flash', name: m.name.replace('2.5', '2.0') };
            }
            if (m.id === 'gemini-2.5-pro') {
              changed = true;
              return { ...m, id: 'gemini-1.5-pro', name: m.name.replace('2.5', '1.5') };
            }
            return m;
          });
          if (changed) localStorage.setItem('custom_gemini_models', JSON.stringify(parsed));
          return parsed;
        }
      } catch {}
    }
    return [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Recomendado / Mais Rápido)' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Alta Precisão)' }
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
        const err = await safeJson(res);
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
    setErrorMsg(null);

    try {
      localStorage.setItem('preferred_ai_provider', aiProvider);
      localStorage.setItem('gemini_api_key', geminiKey);
      localStorage.setItem('openai_api_key', openaiKey);
      localStorage.setItem('ai_proxy_url', proxyUrl);
      localStorage.setItem('ngrok_authtoken', ngrokToken);

      await saveToDatabase({
        preferredAiProvider: aiProvider,
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        aiProxyUrl: proxyUrl,
        ngrokAuthToken: ngrokToken
      });

      setSuccessMsg('Configurações de IA salvas com sucesso!');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestOllama = async () => {
    setTestingOllama(true);
    setOllamaStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/ai/ollama/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ endpoint: ollamaEndpoint })
      });
      const data = await res.json();
      setOllamaStatus({
        connected: data.success,
        message: data.message,
        models: data.models || []
      });
      if (data.success && data.models && data.models.length > 0) {
        if (!ollamaModel || !data.models.some((m: any) => m.name === ollamaModel)) {
          setOllamaModel(data.models[0].name);
        }
      }
    } catch (err: any) {
      setOllamaStatus({
        connected: false,
        message: `Erro ao conectar com Ollama: ${err.message}`,
        models: []
      });
    } finally {
      setTestingOllama(false);
    }
  };

  const handleFetchGeminiModels = async () => {
    if (!geminiKey && !localStorage.getItem('gemini_api_key')) {
      setErrorMsg('Configure sua chave API do Gemini antes de buscar os modelos.');
      return;
    }
    setFetchingGeminiModels(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/ai/gemini/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-gemini-key': geminiKey || localStorage.getItem('gemini_api_key') || '',
          'x-ai-proxy-url': btoa(proxyUrl || localStorage.getItem('ai_proxy_url') || '')
        }
      });
      const data = await res.json();
      if (data.success && data.models) {
        const fetchedModels = data.models.map((m: any) => ({
          id: m.id,
          name: m.name
        }));
        
        // Mescla com os existentes para não perder nomes amigáveis customizados
        const existingMap = new Map(models.map(m => [m.id, m.name]));
        const mergedModels = fetchedModels.map((m: any) => ({
          id: m.id,
          name: existingMap.has(m.id) ? existingMap.get(m.id)! : m.name
        }));

        setModels(mergedModels);
        localStorage.setItem('custom_gemini_models', JSON.stringify(mergedModels));
        await saveToDatabase({ customAiModels: mergedModels });
        setSuccessMsg(`Lista de modelos Gemini atualizada com sucesso! (${mergedModels.length} modelos encontrados)`);
      } else {
        throw new Error(data.message || 'Falha ao buscar modelos Gemini');
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao buscar modelos do Gemini: ${err.message}`);
    } finally {
      setFetchingGeminiModels(false);
    }
  };

  const handleFetchOllamaModels = async () => {
    setFetchingOllamaModels(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/ai/ollama/models?endpoint=${encodeURIComponent(ollamaEndpoint)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setOllamaStatus({
        connected: data.connected,
        message: data.connected ? 'Modelos do Ollama atualizados com sucesso!' : 'Não foi possível conectar ao Ollama.',
        models: data.models || []
      });
      
      if (data.connected && data.models && data.models.length > 0) {
        setSuccessMsg(`Lista de modelos Ollama sincronizada! (${data.models.length} modelos locais detectados)`);
        if (!ollamaModel || !data.models.some((m: any) => m.name === ollamaModel)) {
          setOllamaModel(data.models[0].name);
        }
      } else if (!data.connected) {
        throw new Error('Certifique-se de que o Ollama está rodando e o endpoint está correto.');
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao sincronizar Ollama: ${err.message}`);
    } finally {
      setFetchingOllamaModels(false);
    }
  };

  const handleSaveOllamaSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('ollama_endpoint', ollamaEndpoint);
    localStorage.setItem('ollama_selected_model', ollamaModel);
    localStorage.setItem('ollama_low_spec_mode', String(lowSpecMode));
    if (aiProvider === 'ollama') {
      localStorage.setItem('preferred_ai_provider', 'ollama');
    }
    setSuccessMsg('Configurações do Ollama salvas com sucesso!');
  };

  const handleTestMinio = async () => {
    setTestingMinio(true);
    setMinioStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/media/minio/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: minioEndpoint,
          port: minioPort,
          useSSL: minioUseSSL,
          accessKey: minioAccessKey,
          secretKey: minioSecretKey,
          bucket: minioBucket,
          publicUrl: minioPublicUrl
        })
      });
      const data = await safeJson(res);
      setMinioStatus(data);
    } catch (err: any) {
      setMinioStatus({
        success: false,
        message: `Erro ao testar MinIO: ${err.message}`
      });
    } finally {
      setTestingMinio(false);
    }
  };

  const handleSaveMinioSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('minio_endpoint', minioEndpoint);
    localStorage.setItem('minio_port', minioPort);
    localStorage.setItem('minio_use_ssl', String(minioUseSSL));
    localStorage.setItem('minio_access_key', minioAccessKey);
    localStorage.setItem('minio_secret_key', minioSecretKey);
    localStorage.setItem('minio_bucket', minioBucket);
    localStorage.setItem('minio_public_url', minioPublicUrl);
    setSuccessMsg('Configurações do MinIO salvas no navegador e prontas para uso!');
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId.trim() || !newModelName.trim()) return;

    if (models.some(m => m.id === newModelId.trim())) {
      setErrorMsg('Este ID de modelo já está cadastrado.');
      return;
    }

    const updated = [...models, { id: newModelId.trim(), name: newModelName.trim() }];
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    await saveToDatabase({ customAiModels: updated });

    setNewModelId('');
    setNewModelName('');
    setSuccessMsg('Modelo adicionado com sucesso!');
  };

  const handleDeleteModel = async (id: string) => {
    if (models.length <= 1) {
      setErrorMsg('Você precisa manter pelo menos 1 modelo cadastrado.');
      return;
    }
    const updated = models.filter(m => m.id !== id);
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    await saveToDatabase({ customAiModels: updated });
    setSuccessMsg('Modelo removido com sucesso!');
  };

  const handleToggleSkill = async (id: string) => {
    const updated = skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillSnippet.trim()) {
      setErrorMsg('Nome e Diretriz de Prompt são obrigatórios para a Skill.');
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
    } else {
      const newSkill: AISkill = {
        id: `skill-custom-${Date.now()}`,
        name: newSkillName.trim(),
        category: newSkillCategory,
        description: newSkillDesc.trim(),
        promptSnippet: newSkillSnippet.trim(),
        enabled: true
      };
      updated = [newSkill, ...skills];
    }

    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });

    setNewSkillName('');
    setNewSkillDesc('');
    setNewSkillSnippet('');
    setSuccessMsg('Skill salva com sucesso!');
  };

  const handleResetSkillsToDefault = async () => {
    if (window.confirm('Deseja restaurar todas as habilidades de IA para o padrão de fábrica?')) {
      setSkills(DEFAULT_AI_SKILLS);
      localStorage.setItem('custom_ai_skills', JSON.stringify(DEFAULT_AI_SKILLS));
      await saveToDatabase({ customAiSkills: DEFAULT_AI_SKILLS });
      setSuccessMsg('Skills restauradas para o padrão com sucesso!');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#090813] text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header com Paleta da Logo BuildDreamer */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-500/20 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-purple-600/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#121124] rounded-2xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white font-heading tracking-tight flex items-center gap-2">
                Configurações do Sistema
                {savingRemote && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-normal flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando...
                  </span>
                )}
              </h1>
              <p className="text-sm text-slate-400">
                Gerencie provedores de IA (Gemini & Ollama Local), MinIO Storage, Modelos e Design Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-purple-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              BuildDreamer v2.0
            </span>
          </div>
        </div>

        {/* Notificações globais */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">×</button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">×</button>
          </div>
        )}

        {/* Barra de Abas Estilizada com Gradiente da Logo */}
        <div className="flex overflow-x-auto gap-2 p-1.5 bg-[#121124] rounded-2xl border border-purple-500/20 shadow-inner">
          <button
            onClick={() => { setActiveTab('ai'); setSuccessMsg(null); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Zap className="w-4 h-4 text-purple-300" />
            Provedores de IA
          </button>

          <button
            onClick={() => { setActiveTab('ollama'); setSuccessMsg(null); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'ollama'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Laptop className="w-4 h-4 text-cyan-400" />
            Ollama (PC Fraco / Local)
          </button>

          <button
            onClick={() => { setActiveTab('minio'); setSuccessMsg(null); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'minio'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <HardDrive className="w-4 h-4 text-pink-400" />
            MinIO S3 Storage
          </button>

          <button
            onClick={() => { setActiveTab('skills'); setSuccessMsg(null); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'skills'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            Skills de IA & Design
          </button>

          <button
            onClick={() => { setActiveTab('models'); setSuccessMsg(null); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'models'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Cpu className="w-4 h-4 text-indigo-400" />
            Modelos de IA
          </button>

          <button
            onClick={() => { setActiveTab('profile'); setSuccessMsg(null); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'profile'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <User className="w-4 h-4" />
            Perfil & Interface
          </button>
        </div>

        {/* TAB: PROVEDORES DE IA */}
        {activeTab === 'ai' && (
          <form onSubmit={handleSaveAIKeys} className="space-y-6">
            <div className="bg-[#121124] rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  Provedor de Inteligência Artificial Ativo
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Selecione qual motor de inteligência artificial alimentará a criação visual de sites, o chat copilot e a remasterização inteligente.
                </p>
              </div>

              {/* Cards de Escolha de Provedor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div 
                  onClick={() => setAiProvider('gemini')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    aiProvider === 'gemini' 
                      ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/20' 
                      : 'bg-slate-900/40 border-slate-800 hover:border-purple-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" /> Google Gemini
                    </span>
                    <input 
                      type="radio" 
                      name="provider" 
                      checked={aiProvider === 'gemini'} 
                      onChange={() => setAiProvider('gemini')} 
                      className="accent-purple-500"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Super rápido, suporte a Gemini 2.5 Flash, alta capacidade e excelente design Tailwind.
                  </p>
                </div>

                <div 
                  onClick={() => setAiProvider('ollama')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    aiProvider === 'ollama' 
                      ? 'bg-purple-950/40 border-cyan-500 shadow-md shadow-cyan-500/20' 
                      : 'bg-slate-900/40 border-slate-800 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-cyan-400" /> Ollama Local (100% Offline)
                    </span>
                    <input 
                      type="radio" 
                      name="provider" 
                      checked={aiProvider === 'ollama'} 
                      onChange={() => setAiProvider('ollama')} 
                      className="accent-cyan-500"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Roda direto no seu PC com modelos leves (1.5B/3B). Otimizado para computadores com pouca memória RAM.
                  </p>
                </div>

                <div 
                  onClick={() => setAiProvider('openai')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    aiProvider === 'openai' 
                      ? 'bg-purple-950/40 border-emerald-500 shadow-md shadow-emerald-500/20' 
                      : 'bg-slate-900/40 border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-emerald-400" /> OpenAI / Proxy
                    </span>
                    <input 
                      type="radio" 
                      name="provider" 
                      checked={aiProvider === 'openai'} 
                      onChange={() => setAiProvider('openai')} 
                      className="accent-emerald-500"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Modelos GPT-4o / customizados via API direta ou Proxy Corporativo.
                  </p>
                </div>
              </div>

              {/* Chaves de API */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-purple-500/10">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-400" /> Chave de API Google Gemini
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">
                    Utilizada quando o provedor Google Gemini está selecionado.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" /> Chave OpenAI (Opcional)
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">
                    Para integrações com GPT-4o ou pipelines secundários.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-400" /> Proxy URL para IA (Opcional)
                  </label>
                  <input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                    placeholder="http://proxy.interno:8080"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Token Ngrok (Túneis Remotos)
                  </label>
                  <input
                    type="password"
                    value={ngrokToken}
                    onChange={(e) => setNgrokToken(e.target.value)}
                    placeholder="Token do Ngrok para compartilhar previews..."
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Preferências de IA
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB: OLLAMA (PC FRACO / LOCAL) */}
        {activeTab === 'ollama' && (
          <form onSubmit={handleSaveOllamaSettings} className="space-y-6">
            <div className="bg-[#121124] rounded-2xl p-6 md:p-8 border border-cyan-500/30 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-cyan-400" />
                    Ollama Engine — Otimizado para Computadores de Baixo Desempenho
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Execute modelos locais de IA diretamente no seu hardware sem gastar tokens ou enviar dados para terceiros.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestOllama}
                  disabled={testingOllama}
                  className="px-4 py-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 text-xs font-semibold flex items-center gap-2 transition-all self-start md:self-auto"
                >
                  {testingOllama ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Testar Conexão
                </button>

                <button
                  type="button"
                  onClick={handleFetchOllamaModels}
                  disabled={fetchingOllamaModels}
                  className="px-4 py-2 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60 text-xs font-semibold flex items-center gap-2 transition-all self-start md:self-auto"
                >
                  {fetchingOllamaModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                  Atualizar Lista de Modelos
                </button>
              </div>

              {/* Status do Teste do Ollama */}
              {ollamaStatus && (
                <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                  ollamaStatus.connected 
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}>
                  {ollamaStatus.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{ollamaStatus.message}</p>
                    {ollamaStatus.connected && ollamaStatus.models.length > 0 && (
                      <p className="text-slate-400">
                        Modelos instalados detectados: {ollamaStatus.models.map(m => m.name).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Switch Modo PC Fraco */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-cyan-500/20 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-sm text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    Modo Ultra Leve para PC Fraco (Pouca RAM / Sem Placa de Vídeo Dedicada)
                  </span>
                  <p className="text-xs text-slate-400">
                    Reduz a janela de contexto, usa amostragem determinística rápida (temp 0.2) e limita a 4 threads de CPU para evitar travamentos.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lowSpecMode}
                    onChange={(e) => setLowSpecMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Inputs de Configuração Ollama */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Endpoint do Ollama
                  </label>
                  <input
                    type="text"
                    value={ollamaEndpoint}
                    onChange={(e) => setOllamaEndpoint(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Se estiver usando Docker ou rede local, use o IP da máquina (ex: http://192.168.1.100:11434).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Modelo Local Selecionado
                  </label>
                  <input
                    type="text"
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    placeholder="qwen2.5-coder:1.5b ou llama3.2:1b"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Nome exato da tag no seu Ollama (ex: qwen2.5-coder:1.5b, llama3.2:1b, mistral).
                  </p>
                </div>
              </div>

              {/* Modelos Recomendados para PC Fraco */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Modelos Recomendados para Baixo Consumo de RAM & CPU
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { id: 'qwen2.5-coder:1.5b', name: 'Qwen 2.5 Coder (1.5B)', ram: '~1.2 GB RAM', desc: 'Melhor para código Tailwind e HTML rápido', cmd: 'ollama run qwen2.5-coder:1.5b' },
                    { id: 'llama3.2:1b', name: 'Llama 3.2 (1B)', ram: '~1.0 GB RAM', desc: 'Ultraleve para qualquer laptop antigo', cmd: 'ollama run llama3.2:1b' },
                    { id: 'llama3.2:3b', name: 'Llama 3.2 (3B)', ram: '~2.5 GB RAM', desc: 'Equilíbrio excelente entre qualidade e velocidade', cmd: 'ollama run llama3.2:3b' },
                    { id: 'deepseek-r1:1.5b', name: 'DeepSeek R1 (1.5B)', ram: '~1.3 GB RAM', desc: 'Raciocínio lógico e estruturação de seções', cmd: 'ollama run deepseek-r1:1.5b' },
                    { id: 'gemma2:2b', name: 'Gemma 2 (2B)', ram: '~1.8 GB RAM', desc: 'Google compacto com boa estética de texto', cmd: 'ollama run gemma2:2b' },
                    { id: 'mistral:7b', name: 'Mistral (7B)', ram: '~4.5 GB RAM', desc: 'Alta fidelidade para PCs com 8GB+ de RAM', cmd: 'ollama run mistral' },
                  ].map((rec) => (
                    <div 
                      key={rec.id}
                      onClick={() => setOllamaModel(rec.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        ollamaModel === rec.id 
                          ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20' 
                          : 'bg-slate-900/40 border-slate-800 hover:border-cyan-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{rec.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                          {rec.ram}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{rec.desc}</p>
                      <code className="text-[10px] text-cyan-400/80 block mt-1.5 font-mono bg-black/40 px-1.5 py-0.5 rounded">
                        {rec.cmd}
                      </code>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Salvar Configuração do Ollama
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB: MINIO STORAGE */}
        {activeTab === 'minio' && (
          <form onSubmit={handleSaveMinioSettings} className="space-y-6">
            <div className="bg-[#121124] rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-pink-400" />
                    Armazenamento de Imagens e Ativos — MinIO / S3 Object Storage
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Conecte sua instância do MinIO para armazenar fotos, logomarcas, assets de páginas e snapshots de forma escalável e com CDN.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestMinio}
                  disabled={testingMinio}
                  className="px-4 py-2 rounded-xl bg-pink-950/60 border border-pink-500/40 text-pink-300 hover:bg-pink-900/60 text-xs font-semibold flex items-center gap-2 transition-all self-start md:self-auto"
                >
                  {testingMinio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                  Testar Conexão MinIO & Criar Bucket
                </button>
              </div>

              {/* Status do Teste MinIO */}
              {minioStatus && (
                <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border ${
                  minioStatus.success 
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}>
                  {minioStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{minioStatus.message}</p>
                    {minioStatus.buckets && minioStatus.buckets.length > 0 && (
                      <p className="text-slate-400">
                        Buckets no servidor: {minioStatus.buckets.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Endpoint MinIO (Host ou IP)
                  </label>
                  <input
                    type="text"
                    value={minioEndpoint}
                    onChange={(e) => setMinioEndpoint(e.target.value)}
                    placeholder="localhost ou minio.meudominio.com"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Apenas o hostname ou IP (sem http:// ou https://).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Porta do MinIO
                  </label>
                  <input
                    type="number"
                    value={minioPort}
                    onChange={(e) => setMinioPort(e.target.value)}
                    placeholder="9000"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    Porta da API S3 do MinIO (geralmente 9000 ou 443 para HTTPS).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Access Key (Root User)
                  </label>
                  <input
                    type="text"
                    value={minioAccessKey}
                    onChange={(e) => setMinioAccessKey(e.target.value)}
                    placeholder="minioadmin"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Secret Key (Root Password)
                  </label>
                  <input
                    type="password"
                    value={minioSecretKey}
                    onChange={(e) => setMinioSecretKey(e.target.value)}
                    placeholder="minioadminpassword"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Nome do Bucket para o Projeto
                  </label>
                  <input
                    type="text"
                    value={minioBucket}
                    onChange={(e) => setMinioBucket(e.target.value)}
                    placeholder="builddreamer-assets"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    O bucket será criado automaticamente se ainda não existir.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    URL Pública / CDN Customizada (Opcional)
                  </label>
                  <input
                    type="text"
                    value={minioPublicUrl}
                    onChange={(e) => setMinioPublicUrl(e.target.value)}
                    placeholder="https://cdn.meudominio.com"
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
                  />
                </div>
              </div>

              {/* SSL Checkbox */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-purple-500/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-sm text-white">Utilizar SSL / HTTPS</span>
                  <p className="text-xs text-slate-400">Ative se o seu MinIO possui certificado SSL ou está atrás de proxy seguro.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={minioUseSSL}
                    onChange={(e) => setMinioUseSSL(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                </label>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-pink-600/30 flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Salvar Credenciais MinIO
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB: SKILLS DE IA & DESIGN */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            <div className="bg-[#121124] rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Skills de IA Ativas & Diretrizes de Design
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Ative ou crie novas habilidades que são injetadas no raciocínio da IA durante a criação e remasterização de sites.
                  </p>
                </div>

                <button
                  onClick={handleResetSkillsToDefault}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all self-start md:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                  Restaurar Padrões
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    className={`p-4 rounded-xl border transition-all ${
                      skill.enabled
                        ? 'bg-purple-950/30 border-purple-500/40 shadow-sm'
                        : 'bg-slate-900/30 border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="font-bold text-sm text-white flex items-center gap-2">
                          {skill.name}
                        </span>
                        <p className="text-xs text-slate-400">{skill.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={skill.enabled}
                          onChange={() => handleToggleSkill(skill.id)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <div className="mt-3 pt-3 border-t border-purple-500/10">
                      <code className="text-[11px] text-purple-300/80 block font-mono bg-black/30 p-2 rounded-lg line-clamp-2">
                        {skill.promptSnippet}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MODELOS DE IA */}
        {activeTab === 'models' && (
          <div className="space-y-6">
            <div className="bg-[#121124] rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-400" />
                    Modelos de IA & Ordem de Fallback
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Gerencie a lista de modelos candidatos. Se um modelo estiver sobrecarregado ou atingir quota, o sistema tenta o próximo automaticamente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleFetchGeminiModels}
                  disabled={fetchingGeminiModels}
                  className="px-4 py-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 text-xs font-semibold flex items-center gap-2 transition-all self-start md:self-auto"
                >
                  {fetchingGeminiModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Atualizar da API do Gemini
                </button>
              </div>

              <div className="space-y-3">
                {models.map((m, idx) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-purple-500/20 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-sm text-white">{m.name}</span>
                        <code className="text-xs text-slate-400 block font-mono">{m.id}</code>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteModel(m.id)}
                      className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Form Adicionar Modelo */}
              <form onSubmit={handleAddModel} className="pt-4 border-t border-purple-500/10 space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Adicionar Novo Modelo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    placeholder="ID do Modelo (ex: gemini-2.0-flash)"
                    className="bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                  />
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="Nome Amigável (ex: Gemini 2.5 Flash Ultra)"
                    className="bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Adicionar Modelo
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB: PERFIL & INTERFACE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="bg-[#121124] rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-xl space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Perfil do Usuário & Preferências
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Gerencie informações da conta e densidade da barra de ferramentas do construtor.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Densidade da Barra de Ferramentas
                  </label>
                  <select
                    value={navbarSize}
                    onChange={(e: any) => setNavbarSize(e.target.value)}
                    className="w-full bg-[#0a0a0d] border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-white"
                  >
                    <option value="compact">Compacta (Mais espaço para o Canvas)</option>
                    <option value="normal">Normal (Padrão)</option>
                    <option value="large">Espaçosa (Ícones Maiores)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> Salvar Perfil
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
