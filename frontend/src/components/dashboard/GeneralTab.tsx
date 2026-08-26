import React from 'react';
import {
  Sparkles,
  Zap,
  Users,
  Layout,
  ChevronRight,
  TrendingUp,
  Bookmark,
  Server,
  Cpu,
  ArrowUpRight,
  SlidersHorizontal,
  Settings
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pages?: { id: string }[];
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  website: string | null;
  rating: string;
}

interface GeneralTabProps {
  projects: Project[];
  savedLeads: Lead[];
  setActiveTab: (tab: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings') => void;
  setCreationMode: (mode: 'scratch' | 'template' | 'ai' | 'zip') => void;
  setShowCreateModal: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  onSelectProject: (projectId: string) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  projects,
  savedLeads,
  setActiveTab,
  setCreationMode,
  setShowCreateModal,
  setShowSettings,
  onSelectProject
}) => {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header de Ação Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Visão Geral
          </h2>
          <p className="text-xs text-slate-400">
            Crie sites com IA, prospecte novos clientes e publique em tempo recorde.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setCreationMode('ai'); setShowCreateModal(true); }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Criar com IA
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-pink-400" />
            Buscar Leads
          </button>
        </div>
      </div>

      {/* Status & Estatísticas em Grid Principal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
          className="bg-[#0f0f12] border border-zinc-800 hover:border-indigo-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer transition-all"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">CRM de Vendas</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-zinc-200 mt-2">Pipeline</p>
          <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-2">
            Acessar Funil de Vendas <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* Leads Prospectados & Salvos */}
        <div
          onClick={() => setActiveTab('saved-leads')}
          className="bg-[#0f0f12] border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer transition-all"
        >
          <div className="absolute top-0 right-0 w-20 h-20 bg-zinc-700/10 rounded-full blur-xl group-hover:bg-zinc-700/20 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Leads Salvos</span>
            <div className="p-2 rounded-xl bg-zinc-800/60 text-zinc-400 border border-zinc-700">
              <Bookmark className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-zinc-200 mt-2">{savedLeads.length}</p>
          <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-2">
            Ver oportunidades <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* Status do Servidor e Deploy */}
        <div className="bg-[#0f0f12] border border-zinc-800 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-zinc-700/5 rounded-full blur-xl group-hover:bg-zinc-700/10 transition-all" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider">Servidor FTP</span>
            <div className="p-2 rounded-xl bg-zinc-800/60 text-zinc-400 border border-zinc-700">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-bold text-zinc-300 mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full" />
            Conectado
          </p>
          <span className="text-[11px] text-zinc-600 font-mono mt-2 block">
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
              className="p-4 bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-zinc-800/60 text-zinc-400 border border-zinc-700">
                  <Users className="w-4 h-4" />
                </span>
                <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
              </div>
              <span className="font-bold text-zinc-200 text-sm block">Buscador de Clientes Locais</span>
              <span className="text-xs text-zinc-500 mt-0.5 block">Prospecte comércios sem website e WhatsApp</span>
            </button>

            <button
              onClick={() => setActiveTab('presets')}
              className="p-4 bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-zinc-800/60 text-zinc-400 border border-zinc-700">
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
              </div>
              <span className="font-bold text-zinc-200 text-sm block">Filtros Pré-Configurados</span>
              <span className="text-xs text-zinc-500 mt-0.5 block">Buscas automatizadas com 1 clique</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-4 bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-zinc-800/60 text-zinc-400 border border-zinc-700">
                  <Settings className="w-4 h-4" />
                </span>
                <ArrowUpRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
              </div>
              <span className="font-bold text-zinc-200 text-sm block">Configurar IA & Proxies</span>
              <span className="text-xs text-zinc-500 mt-0.5 block">Chaves de API do Gemini e Proxies</span>
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
  );
};
