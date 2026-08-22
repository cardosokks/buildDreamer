import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  TrendingUp, 
  DollarSign, 
  UserCheck, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  Star, 
  Plus, 
  Filter, 
  Search, 
  Sparkles, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Kanban, 
  List, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  Layers, 
  ChevronRight, 
  Send,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Link as LinkIcon
} from 'lucide-react';
import { API_URL } from '../config';
import { useNotification } from '../context/NotificationContext';

export type LeadStatus = 'PROSPECT' | 'CONTACTED' | 'PROPOSAL_SENT' | 'IN_NEGOTIATION' | 'WON' | 'LOST';

export interface CRMLead {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  rating?: string | null;
  dealValue: number;
  status: LeadStatus;
  notes?: string | null;
  origin?: string | null;
  tags?: string[] | string | null;
  lastContactDate?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  projectStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CRMProps {
  onOpenRemasterModal?: (lead: { name: string; website?: string | null; phone?: string | null; address?: string | null }) => void;
  onOpenProject?: (projectId: string) => void;
  projects?: Array<{ id: string; name: string; domain?: string | null }>;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; border: string; desc: string }> = {
  PROSPECT: {
    label: 'Prospecção / Novo Lead',
    color: 'text-sky-400',
    bg: 'bg-sky-950/30',
    border: 'border-sky-500/30',
    desc: 'Lead descoberto ou cadastrado recentemente'
  },
  CONTACTED: {
    label: 'Primeiro Contato Feito',
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/30',
    border: 'border-indigo-500/30',
    desc: 'Abordagem inicial realizada pelo WhatsApp/Telefone'
  },
  PROPOSAL_SENT: {
    label: 'Proposta / Mockup Enviado',
    color: 'text-purple-400',
    bg: 'bg-purple-950/30',
    border: 'border-purple-500/30',
    desc: 'Demonstração do site ou proposta comercial enviada'
  },
  IN_NEGOTIATION: {
    label: 'Em Negociação',
    color: 'text-amber-400',
    bg: 'bg-amber-950/30',
    border: 'border-amber-500/30',
    desc: 'Ajustes de escopo, valores e condições de fechamento'
  },
  WON: {
    label: 'Ganho / Venda Fechada',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-500/30',
    desc: 'Contrato fechado e pagamento recebido'
  },
  LOST: {
    label: 'Perdido / Desistência',
    color: 'text-rose-400',
    bg: 'bg-rose-950/30',
    border: 'border-rose-500/30',
    desc: 'Cliente não teve interesse ou optou por outro momento'
  }
};

const STATUS_COLUMNS: LeadStatus[] = [
  'PROSPECT',
  'CONTACTED',
  'PROPOSAL_SENT',
  'IN_NEGOTIATION',
  'WON',
  'LOST'
];

export const CRMManager: React.FC<CRMProps> = ({ onOpenRemasterModal, onOpenProject, projects = [] }) => {
  const { token } = useAuth();
  const { theme } = useTheme();
  const notify = useNotification();

  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modais de Criação e Edição
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<CRMLead> | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    dealValue: '1500',
    status: 'PROSPECT' as LeadStatus,
    notes: '',
    projectId: ''
  });

  const fetchLeads = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/leads/crm`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Erro ao buscar leads do CRM:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [token]);

  const handleOpenCreateModal = () => {
    setEditingLead(null);
    setFormData({
      name: '',
      company: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      dealValue: '1500',
      status: 'PROSPECT',
      notes: '',
      projectId: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (lead: CRMLead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      company: lead.company || '',
      phone: lead.phone || '',
      email: lead.email || '',
      website: lead.website || '',
      address: lead.address || '',
      dealValue: (lead.dealValue || 0).toString(),
      status: lead.status,
      notes: lead.notes || '',
      projectId: lead.projectId || ''
    });
    setShowModal(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const payload = {
        name: formData.name.trim(),
        company: formData.company.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website: formData.website.trim() || null,
        address: formData.address.trim() || null,
        dealValue: parseFloat(formData.dealValue) || 0,
        status: formData.status,
        notes: formData.notes.trim() || null,
        projectId: formData.projectId || null
      };

      if (editingLead && editingLead.id) {
        const res = await fetch(`${API_URL}/api/leads/crm/${editingLead.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          setLeads(leads.map(l => l.id === editingLead.id ? { ...l, ...data.lead } : l));
          setShowModal(false);
          notify.success(`Lead "${payload.name}" atualizado com sucesso no banco!`, 'Lead Atualizado');
        }
      } else {
        const res = await fetch(`${API_URL}/api/leads/crm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          setLeads([data.lead, ...leads]);
          setShowModal(false);
          notify.success(`Lead "${payload.name}" cadastrado com sucesso no banco!`, 'Lead Criado');
        }
      }
    } catch (err: any) {
      notify.error(err.message || 'Erro ao salvar informações do lead', 'Erro no CRM');
    }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    // Atualização otimista na interface
    setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    try {
      await fetch(`${API_URL}/api/leads/crm/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.error('Erro ao atualizar status do lead:', err);
      fetchLeads();
    }
  };

  const handleDeleteLead = async (leadId: string, name: string) => {
    if (!window.confirm(`Deseja realmente remover o lead "${name}" do seu CRM?`)) return;
    
    setLeads(leads.filter(l => l.id !== leadId));
    try {
      await fetch(`${API_URL}/api/leads/crm/${leadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Erro ao excluir lead:', err);
      fetchLeads();
    }
  };

  // Filtragem
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.address && lead.address.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Métricas do Pipeline
  const totalLeadsCount = leads.length;
  const totalPipelineValue = leads.filter(l => l.status !== 'LOST').reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
  const totalWonValue = leads.filter(l => l.status === 'WON').reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
  const conversionRate = totalLeadsCount > 0 
    ? Math.round((leads.filter(l => l.status === 'WON').length / totalLeadsCount) * 100) 
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-16">
      
      {/* Header do CRM com Métricas de Vendas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30">
              <TrendingUp className="w-7 h-7" />
            </div>
            CRM de Vendas de Sites
          </h1>
          <p className="text-slate-400 mt-1.5 text-sm">
            Gerencie seu funil de clientes, status de negociação e conecte protótipos de sites gerados com IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-1 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização em Quadro Kanban"
            >
              <Kanban className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização em Tabela/Lista"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Cliente</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Performance do Funil */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Total de Leads</span>
            <span className="text-2xl font-extrabold text-white mt-1 block font-mono">{totalLeadsCount}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">No pipeline de vendas</span>
          </div>
          <div className="p-3 bg-purple-950/60 border border-purple-500/30 rounded-2xl text-purple-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Pipeline Ativo</span>
            <span className="text-2xl font-extrabold text-sky-400 mt-1 block font-mono">
              R$ {totalPipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Oportunidades em aberto</span>
          </div>
          <div className="p-3 bg-sky-950/60 border border-sky-500/30 rounded-2xl text-sky-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Vendas Fechadas</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-1 block font-mono">
              R$ {totalWonValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-500 mt-0.5 block font-semibold">{leads.filter(l => l.status === 'WON').length} contratos ganhos</span>
          </div>
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Taxa de Conversão</span>
            <span className="text-2xl font-extrabold text-amber-400 mt-1 block font-mono">{conversionRate}%</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Leads convertidos em vendas</span>
          </div>
          <div className="p-3 bg-amber-950/60 border border-amber-500/30 rounded-2xl text-amber-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0f0b18] border border-slate-850 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, empresa, telefone ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-semibold shrink-0">Filtrar Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL">Todos os Status ({leads.length})</option>
            {STATUS_COLUMNS.map(st => (
              <option key={st} value={st}>
                {STATUS_CONFIG[st].label} ({leads.filter(l => l.status === st).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo Principal: Visualização Kanban ou Lista */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 items-start">
          {STATUS_COLUMNS.map((statusKey) => {
            const config = STATUS_CONFIG[statusKey];
            const columnLeads = filteredLeads.filter(l => l.status === statusKey);
            const columnSum = columnLeads.reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);

            return (
              <div 
                key={statusKey}
                className="bg-[#0b0813] border border-slate-850/80 rounded-2xl p-3 flex flex-col min-h-[520px] shadow-lg"
              >
                {/* Header da Coluna */}
                <div className={`p-2.5 rounded-xl border ${config.bg} ${config.border} mb-3 flex items-center justify-between`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${config.color} leading-none`}>
                        {config.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block mt-1">
                      R$ {columnSum.toLocaleString('pt-BR')} ({columnLeads.length})
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono ${config.color} bg-black/40 border border-white/10`}>
                    {columnLeads.length}
                  </span>
                </div>

                {/* Cards da Coluna */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[650px] pr-1">
                  {columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-[#120e20] hover:bg-[#18132b] border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-3.5 transition-all shadow-md group relative space-y-3"
                    >
                      {/* Top: Nome e Ações */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-white truncate">{lead.name}</h4>
                          {lead.company && (
                            <p className="text-[10px] text-slate-400 truncate">{lead.company}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => handleOpenEditModal(lead)}
                            className="p-1 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Editar Lead"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id, lead.name)}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Remover do CRM"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Informações de Contato e Local */}
                      <div className="space-y-1 text-[11px] text-slate-400">
                        {lead.phone && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <a
                              href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline truncate"
                              title="Abrir WhatsApp"
                            >
                              {lead.phone}
                            </a>
                          </div>
                        )}

                        {lead.website && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                            <a
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:underline truncate"
                            >
                              {lead.website.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}

                        {lead.address && (
                          <div className="flex items-center gap-1.5 truncate text-[10px] text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{lead.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Projeto Vinculado ou Ação de Gerar Site */}
                      <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-2">
                        {lead.projectId ? (
                          <button
                            onClick={() => onOpenProject && onOpenProject(lead.projectId!)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 text-[10px] font-bold transition-all cursor-pointer truncate"
                            title="Abrir Site no Editor Visual"
                          >
                            <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="truncate">Abrir {lead.projectName || 'Site Criado'}</span>
                          </button>
                        ) : lead.website && onOpenRemasterModal ? (
                          <button
                            onClick={() => onOpenRemasterModal({ name: lead.name, website: lead.website, phone: lead.phone, address: lead.address })}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-purple-600/80 to-indigo-600/80 hover:from-purple-600 hover:to-indigo-600 text-white text-[10px] font-bold transition-all shadow cursor-pointer truncate"
                            title="Criar proposta de novo site com IA para este lead"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-pink-300 shrink-0" />
                            <span className="truncate">Criar Site com IA</span>
                          </button>
                        ) : (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            <span>Sem site atrelado</span>
                          </div>
                        )}
                      </div>

                      {/* Footer do Card: Valor e Seletor Rápido de Status */}
                      <div className="pt-1 flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-emerald-400 font-mono">
                          R$ {(Number(lead.dealValue) || 0).toLocaleString('pt-BR')}
                        </span>

                        <select
                          value={lead.status}
                          onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                          className="text-[9px] font-mono bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1 text-slate-300 focus:outline-none cursor-pointer max-w-[110px] truncate"
                        >
                          {STATUS_COLUMNS.map(st => (
                            <option key={st} value={st}>
                              {STATUS_CONFIG[st].label.split('/')[0]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {columnLeads.length === 0 && (
                    <div className="p-6 text-center border border-dashed border-slate-850 rounded-2xl text-[11px] text-slate-600">
                      Nenhum lead nesta etapa
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista / Tabela */
        <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#090410] border-b border-slate-850 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Cliente / Empresa</th>
                  <th className="py-3 px-4">Status no Funil</th>
                  <th className="py-3 px-4">Valor Estimado</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Site / Proposta IA</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-purple-950/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-white block">{lead.name}</span>
                      {lead.company && <span className="text-[10px] text-slate-400 block">{lead.company}</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].border} ${STATUS_CONFIG[lead.status].color}`}>
                        {STATUS_CONFIG[lead.status].label}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      R$ {(Number(lead.dealValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      {lead.phone && (
                        <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline block text-[11px]">
                          {lead.phone}
                        </a>
                      )}
                      {lead.email && <span className="text-[10px] text-slate-400 block">{lead.email}</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      {lead.projectId ? (
                        <button
                          onClick={() => onOpenProject && onOpenProject(lead.projectId!)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 border border-purple-500/40 text-purple-300 rounded-lg text-[10px] font-bold hover:bg-purple-900/60 cursor-pointer"
                        >
                          <Layers className="w-3 h-3" />
                          {lead.projectName || 'Site Vinculado'}
                        </button>
                      ) : lead.website && onOpenRemasterModal ? (
                        <button
                          onClick={() => onOpenRemasterModal({ name: lead.name, website: lead.website, phone: lead.phone, address: lead.address })}
                          className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-[10px] font-bold hover:opacity-90 cursor-pointer shadow"
                        >
                          <Sparkles className="w-3 h-3 text-pink-300" />
                          Criar Site com IA
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">Sem site</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(lead)}
                        className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id, lead.name)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Lead */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-950 border border-slate-850 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[#090410] border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {editingLead ? `Editar Cliente: ${editingLead.name}` : 'Novo Cliente no Funil'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nome do Contato / Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Dr. Roberto Silva"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Ex: Clínica Odonto Premium"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Website Atual (se houver)
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://empresa.com.br"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Valor Estimado do Contrato (R$)
                  </label>
                  <input
                    type="number"
                    value={formData.dealValue}
                    onChange={(e) => setFormData({ ...formData, dealValue: e.target.value })}
                    placeholder="1500"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Status no Funil de Vendas
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {STATUS_COLUMNS.map(st => (
                      <option key={st} value={st}>
                        {STATUS_CONFIG[st].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Vincular a Projeto / Site Criado
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="">Nenhum (Criar depois)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.domain ? `(${p.domain})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Endereço / Localização
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo SP"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Anotações Comerciais & Reuniões
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Cliente quer foco em botões de WhatsApp e galeria de fotos. Reunião de fechamento marcada para quinta."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  {editingLead ? 'Salvar Alterações' : 'Adicionar ao CRM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
