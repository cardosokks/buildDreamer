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
  onOpenRemasterModal?: (lead: { id?: string; name: string; website?: string | null; phone?: string | null; address?: string | null }) => void;
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
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');
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
        const data = await res.json();
        if (res.ok && data.lead) {
          setLeads(leads.map(l => l.id === editingLead.id ? { ...l, ...data.lead } : l));
          setShowModal(false);
          notify.success(`Lead "${payload.name}" atualizado com sucesso!`, 'Salvo');
        } else {
          throw new Error(data.error || 'Erro ao atualizar lead');
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
        const data = await res.json();
        if (res.status === 409) {
          // Duplicidade detectada
          notify.error(data.error || 'Já existe um cliente com dados semelhantes no seu CRM.', '⚠️ Cliente Duplicado');
          return;
        }
        if (res.ok && data.lead) {
          setLeads([data.lead, ...leads]);
          setShowModal(false);
          notify.success(`Lead "${payload.name}" cadastrado com sucesso!`, 'Salvo');
          notify.addBellNotification({
            type: 'info',
            emoji: '🤝',
            title: 'Novo Lead Cadastrado!',
            message: `O cliente "${payload.name}" (${payload.company || 'Pessoa Física'}) foi adicionado ao seu CRM.`
          });
        } else {
          throw new Error(data.error || 'Erro ao cadastrar lead');
        }
      }
    } catch (err: any) {
      notify.error(err.message || 'Erro ao salvar informações do lead', 'Erro');
    }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    const targetLead = leads.find(l => l.id === leadId);
    
    // Atualização otimista na interface
    setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    if (newStatus === 'WON' && targetLead && targetLead.status !== 'WON') {
      const dealFormatted = Number(targetLead.dealValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      notify.success(`Parabéns! Venda de ${dealFormatted} fechada com ${targetLead.name}! 🚀`, '🎉 Contrato Fechado!');
      notify.addBellNotification({
        type: 'success',
        emoji: '💰',
        title: 'Venda Fechada!',
        message: `Contrato fechado com ${targetLead.name} no valor de ${dealFormatted}!`
      });
    }

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
    notify.addBellNotification({
      type: 'warning',
      emoji: '🗑️',
      title: 'Lead Removido',
      message: `O lead "${name}" foi excluído do seu pipeline de vendas.`
    });
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
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-10">
      
      {/* Header do CRM */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className={`text-xl font-bold tracking-tight flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            CRM & Funil de Vendas
          </h2>
          <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            Gerencie contatos, negociações e propostas comerciais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`p-1 border rounded-xl flex items-center gap-1 ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'pipeline'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização em Pipeline Vertical"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização em Tabela/Lista"
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas e Performance do Funil */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`p-4 rounded-2xl border shadow-md flex items-center justify-between ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-850'}`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Total de Leads</span>
            <span className={`text-xl font-extrabold mt-0.5 block font-mono ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{totalLeadsCount}</span>
            <span className="text-[10px] text-slate-500 block">No pipeline de vendas</span>
          </div>
          <div className={`p-2.5 rounded-xl ${theme === 'light' ? 'bg-purple-50 border border-purple-200 text-purple-600' : 'bg-purple-950/60 border border-purple-500/30 text-purple-400'}`}>
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-md flex items-center justify-between ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-850'}`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Pipeline Ativo</span>
            <span className={`text-xl font-extrabold mt-0.5 block font-mono ${theme === 'light' ? 'text-sky-600' : 'text-sky-400'}`}>
              R$ {totalPipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 block">Oportunidades em aberto</span>
          </div>
          <div className={`p-2.5 rounded-xl ${theme === 'light' ? 'bg-sky-50 border border-sky-200 text-sky-600' : 'bg-sky-950/60 border border-sky-500/30 text-sky-400'}`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-md flex items-center justify-between ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-850'}`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Vendas Fechadas</span>
            <span className={`text-xl font-extrabold mt-0.5 block font-mono ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>
              R$ {totalWonValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] block font-semibold ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-500'}`}>{leads.filter(l => l.status === 'WON').length} contratos ganhos</span>
          </div>
          <div className={`p-2.5 rounded-xl ${theme === 'light' ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' : 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-400'}`}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-md flex items-center justify-between ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-850'}`}>
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Taxa de Conversão</span>
            <span className={`text-xl font-extrabold mt-0.5 block font-mono ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`}>{conversionRate}%</span>
            <span className="text-[10px] text-slate-500 block">Leads convertidos</span>
          </div>
          <div className={`p-2.5 rounded-xl ${theme === 'light' ? 'bg-amber-50 border border-amber-200 text-amber-600' : 'bg-amber-950/60 border border-amber-500/30 text-amber-400'}`}>
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>



      {/* Barra de Filtros e Busca */}
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 border p-3 rounded-2xl ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-850'}`}>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, empresa, telefone ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none focus:border-purple-500 transition-colors ${
              theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
            }`}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className={`text-xs font-semibold shrink-0 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Filtrar Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 border rounded-xl text-xs focus:outline-none focus:border-purple-500 cursor-pointer ${
              theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
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

      {/* Conteúdo Principal: Visualização Pipeline ou Lista */}
      {viewMode === 'pipeline' ? (
        <div className="space-y-4">
          {STATUS_COLUMNS.map((statusKey, index) => {
            const config = STATUS_CONFIG[statusKey];
            const columnLeads = filteredLeads.filter(l => l.status === statusKey);
            const columnSum = columnLeads.reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
            const isLast = index === STATUS_COLUMNS.length - 1;

            return (
              <div key={statusKey} className="relative">
                {/* Linha Conectora Vertical */}
                {!isLast && (
                  <div className={`absolute left-[22px] top-10 bottom-0 w-0.5 z-0 ${theme === 'light' ? 'bg-gradient-to-b from-slate-200 to-transparent' : 'bg-gradient-to-b from-slate-800 to-transparent'}`} />
                )}

                <div className="flex gap-4 relative z-10">
                  {/* Ícone / Indicador da Etapa */}
                  <div className={`mt-1 w-11 h-11 rounded-full border-2 flex items-center justify-center shrink-0 shadow-lg ${
                    theme === 'light' ? 'bg-white border-slate-200' : `${config.bg} ${config.border}`
                  } ${config.color}`}>
                    <span className="text-sm font-bold">{index + 1}</span>
                  </div>

                  <div className="flex-1 space-y-3">
                    {/* Header da Etapa */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className={`text-sm font-bold flex items-center gap-2 ${config.color}`}>
                          {config.label}
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono ${
                            theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/5 border border-white/10 text-slate-400'
                          }`}>
                            {columnLeads.length} {columnLeads.length === 1 ? 'Lead' : 'Leads'}
                          </span>
                        </h3>
                        <p className={`text-[10px] max-w-md ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>{config.desc}</p>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold block ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          R$ {columnSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Valor Acumulado na Etapa</span>
                      </div>
                    </div>

                    {/* Lista de Leads da Etapa (Cards Compactos) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                      {columnLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className={`border rounded-xl p-3 transition-all group ${
                            theme === 'light' ? 'bg-white border-slate-200 hover:border-purple-300 shadow-sm' : 'bg-[#0f0b18]/40 hover:bg-[#0f0b18] border border-slate-850 hover:border-purple-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <h4 className={`text-[11px] font-bold truncate ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{lead.name}</h4>
                              <p className="text-[9px] text-slate-500 truncate">{lead.company || 'Individual'}</p>
                            </div>
                            <div className={`flex gap-1 transition-opacity ${theme === 'light' ? 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                              <button onClick={() => handleOpenEditModal(lead)} className="p-1 text-slate-500 hover:text-purple-600 transition-colors"><Edit3 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteLead(lead.id, lead.name)} className="p-1 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>

                          <div className={`flex items-center justify-between mt-auto pt-2 border-t ${theme === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
                            <div className="flex items-center gap-2">
                              {lead.phone && (
                                <a 
                                  href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    theme === 'light' ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                  }`}
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              )}
                              {lead.projectId ? (
                                <button 
                                  onClick={() => onOpenProject && onOpenProject(lead.projectId!)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    theme === 'light' ? 'bg-purple-50 text-purple-600 hover:bg-purple-100' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                  }`}
                                >
                                  <Layers className="w-3 h-3" />
                                </button>
                              ) : lead.website && onOpenRemasterModal && (
                                <button 
                                  onClick={() => onOpenRemasterModal({ id: lead.id, name: lead.name, website: lead.website, phone: lead.phone, address: lead.address })}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    theme === 'light' ? 'bg-pink-50 text-pink-600 hover:bg-pink-100' : 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20'
                                  }`}
                                >
                                  <Sparkles className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <span className={`text-[11px] font-bold font-mono ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>
                              R$ {Number(lead.dealValue).toLocaleString('pt-BR')}
                            </span>
                          </div>

                          {/* Seletor Rápido de Mudança de Etapa */}
                          <div className="mt-2 flex items-center gap-1.5">
                            <select
                              value={lead.status}
                              onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
                              className={`w-full text-[9px] border rounded-md px-1.5 py-1 focus:outline-none focus:border-purple-500/50 cursor-pointer transition-colors ${
                                theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-black/30 border border-white/5 text-slate-400 hover:text-slate-300'
                              }`}
                            >
                              {STATUS_COLUMNS.map(st => (
                                <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}

                      {columnLeads.length === 0 && (
                        <div className={`col-span-full py-4 px-6 border border-dashed rounded-xl text-center ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
                          <span className="text-[10px] text-slate-600 font-medium italic">Nenhum lead nesta fase do pipeline</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visualização em Lista / Tabela */
        <div className={`border rounded-2xl overflow-hidden shadow-xl ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f0b18] border-slate-850'}`}>
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
              <thead className={`border-b text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-[var(--bg-app)] border-slate-850 text-slate-400'}`}>
                <tr>
                  <th className="py-3 px-4">Cliente / Empresa</th>
                  <th className="py-3 px-4">Status no Funil</th>
                  <th className="py-3 px-4">Valor Estimado</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Site / Proposta IA</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'light' ? 'divide-slate-100' : 'divide-slate-850/60'}`}>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className={`transition-colors ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-purple-950/20'}`}>
                    <td className="py-3.5 px-4">
                      <span className={`font-bold block ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{lead.name}</span>
                      {lead.company && <span className={`text-[10px] block ${theme === 'light' ? 'text-slate-400' : 'text-slate-400'}`}>{lead.company}</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].border} ${STATUS_CONFIG[lead.status].color}`}>
                        {STATUS_CONFIG[lead.status].label}
                      </span>
                    </td>

                    <td className={`py-3.5 px-4 font-mono font-bold ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>
                      R$ {(Number(lead.dealValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="py-3.5 px-4 space-y-0.5">
                      {lead.phone && (
                        <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={`hover:underline block text-[11px] ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`}>
                          {lead.phone}
                        </a>
                      )}
                      {lead.email && <span className="text-[10px] text-slate-400 block">{lead.email}</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      {lead.projectId ? (
                        <button
                          onClick={() => onOpenProject && onOpenProject(lead.projectId!)}
                          className={`flex items-center gap-1 px-2.5 py-1 border rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                            theme === 'light' ? 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100' : 'bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          {lead.projectName || 'Site Vinculado'}
                        </button>
                      ) : lead.website && onOpenRemasterModal ? (
                        <button
                          onClick={() => onOpenRemasterModal({ id: lead.id, name: lead.name, website: lead.website, phone: lead.phone, address: lead.address })}
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
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${theme === 'light' ? 'text-slate-400 hover:text-purple-600 hover:bg-slate-100' : 'text-slate-400 hover:text-purple-300 hover:bg-slate-900'}`}
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id, lead.name)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${theme === 'light' ? 'text-slate-400 hover:text-red-600 hover:bg-slate-100' : 'text-slate-400 hover:text-red-400 hover:bg-slate-900'}`}
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
          <div className={`w-full max-w-xl border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-850'}`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[var(--bg-app)] border-slate-850'}`}>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {editingLead ? `Editar Cliente: ${editingLead.name}` : 'Novo Cliente no Funil'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className={`p-1.5 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Nome do Contato / Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Dr. Roberto Silva"
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Ex: Clínica Odonto Premium"
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@empresa.com"
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Website Atual (se houver)
                  </label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://empresa.com.br"
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Valor Estimado do Contrato (R$)
                  </label>
                  <input
                    type="number"
                    value={formData.dealValue}
                    onChange={(e) => setFormData({ ...formData, dealValue: e.target.value })}
                    placeholder="1500"
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono focus:outline-none focus:border-purple-500 ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Status no Funil de Vendas
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 cursor-pointer ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-white'
                    }`}
                  >
                    {STATUS_COLUMNS.map(st => (
                      <option key={st} value={st}>
                        {STATUS_CONFIG[st].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Vincular a Projeto / Site Criado
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 cursor-pointer ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-white'
                    }`}
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
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  Endereço / Localização
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo SP"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  Anotações Comerciais & Reuniões
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Cliente quer foco em botões de WhatsApp e galeria de fotos. Reunião de fechamento marcada para quinta."
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-xs focus:outline-none focus:border-purple-500 resize-none ${
                    theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500'
                  }`}
                />
              </div>

              <div className={`pt-4 border-t flex items-center justify-end gap-3 ${theme === 'light' ? 'border-slate-100' : 'border-slate-850'}`}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-900 hover:bg-slate-850 text-slate-300'
                  }`}
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
