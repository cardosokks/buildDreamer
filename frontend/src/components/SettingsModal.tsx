import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Key, Save, Trash2, Plus, Box, Sparkles } from 'lucide-react';
import { API_URL } from '../config';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { token, user, login } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'models'>('profile');
  const [loading, setLoading] = useState(false);
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

  // Models CRUD fields
  const getStoredModels = () => {
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) return JSON.parse(stored);
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recomendado)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
    ];
  };

  const [models, setModels] = useState<Array<{ id: string; name: string }>>(getStoredModels());
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      if (user) {
        const updatedUser = { ...user, name, email };
        login(token!, updatedUser);
        setSuccessMsg('Perfil atualizado com sucesso!');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAIKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('openai_api_key', openaiKey);
    localStorage.setItem('ai_proxy_url', proxyUrl);
    localStorage.setItem('ngrok_authtoken', ngrokToken);
    setSuccessMsg('Configurações de IA, Proxy e Ngrok salvas com sucesso!');
    setLoading(false);
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId || !newModelName) return;

    if (models.some(m => m.id === newModelId)) {
      setErrorMsg('Este ID de modelo já está cadastrado.');
      return;
    }

    const updated = [...models, { id: newModelId, name: newModelName }];
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    setNewModelId('');
    setNewModelName('');
    setSuccessMsg('Modelo adicionado com sucesso!');
  };

  const handleDeleteModel = (id: string) => {
    const updated = models.filter(m => m.id !== id);
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    setSuccessMsg('Modelo excluído com sucesso!');
  };

  const [fetchingApiModels, setFetchingApiModels] = useState(false);

  const handleFetchApiModels = async () => {
    setFetchingApiModels(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeKey = geminiKey || localStorage.getItem('gemini_api_key') || '';

    try {
      const res = await fetch(`${API_URL}/api/ai/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-gemini-key': activeKey
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao buscar modelos na API do Gemini');
      }

      const data = await res.json();
      const apiModels: Array<{ id: string; name: string }> = data.models || [];

      if (apiModels.length === 0) {
        setErrorMsg('Nenhum modelo de geração de conteúdo encontrado para este token.');
        return;
      }

      // Adiciona apenas os modelos que ainda não estão na lista
      const existingIds = new Set(models.map(m => m.id));
      const newDiscovered = apiModels.filter(m => !existingIds.has(m.id));

      if (newDiscovered.length === 0) {
        setSuccessMsg(`Todos os ${apiModels.length} modelos retornados pela API já estão cadastrados!`);
      } else {
        const updated = [...models, ...newDiscovered];
        setModels(updated);
        localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
        setSuccessMsg(`Sucesso! ${newDiscovered.length} novos modelos foram encontrados na sua chave e cadastrados.`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Erro ao conectar à API do Gemini');
    } finally {
      setFetchingApiModels(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          Configurações do Sistema
        </h2>

        {/* Tab switcher */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 border border-slate-850 rounded-xl mb-6">
          <button 
            onClick={() => { setActiveTab('profile'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'profile' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <User className="w-3.5 h-3.5" />
            Perfil
          </button>
          <button 
            onClick={() => { setActiveTab('ai'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'ai' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Key className="w-3.5 h-3.5" />
            Chaves API
          </button>
          <button 
            onClick={() => { setActiveTab('models'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'models' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Box className="w-3.5 h-3.5" />
            Modelos IA
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-350 text-xs font-medium">
            ✅ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-350 text-xs font-medium">
            ❌ {errorMsg}
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-2">Nome Completo</label>
                <input 
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-2">Endereço de E-mail</label>
                <input 
                  type="email"
                  required
                  placeholder="nome@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs text-white"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-505 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Save className="w-4 h-4" />
                  Salvar Perfil
                </button>
              </div>
            </form>
          )}

          {activeTab === 'ai' && (
            <form onSubmit={handleSaveAIKeys} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2 flex items-center gap-1">
                  Gemini API Key
                  <span className="text-[10px] text-amber-400 lowercase italic font-normal">(Recomendado)</span>
                </label>
                <input 
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2 flex items-center justify-between">
                  <span>Proxy para IA (HTTP / HTTPS / SOCKS5)</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-normal">Bypass de Bloqueio</span>
                </label>
                <input 
                  type="text"
                  placeholder="http://usuario:senha@ip-proxy:porta ou http://proxy.servidor.com:8080"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Configure um proxy caso o Gemini esteja barrando requisições do seu IP ou datacenter. Todas as chamadas para IA passarão por este túnel.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2 flex items-center justify-between">
                  <span>Ngrok Authtoken</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-normal">Acesso Global ao Dashboard</span>
                </label>
                <input 
                  type="password"
                  placeholder="2xxxx_xxxxxxxxxxxxxxxxxxxx"
                  value={ngrokToken}
                  onChange={(e) => setNgrokToken(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Seu token pessoal do ngrok.com para disponibilizar o painel e os previews do site na internet de qualquer lugar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2">OpenAI API Key (Opcional)</label>
                <input 
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs text-white"
                />
              </div>

              {/* Informações de Ambiente e Deploy FTP */}
              <div className="pt-2 border-t border-slate-850 space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ambiente de Deploy & Armazenamento</label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Servidor FTP Integrado</span>
                    <span className="text-[10px] text-slate-500">Sincronização automática de arquivos e deploys</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full">
                    Ativo
                  </span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-505 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Save className="w-4 h-4" />
                  Salvar Chaves
                </button>
              </div>
            </form>
          )}

          {activeTab === 'models' && (
            <div className="space-y-6">

              {/* Sincronização Automática via API Token */}
              <div className="p-4 bg-purple-950/25 border border-purple-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Buscar Modelos Disponíveis na API
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Consulta a API oficial do Gemini com seu token e cadastra automaticamente os modelos liberados na sua conta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchApiModels}
                    disabled={fetchingApiModels}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {fetchingApiModels ? 'Consultando...' : 'Sincronizar Modelos'}
                  </button>
                </div>
              </div>
              
              {/* Add New Custom Model Manualmente */}
              <form onSubmit={handleAddModel} className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider">Adicionar Manualmente</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">ID do Modelo</label>
                    <input 
                      type="text"
                      required
                      placeholder="gemini-2.5-flash"
                      value={newModelId}
                      onChange={(e) => setNewModelId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Nome de Exibição</label>
                    <input 
                      type="text"
                      required
                      placeholder="Gemini 2.5 Flash"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Manualmente
                </button>
              </form>

              {/* Models List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider">
                  Modelos Cadastrados ({models.length})
                </h3>
                
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {models.map(m => (
                    <div 
                      key={m.id} 
                      className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{m.id}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteModel(m.id)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-850 rounded transition-all cursor-pointer"
                        title="Remover modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-6 border-t border-slate-800/60 mt-6 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
