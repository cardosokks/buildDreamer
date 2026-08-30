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
  ArrowRight,
  Store,
  Package,
  History,
  Download,
  DollarSign,
  ShoppingCart
} from 'lucide-react';
import { API_URL, safeJson } from '../config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';

interface Product {
  id: string;
  name: string;
  price: number;
  siteUrl?: string;
  projectId?: string;
}

interface Sale {
  id: string;
  leadId: string;
  productId: string;
  productName: string;
  amount: number;
  createdAt: string;
  notes?: string;
  lead?: { name: string; company?: string };
}

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

export const CRMManager: React.FC<CRMManagerProps> = ({ onOpenRemasterModal, onOpenProject, onStartCreateFlow, projects }) => {
  const { token } = useAuth();
  const { theme } = useTheme();
  const notify = useNotification();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Product & Sale states
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    siteUrl: '',
    projectId: ''
  });
  
  const [saleForm, setSaleForm] = useState({
    productId: '',
    notes: ''
  });

  const [dateFilter, setDateFilter] = useState({
    start: '',
    end: ''
  });
  
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
        setLeads(Array.isArray(data) ? data : []);
      }
      
      // Fetch Products
      const prodRes = await fetch(`${API_URL}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (prodRes.ok) {
        const data = await safeJson(prodRes);
        setProducts(Array.isArray(data) ? data : []);
      }
      
      // Fetch Sales
      const salesRes = await fetch(`${API_URL}/api/sales`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (salesRes.ok) {
        const data = await safeJson(salesRes);
        setSales(Array.isArray(data) ? data : []);
      }
      
    } catch (err) {
      console.error('Error fetching data:', err);
      notify.error('Falha ao carregar dados do CRM');
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
    // Hidden as per requirements
    return;
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) {
      notify.error('Nome e preço são obrigatórios');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...productForm,
          price: parseFloat(productForm.price)
        })
      });
      
      const data = await safeJson(res);
      
      if (res.ok) {
        notify.success('Produto criado com sucesso');
        setShowProductModal(false);
        setProductForm({ name: '', price: '', siteUrl: '', projectId: '' });
        fetchLeads();
      } else {
        notify.error(data.error || 'Erro ao criar produto');
      }
    } catch (err) {
      console.error('Error creating product:', err);
      notify.error('Erro de conexão ao criar produto');
    }
  };

  const handleRegisterSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    
    const product = products.find(p => p.id === saleForm.productId);
    if (!product) {
      notify.error('Produto não encontrado');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/sales`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leadId: selectedLead.id,
          productId: saleForm.productId,
          productName: product.name,
          amount: product.price,
          notes: saleForm.notes
        })
      });
      if (res.ok) {
        notify.success('Venda registrada com sucesso');
        setShowSaleModal(false);
        setSaleForm({ productId: '', notes: '' });
        fetchLeads();
      }
    } catch (err) {
      notify.error('Erro ao registrar venda');
    }
  };

  const downloadHistory = () => {
    const filteredSales = sales.filter(s => {
      if (dateFilter.start && new Date(s.createdAt) < new Date(dateFilter.start)) return false;
      if (dateFilter.end && new Date(s.createdAt) > new Date(dateFilter.end)) return false;
      return true;
    });

    const csv = [
      ['Data', 'Cliente', 'Produto', 'Valor', 'Notas'],
      ...filteredSales.map(s => [
        new Date(s.createdAt).toLocaleDateString(),
        s.lead?.name || 'N/A',
        s.productName,
        s.amount.toFixed(2),
        s.notes || ''
      ])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-vendas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Total Vendas</div>
            <div className="text-sm font-black text-emerald-400">
              R$ {sales.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <button
            onClick={() => setShowProductModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <Package className="w-4 h-4" />
            Criar Produtos
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
          >
            <History className="w-4 h-4" />
            Histórico
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
                <div 
                  key={lead.id} 
                  onClick={() => {
                    setSelectedLead(lead);
                    setShowSaleModal(true);
                  }}
                  className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-slate-900/40 transition-all group cursor-pointer"
                >
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
                      Vendas: R$ {sales.filter(s => s.leadId === lead.id).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                        onClick={(e) => { e.stopPropagation(); onOpenProject && onOpenProject(linkedProject.id); }}
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
                  <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                    <button
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg hover:bg-emerald-600/20 transition-all"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Lançar Venda
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
      {/* Product Management Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0c] border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="text-indigo-400 w-5 h-5" />
                Gerenciar Produtos
              </h3>
              <button onClick={() => setShowProductModal(false)} className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    value={productForm.name}
                    onChange={e => setProductForm({...productForm, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Ex: Site Institucional"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Preço (R$)</label>
                  <input
                    type="number"
                    required
                    value={productForm.price}
                    onChange={e => setProductForm({...productForm, price: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Vincular a um Site (Link ou Projeto)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productForm.siteUrl}
                    onChange={e => setProductForm({...productForm, siteUrl: e.target.value})}
                    className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Cole o link ou selecione ao lado"
                  />
                  <select
                    value={productForm.projectId}
                    onChange={e => {
                      const pid = e.target.value;
                      const project = projects.find(p => p.id === pid);
                      let siteUrl = productForm.siteUrl;
                      if (project) {
                        siteUrl = project.domain ? `https://${project.domain}` : `https://preview.meusite.com/${project.id}`;
                      }
                      setProductForm({
                        ...productForm,
                        projectId: pid,
                        siteUrl: siteUrl
                      });
                    }}
                    className="w-40 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white cursor-pointer"
                  >
                    <option value="">Meus Sites</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all cursor-pointer">
                Criar Produto
              </button>
            </form>

            <div className="border-t border-slate-800 pt-4 max-h-60 overflow-y-auto space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">Produtos Cadastrados</h4>
              {products.length === 0 ? (
                <div className="text-center py-4 text-slate-600 text-xs italic">Nenhum produto cadastrado.</div>
              ) : products.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                  <div>
                    <div className="text-sm font-bold text-white">{p.name}</div>
                    <div className="text-xs text-slate-500">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                  {p.siteUrl && (
                    <a href={p.siteUrl} target="_blank" rel="noreferrer" className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all" title="Ver Link">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sale Registration Modal */}
      {showSaleModal && selectedLead && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0c] border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Lançar Venda</h3>
                <p className="text-xs text-slate-500">Registrando venda para {selectedLead.name}</p>
              </div>
              <button onClick={() => setShowSaleModal(false)} className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSale} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Selecionar Produto</label>
                <select
                  required
                  value={saleForm.productId}
                  onChange={e => setSaleForm({...saleForm, productId: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  <option value="">Selecione um produto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</option>
                  ))}
                </select>
                {products.length === 0 && (
                  <p className="text-[10px] text-amber-500">Nenhum produto cadastrado. Crie um produto primeiro.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Observações da Venda</label>
                <textarea
                  value={saleForm.notes}
                  onChange={e => setSaleForm({...saleForm, notes: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm resize-none focus:border-emerald-500 focus:outline-none"
                  rows={3}
                  placeholder="Detalhes adicionais..."
                />
              </div>
              <button 
                type="submit" 
                disabled={products.length === 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20"
              >
                <DollarSign className="w-4 h-4" />
                Confirmar Venda
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0c] border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Histórico de Vendas Mensal</h3>
                  <p className="text-xs text-slate-500">Visualize e exporte seu desempenho comercial.</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-xl cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Início:</label>
                <input
                  type="date"
                  value={dateFilter.start}
                  onChange={e => setDateFilter({...dateFilter, start: e.target.value})}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Fim:</label>
                <input
                  type="date"
                  value={dateFilter.end}
                  onChange={e => setDateFilter({...dateFilter, end: e.target.value})}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                onClick={downloadHistory}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left">
                <thead className="bg-slate-900/80 sticky top-0 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Produto</th>
                    <th className="px-6 py-4">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sales
                    .filter(s => {
                      if (dateFilter.start && new Date(s.createdAt) < new Date(dateFilter.start)) return false;
                      if (dateFilter.end && new Date(s.createdAt) > new Date(dateFilter.end)) return false;
                      return true;
                    })
                    .map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-white">{sale.lead?.name}</div>
                          <div className="text-[10px] text-slate-500">{sale.lead?.company}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-300">
                          {sale.productName}
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-400 text-sm">
                          R$ {sale.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {sales.length === 0 && (
                <div className="p-12 text-center text-slate-600 italic text-xs">Nenhuma venda registrada no período.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
