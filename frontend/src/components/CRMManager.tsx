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
  ChevronDown,
  Send,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Link as LinkIcon,
  LayoutGrid,
  ArrowRight,
  Eye
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

const STATUS_CONFIG: Record<LeadStatus, { label: string; shortLabel: string; color: string; textColor: string; bg: string; border: string; gradient: string; icon: React.ReactNode; desc: string }> = {
  PROSPECT: {
    label: 'Prospecção / Novo Lead',
    shortLabel: 'Prospecção',
    color: 'sky',
    textColor: 'text-sky-400',
    bg: 'bg-sky-950/30',
    border: 'border-sky-500/30',
    gradient: 'from-sky-600/20 to-sky-800/10',
    icon: <Eye className="w-4 h-4" />,
    desc: 'Lead descoberto ou cadastrado recentemente'
  },
  CONTACTED: {
    label: 'Primeiro Contato Feito',
    shortLabel: 'Contato',
    color: 'indigo',
    textColor: 'text-indigo-400',
    bg: 'bg-indigo-950/30',
    border: 'border-indigo-500/30',
    gradient: 'from-indigo-600/20 to-indigo-800/10',
    icon: <Phone className="w-4 h-4" />,
    desc: 'Abordagem inicial realizada pelo WhatsApp/Telefone'
  },
  PROPOSAL_SENT: {
    label: 'Proposta / Mockup Enviado',
    shortLabel: 'Proposta',
    color: 'purple',
    textColor: 'text-purple-400',
    bg: 'bg-purple-950/30',
    border: 'border-purple-500/30',
    gradient: 'from-purple-600/20 to-purple-800/10',
    icon: <Send className="w-4 h-4" />,
    desc: 'Demonstração do site ou proposta comercial enviada'
  },
  IN_NEGOTIATION: {
    label: 'Em Negociação',
    shortLabel: 'Negociação',
    color: 'amber',
    textColor: 'text-amber-400',
    bg: 'bg-amber-950/30',
    border: 'border-amber-500/30',
    gradient: 'from-amber-600/20 to-amber-800/10',
    icon: <MessageSquare className="w-4 h-4" />,
    desc: 'Ajustes de escopo, valores e condições de fechamento'
  },
  WON: {
    label: 'Ganho / Venda Fechada',
    shortLabel: 'Ganho',
    color: 'emerald',
    textColor: 'text-emerald-400',
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-600/20 to-emerald-800/10',
    icon: <CheckCircle2 className="w-4 h-4" />,
    desc: 'Contrato fechado e pagamento recebido'
  },
  LOST: {
    label: 'Perdido / Desistência',
    shortLabel: 'Perdido',
    color: 'rose',
    textColor: 'text-rose-400',
    bg: 'bg-rose-950/30',
    border: 'border-rose-500/30',
    gradient: 'from-rose-600/20 to-rose-800/10',
    icon: <X className="w-4 h-4" />,
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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<CRMLead> | null>(null);

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
    setFormData({ name: '', company: '', phone: '', email: '', website: '', address: '', dealValue: '1500', status: 'PROSPECT', notes: '', projectId: '' });
    setShowModal(true);
  };

  const handleOpenEditModal = (lead: CRMLead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name, company: lead.company || '', phone: lead.phone || '', email: lead.email || '',
      website: lead.website || '', address: lead.address || '', dealValue: (lead.dealValue || 0).toString(),
      status: lead.status, notes: lead.notes || '', projectId: lead.projectId || ''
    });
    setShowModal(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      const payload = {
        name: formData.name.trim(), company: formData.company.trim() || null, phone: formData.phone.trim() || null,
        email: formData.email.trim() || null, website: formData.website.trim() || null, address: formData.address.trim() || null,
        dealValue: parseFloat(formData.dealValue) || 0, status: formData.status, notes: formData.notes.trim() || null, projectId: formData.projectId || null
      };
      if (editingLead && editingLead.id) {
        const res = await fetch(`${API_URL}/api/leads/crm/${editingLead.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (res.ok) { fetchLeads(); setShowModal(false); notify.success(`Lead "${payload.name}" atualizado com sucesso!`, 'Salvo'); }
        else throw new Error(data.error || 'Erro ao atualizar lead');
      } else {
        const res = await fetch(`${API_URL}/api/leads/crm`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (res.status === 409) { notify.error(data.error || 'Já existe um cliente com dados semelhantes no seu CRM.', '⚠️ Cliente Duplicado'); return; }
        if (res.ok) { fetchLeads(); setShowModal(false); notify.success(`Lead "${payload.name}" cadastrado com sucesso!`, 'Salvo');
          notify.addBellNotification({ type: 'info', emoji: '🤝', title: 'Novo Lead Cadastrado!', message: `O cliente "${payload.name}" (${payload.company || 'Pessoa Física'}) foi adicionado ao seu CRM.` });
        } else throw new Error(data.error || 'Erro ao cadastrar lead');
      }
    } catch (err: any) { notify.error(err.message || 'Erro ao salvar informações do lead', 'Erro'); }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    const targetLead = leads.find(l => l.id === leadId);
    setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    if (newStatus === 'WON' && targetLead && targetLead.status !== 'WON') {
      const dealFormatted = Number(targetLead.dealValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      notify.success(`Parabéns! Venda de ${dealFormatted} fechada com ${targetLead.name}! 🚀`, '🎉 Contrato Fechado!');
      notify.addBellNotification({ type: 'success', emoji: '💰', title: 'Venda Fechada!', message: `Contrato fechado com ${targetLead.name} no valor de ${dealFormatted}!` });
    }
    try {
      await fetch(`${API_URL}/api/leads/crm/${leadId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) });
    } catch (err) { console.error('Erro ao atualizar status do lead:', err); fetchLeads(); }
  };

  const handleDeleteLead = async (leadId: string, name: string) => {
    if (!window.confirm(`Deseja realmente remover o lead "${name}" do seu CRM?`)) return;
    setLeads(leads.filter(l => l.id !== leadId));
    notify.addBellNotification({ type: 'warning', emoji: '🗑️', title: 'Lead Removido', message: `O lead "${name}" foi excluído do seu pipeline de vendas.` });
    try { await fetch(`${API_URL}/api/leads/crm/${leadId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); }
    catch (err) { console.error('Erro ao excluir lead:', err); fetchLeads(); }
  };

  const toggleSection = (status: string) => {
    setCollapsedSections(prev => { const next = new Set(prev); if (next.has(status)) next.delete(status); else next.add(status); return next; });
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.address && lead.address.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalLeadsCount = leads.length;
  const totalPipelineValue = leads.filter(l => l.status !== 'LOST').reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
  const totalWonValue = leads.filter(l => l.status === 'WON').reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
  const conversionRate = totalLeadsCount > 0 ? Math.round((leads.filter(l => l.status === 'WON').length / totalLeadsCount) * 100) : 0;

  // ======= Lead Card Component =======
  const LeadCard: React.FC<{ lead: CRMLead; compact?: boolean }> = ({ lead, compact }) => (
    <div className={`group relative bg-[#0d0a15] hover:bg-[#14102a] border border-slate-800/60 hover:border-purple-500/30 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-purple-900/10 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${STATUS_CONFIG[lead.status].gradient} border ${STATUS_CONFIG[lead.status].border} flex items-center justify-center ${STATUS_CONFIG[lead.status].textColor}`}>
          <span className="text-sm font-black">{lead.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-bold text-white truncate">{lead.name}</h4>
            {lead.company && <span className="text-[10px] text-slate-500 truncate hidden sm:inline">• {lead.company}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {lead.phone && (
              <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors" title="Abrir WhatsApp">
                <Phone className="w-3 h-3" />{lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-300 transition-colors">
                <Mail className="w-3 h-3" /><span className="truncate max-w-[140px]">{lead.email}</span>
              </a>
            )}
            {lead.website && (
              <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors">
                <Globe className="w-3 h-3" /><span className="truncate max-w-[120px]">{lead.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {lead.address && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500 hidden lg:flex">
                <MapPin className="w-3 h-3" /><span className="truncate max-w-[150px]">{lead.address}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-bold text-emerald-400 hidden sm:block">R$ {(Number(lead.dealValue) || 0).toLocaleString('pt-BR')}</span>
          <select value={lead.status} onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)}
            className={`text-[10px] font-bold rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].border} ${STATUS_CONFIG[lead.status].textColor} bg-black/40`}>
            {STATUS_COLUMNS.map(st => (<option key={st} value={st}>{STATUS_CONFIG[st].shortLabel}</option>))}
          </select>
          {lead.projectId ? (
            <button onClick={() => onOpenProject && onOpenProject(lead.projectId!)} className="flex items-center gap-1 px-2 py-1 bg-purple-950/60 border border-purple-500/30 text-purple-300 rounded-lg text-[10px] font-bold hover:bg-purple-900/60 cursor-pointer transition-colors" title="Abrir Site">
              <Layers className="w-3 h-3" /><span className="hidden xl:inline truncate max-w-[80px]">{lead.projectName || 'Site'}</span>
            </button>
          ) : lead.website && onOpenRemasterModal ? (
            <button onClick={() => onOpenRemasterModal({ id: lead.id, name: lead.name, website: lead.website, phone: lead.phone, address: lead.address })} className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-[10px] font-bold hover:opacity-90 cursor-pointer shadow-sm transition-opacity" title="Gerar Site com IA">
              <Sparkles className="w-3 h-3" /><span className="hidden xl:inline">IA</span>
            </button>
          ) : null}
          <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleOpenEditModal(lead)} className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-950/40 rounded-lg transition-colors cursor-pointer" title="Editar Lead"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleDeleteLead(lead.id, lead.name)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer" title="Remover do CRM"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
      {lead.notes && !compact && (<p className="mt-2 ml-12 text-[10px] text-slate-500 leading-relaxed line-clamp-1 italic">📝 {lead.notes}</p>)}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-10">
      {/* Header do CRM */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            CRM & Funil de Vendas
          </h2>
          <p className="text-xs text-slate-400">Gerencie contatos, negociações e propostas comerciais.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1">
            <button onClick={() => setViewMode('pipeline')} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'pipeline' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Pipeline">
              <LayoutGrid className="w-3.5 h-3.5" /><span>Pipeline</span>
            </button>
            <button onClick={() => setViewMode('list')} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === 'list' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} title="Lista">
              <List className="w-3.5 h-3.5" /><span>Lista</span>
            </button>
          </div>
          <button onClick={handleOpenCreateModal} className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /><span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-md flex items-center justify-between">
          <div><span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Total de Leads</span><span className="text-xl font-extrabold text-white mt-0.5 block font-mono">{totalLeadsCount}</span><span className="text-[10px] text-slate-500 block">No pipeline de vendas</span></div>
          <div className="p-2.5 bg-purple-950/60 border border-purple-500/30 rounded-xl text-purple-400"><UserCheck className="w-5 h-5" /></div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-md flex items-center justify-between">
          <div><span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Pipeline Ativo</span><span className="text-xl font-extrabold text-sky-400 mt-0.5 block font-mono">R$ {totalPipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><span className="text-[10px] text-slate-500 block">Oportunidades em aberto</span></div>
          <div className="p-2.5 bg-sky-950/60 border border-sky-500/30 rounded-xl text-sky-400"><DollarSign className="w-5 h-5" /></div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-md flex items-center justify-between">
          <div><span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Vendas Fechadas</span><span className="text-xl font-extrabold text-emerald-400 mt-0.5 block font-mono">R$ {totalWonValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><span className="text-[10px] text-emerald-500 block font-semibold">{leads.filter(l => l.status === 'WON').length} contratos ganhos</span></div>
          <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>
        </div>
        <div className="p-4 rounded-2xl bg-[#0f0b18] border border-slate-850 shadow-md flex items-center justify-between">
          <div><span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">Taxa de Conversão</span><span className="text-xl font-extrabold text-amber-400 mt-0.5 block font-mono">{conversionRate}%</span><span className="text-[10px] text-slate-500 block">Leads convertidos</span></div>
          <div className="p-2.5 bg-amber-950/60 border border-amber-500/30 rounded-xl text-amber-400"><TrendingUp className="w-5 h-5" /></div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0f0b18] border border-slate-850 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Buscar por cliente, empresa, telefone ou cidade..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-semibold shrink-0">Filtrar Status:</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer">
            <option value="ALL">Todos os Status ({leads.length})</option>
            {STATUS_COLUMNS.map(st => (<option key={st} value={st}>{STATUS_CONFIG[st].label} ({leads.filter(l => l.status === st).length})</option>))}
          </select>
        </div>
      </div>

      {/* =============== PIPELINE VIEW =============== */}
      {viewMode === 'pipeline' ? (
        <div className="space-y-3">
          {/* Pipeline Flow Indicator */}
          <div className="hidden lg:flex items-center gap-1 px-2 overflow-x-auto">
            {STATUS_COLUMNS.map((status, idx) => {
              const config = STATUS_CONFIG[status];
              const count = leads.filter(l => l.status === status).length;
              return (
                <React.Fragment key={status}>
                  <button onClick={() => setStatusFilter(statusFilter === status ? 'ALL' : status)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer whitespace-nowrap ${statusFilter === status ? `${config.bg} ${config.border} ${config.textColor}` : 'bg-slate-950/50 border-slate-800/50 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}>
                    {config.icon}{config.shortLabel}
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono ${count > 0 ? `${config.bg} ${config.textColor}` : 'bg-slate-900 text-slate-600'}`}>{count}</span>
                  </button>
                  {idx < STATUS_COLUMNS.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Collapsible Sections */}
          {STATUS_COLUMNS.map((statusKey) => {
            const config = STATUS_CONFIG[statusKey];
            const sectionLeads = filteredLeads.filter(l => l.status === statusKey);
            const sectionValue = sectionLeads.reduce((acc, l) => acc + (Number(l.dealValue) || 0), 0);
            const isCollapsed = collapsedSections.has(statusKey);
            if (statusFilter !== 'ALL' && statusFilter !== statusKey) return null;
            if (sectionLeads.length === 0 && statusFilter === 'ALL') return null;

            return (
              <div key={statusKey} className="rounded-2xl border border-slate-800/60 overflow-hidden bg-[#0a0812]">
                <button onClick={() => toggleSection(statusKey)} className={`w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-slate-900/50 bg-gradient-to-r ${config.gradient}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${config.bg} ${config.border} border ${config.textColor}`}>{config.icon}</div>
                    <div className="text-left">
                      <span className={`text-xs font-bold ${config.textColor}`}>{config.label}</span>
                      <span className="text-[10px] text-slate-500 block">{config.desc}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <span className="text-xs font-mono font-bold text-emerald-400 block">R$ {sectionValue.toLocaleString('pt-BR')}</span>
                      <span className="text-[10px] text-slate-500">{sectionLeads.length} {sectionLeads.length === 1 ? 'lead' : 'leads'}</span>
                    </div>
                    <div className={`p-1 rounded-lg text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}><ChevronRight className="w-4 h-4" /></div>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="p-3 space-y-2 border-t border-slate-800/40">
                    {sectionLeads.map((lead, idx) => (
                      <div key={lead.id} style={{ animationDelay: `${idx * 30}ms` }} className="animate-fade-in"><LeadCard lead={lead} compact /></div>
                    ))}
                    {sectionLeads.length === 0 && (
                      <div className="py-8 text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed ${config.border} ${config.bg}`}>
                          <HelpCircle className={`w-4 h-4 ${config.textColor}`} /><span className={`text-xs ${config.textColor}`}>Nenhum lead nesta etapa</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredLeads.length === 0 && (
            <div className="py-16 text-center bg-[#0a0812] rounded-2xl border border-slate-800/40">
              <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-semibold">Nenhum lead encontrado</p>
              <p className="text-xs text-slate-600 mt-1">Tente ajustar os filtros ou adicione um novo cliente.</p>
              <button onClick={handleOpenCreateModal} className="mt-4 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer"><Plus className="w-3.5 h-3.5 inline mr-1" /> Adicionar Primeiro Cliente</button>
            </div>
          )}
        </div>
      ) : (
        /* =============== LIST / TABLE VIEW =============== */
        <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[var(--bg-app)] border-b border-slate-850 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                    <td className="py-3.5 px-4"><span className="font-bold text-white block">{lead.name}</span>{lead.company && <span className="text-[10px] text-slate-400 block">{lead.company}</span>}</td>
                    <td className="py-3.5 px-4">
                      <select value={lead.status} onChange={(e) => handleUpdateStatus(lead.id, e.target.value as LeadStatus)} className={`text-[10px] font-bold rounded-lg px-2.5 py-1 border cursor-pointer focus:outline-none ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].border} ${STATUS_CONFIG[lead.status].textColor} bg-black/40`}>
                        {STATUS_COLUMNS.map(st => (<option key={st} value={st}>{STATUS_CONFIG[st].shortLabel}</option>))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">R$ {(Number(lead.dealValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 space-y-0.5">
                      {lead.phone && (<a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline block text-[11px]">{lead.phone}</a>)}
                      {lead.email && <span className="text-[10px] text-slate-400 block">{lead.email}</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      {lead.projectId ? (
                        <button onClick={() => onOpenProject && onOpenProject(lead.projectId!)} className="flex items-center gap-1 px-2.5 py-1 bg-purple-950/60 border border-purple-500/40 text-purple-300 rounded-lg text-[10px] font-bold hover:bg-purple-900/60 cursor-pointer"><Layers className="w-3 h-3" />{lead.projectName || 'Site Vinculado'}</button>
                      ) : lead.website && onOpenRemasterModal ? (
                        <button onClick={() => onOpenRemasterModal({ id: lead.id, name: lead.name, website: lead.website, phone: lead.phone, address: lead.address })} className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-[10px] font-bold hover:opacity-90 cursor-pointer shadow"><Sparkles className="w-3 h-3 text-pink-300" />Criar Site com IA</button>
                      ) : (<span className="text-[10px] text-slate-500">Sem site</span>)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button onClick={() => handleOpenEditModal(lead)} className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer" title="Editar"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteLead(lead.id, lead.name)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors cursor-pointer" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-950 border border-slate-850 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-[var(--bg-app)] border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-400" /><h3 className="text-base font-bold text-white">{editingLead ? `Editar Cliente: ${editingLead.name}` : 'Novo Cliente no Funil'}</h3></div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveLead} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nome do Contato / Cliente *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Dr. Roberto Silva" className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500" /></div>
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nome da Empresa</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} placeholder="Ex: Clínica Odonto Premium" className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Telefone / WhatsApp</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(11) 99999-9999" className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500" /></div>
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">E-mail</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contato@empresa.com" className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Website Atual (se houver)</label><input type="text" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://empresa.com.br" className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500" /></div>
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Valor Estimado do Contrato (R$)</label><input type="number" value={formData.dealValue} onChange={(e) => setFormData({ ...formData, dealValue: e.target.value })} placeholder="1500" className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Status no Funil de Vendas</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })} className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer">
                    {STATUS_COLUMNS.map(st => (<option key={st} value={st}>{STATUS_CONFIG[st].label}</option>))}
                  </select>
                </div>
                <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Vincular a Projeto / Site Criado</label>
                  <select value={formData.projectId} onChange={(e) => setFormData({ ...formData, projectId: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer">
                    <option value="">Nenhum (Criar depois)</option>
                    {projects.map(p => (<option key={p.id} value={p.id}>{p.name} {p.domain ? `(${p.domain})` : ''}</option>))}
                  </select>
                </div>
              </div>
              <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Endereço / Localização</label><input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Ex: Av. Paulista, 1000 - São Paulo SP" className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500" /></div>
              <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Anotações Comerciais & Reuniões</label><textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Ex: Cliente quer foco em botões de WhatsApp e galeria de fotos." className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 resize-none" /></div>
              <div className="pt-4 border-t border-slate-850 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer">{editingLead ? 'Salvar Alterações' : 'Adicionar ao CRM'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
