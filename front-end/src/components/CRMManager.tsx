import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Phone, 
  Mail, 
  Globe, 
  Calendar, 
  TrendingUp, 
  UserPlus, 
  Trash2, 
  Edit2, 
  Zap, 
  Sparkles, 
  Layout, 
  ExternalLink, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  X,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { API_URL, safeJson } from '../config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

interface Lead {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  status: string; // PROSPECT, CONTACTED, PROPOSAL_SENT, IN_NEGOTIATION, WON, LOST
  dealValue: number;
  notes?: string;
  origin?: string;
  tags?: string;
  lastContactDate?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

interface CRMManagerProps {
  onOpenRemasterModal?: (lead: Lead) => void;
  onOpenProject?: (projectId: string) => void;
  onStartCreateFlow?: (lead: Lead) => void;
  projects: any[];
}

const STATUS_OPTIONS = [
  { value: 'PROSPECT', label: 'Prospecto', color: 'bg-blue-500' },
  { value: 'CONTACTED', label: 'Contatado', color: 'bg-yellow-500' },
  { value: 'PROPOSAL_SENT', label: 'Proposta Enviada', color: 'bg-purple-500' },
  { value: 'IN_NEGOTIATION', label: 'Em Negociação', color: 'bg-orange-500' },
  { value: 'WON', label: 'Fechado (Ganho)', color: 'bg-green-500' },
  { value: 'LOST', label: 'Perdido', color: 'bg-red-500' },
];

export const CRMManager: React.FC<CRMManagerProps> = ({ onOpenRemasterModal, onOpenProject, projects }) => {
  const { token } = useAuth();
  const { theme } = useTheme();
  const notify = useNotification();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    status: 'PROSPECT',
    dealValue: '0',
    notes: '',
    tags: ''
  });

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeJson(res);
        setLeads(data);
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      notify.error('Falha ao carregar leads do CRM');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [token]);

  const handleOpenEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      company: lead.company || '',
      phone: lead.phone || '',
      email: lead.email || '',
      website: lead.website || '',
      address: lead.address || '',
      status: lead.status,
      dealValue: lead.dealValue.toString(),
      notes: lead.notes || '',
      tags: lead.tags || ''
    });
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingLead(null);
    setFormData({
      name: '',
      company: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      status: 'PROSPECT',
      dealValue: '0',
      notes: '',
      tags: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingLead ? `${API_URL}/api/leads/${editingLead.id}` : `${API_URL}/api/leads`;
    const method = editingLead ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        notify.success(editingLead ? 'Lead atualizado' : 'Lead cadastrado com sucesso');
        handleCloseModal();
        fetchLeads();
      } else {
        const err = await safeJson(res);
        notify.error(err.error || 'Erro ao salvar lead');
      }
    } catch (err) {
      notify.error('Erro de conexão com o servidor');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente do CRM?')) return;

    try {
      const res = await fetch(`${API_URL}/api/leads/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        notify.success('Lead removido com sucesso');
        fetchLeads();
      } else {
        notify.error('Erro ao excluir lead');
      }
    } catch (err) {
      notify.error('Erro de conexão');
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (lead.company?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status);
    if (!opt) return null;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${opt.color}`}>
        {opt.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* CRM Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f0b18] border border-slate-850 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 shadow-inner">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Funil de Vendas de Sites</h2>
            <p className="text-xs text-slate-400">Gerencie seus prospectos e converta-os em clientes ativos.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total Ganho</div>
            <div className="text-sm font-black text-emerald-400">
              R$ {leads.filter(l => l.status === 'WON').reduce((acc, curr) => acc + curr.dealValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0f0b18] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-2.5 bg-[#0f0b18] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
        >
          <option value="ALL">Todos os Status</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Leads List */}
      <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>Nome / Empresa</span>
          <span>Status / Valor</span>
          <span>Contato</span>
          <span>Projeto Vinculado</span>
          <span className="text-right">Ações</span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Sparkles className="w-8 h-8 text-indigo-500/50 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Carregando funil de vendas...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-800 mx-auto mb-4" />
            <h3 className="text-white font-bold text-sm">Nenhum cliente encontrado</h3>
            <p className="text-xs text-slate-500 mt-1">Comece cadastrando um novo lead ou importe do buscador.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredLeads.map(lead => {
              const linkedProject = projects.find(p => p.id === lead.projectId);
              
              return (
                <div key={lead.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-900/30 transition-all group">
                  {/* Name & Company */}
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm truncate">{lead.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                      <Store className="w-3 h-3" />
                      <span className="truncate">{lead.company || 'Pessoa Física'}</span>
                    </div>
                  </div>

                  {/* Status & Value */}
                  <div>
                    <div className="mb-1">{getStatusBadge(lead.status)}</div>
                    <div className="text-xs font-mono font-bold text-slate-300">
                      R$ {lead.dealValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1">
                    {lead.phone && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {lead.phone}
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Linked Project */}
                  <div>
                    {linkedProject ? (
                      <button
                        onClick={() => onOpenProject && onOpenProject(linkedProject.id)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-bold text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer truncate"
                      >
                        <Globe className="w-3 h-3" />
                        {linkedProject.name}
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600 italic">Nenhum site</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    {/* Action: Create or Improve Site */}
                    {lead.website ? (
                      <button
                        onClick={() => onOpenRemasterModal && onOpenRemasterModal(lead)}
                        className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                        title="Melhorar Website Existente"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartCreateFlow && onStartCreateFlow(lead)}
                        className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all cursor-pointer"
                        title="Criar Site do Zero"
                      >
                        <Layout className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEdit(lead)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(lead.id)}
                      className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0a0a0c] border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                  {editingLead ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{editingLead ? 'Editar Cliente' : 'Novo Cliente CRM'}</h3>
                  <p className="text-xs text-slate-500">Preencha os dados do prospecto para o funil.</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Empresa / Negócio</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white"
                    placeholder="Ex: Padaria Bela Vista"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Website Atual</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white"
                    placeholder="https://siteatual.com.br"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status no Funil</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white cursor-pointer"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor Estimado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.dealValue}
                    onChange={e => setFormData({ ...formData, dealValue: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tags (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white"
                    placeholder="Urgente, Sem Site, Premium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Observações / Histórico</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:border-indigo-500 focus:outline-none text-sm text-white resize-none"
                  placeholder="Detalhes sobre a última conversa, dores do cliente, etc..."
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-900/20 transition-all cursor-pointer"
                >
                  {editingLead ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
