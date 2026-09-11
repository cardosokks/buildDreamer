import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  X, 
  Check, 
  CheckCircle2, 
  DollarSign, 
  TrendingUp, 
  Tag, 
  Layers, 
  Globe, 
  Sparkles, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  Eye, 
  Grid, 
  List, 
  ArrowUpDown, 
  ShoppingCart, 
  ShieldCheck, 
  Zap, 
  Clock, 
  ArrowUpRight,
  Info,
  ChevronRight,
  Percent,
  FileText
} from 'lucide-react';
import { API_URL, safeJson } from '../config';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  sku?: string;
  status?: 'ACTIVE' | 'INACTIVE' | string;
  billingType?: 'ONE_TIME' | 'MONTHLY' | 'YEARLY' | 'RECURRENT' | string;
  costPrice?: number;
  siteUrl?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Sale {
  id: string;
  leadId: string;
  productId?: string;
  productName: string;
  amount: number;
  createdAt: string;
  notes?: string;
  lead?: { name: string; company?: string };
}

interface ProductManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  sales?: Sale[];
  projects: any[];
  onRefreshProducts: () => void;
  onSelectProductForSale?: (product: Product) => void;
  onOpenProject?: (projectId: string) => void;
}

const CATEGORY_OPTIONS = [
  'Todos',
  'Websites & Landing Pages',
  'E-commerce & Lojas Virtuais',
  'Design & Branding',
  'Manutenção & Hospedagem',
  'Tráfego Pago & SEO',
  'Consultoria & Serviços',
  'SaaS & Softwares',
  'Geral'
];

const BILLING_TYPES = [
  { value: 'ONE_TIME', label: 'Pagamento Único', icon: DollarSign, badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { value: 'MONTHLY', label: 'Mensalidade (Recorrente)', icon: Clock, badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { value: 'YEARLY', label: 'Assinatura Anual', icon: Sparkles, badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20' }
];

export const ProductManagerModal: React.FC<ProductManagerModalProps> = ({
  isOpen,
  onClose,
  products,
  sales = [],
  projects,
  onRefreshProducts,
  onSelectProductForSale,
  onOpenProject
}) => {
  const { token } = useAuth();
  const notify = useNotification();

  // Modal display mode (desktop fullscreen by default)
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Search, Filter & Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [billingFilter, setBillingFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc' | 'name_asc' | 'sales_desc'>('recent');

  // Drawer / Form state (for creating or editing)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    costPrice: '',
    sku: '',
    category: 'Websites & Landing Pages',
    billingType: 'ONE_TIME',
    status: 'ACTIVE',
    description: '',
    siteUrl: '',
    projectId: ''
  });

  // Selected product for detail inspection drawer
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Delete confirmation modal state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state when open or editingProduct changes
  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name || '',
        price: editingProduct.price !== undefined ? String(editingProduct.price) : '',
        costPrice: editingProduct.costPrice !== undefined && editingProduct.costPrice !== null ? String(editingProduct.costPrice) : '',
        sku: editingProduct.sku || '',
        category: editingProduct.category || 'Websites & Landing Pages',
        billingType: editingProduct.billingType || 'ONE_TIME',
        status: editingProduct.status || 'ACTIVE',
        description: editingProduct.description || '',
        siteUrl: editingProduct.siteUrl || '',
        projectId: editingProduct.projectId || ''
      });
      setIsFormOpen(true);
    }
  }, [editingProduct]);

  if (!isOpen) return null;

  // Calculate product sales & revenue statistics
  const productStatsMap = useMemo(() => {
    const stats: Record<string, { count: number; totalRevenue: number }> = {};
    sales.forEach(sale => {
      const pId = sale.productId;
      if (pId) {
        if (!stats[pId]) stats[pId] = { count: 0, totalRevenue: 0 };
        stats[pId].count += 1;
        stats[pId].totalRevenue += Number(sale.amount || 0);
      }
    });
    return stats;
  }, [sales]);

  // Overall catalog metrics
  const totalProducts = products.length;
  const activeProducts = products.filter(p => (p.status || 'ACTIVE') === 'ACTIVE').length;
  const avgPrice = totalProducts > 0 
    ? products.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0) / totalProducts 
    : 0;
  const totalProductSalesRevenue = sales.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Profit Margin calculation helper for form
  const parsedPrice = parseFloat(formData.price) || 0;
  const parsedCost = parseFloat(formData.costPrice) || 0;
  const profitValue = parsedPrice - parsedCost;
  const profitMarginPercent = parsedPrice > 0 ? ((profitValue / parsedPrice) * 100).toFixed(1) : '0';

  // Filter & Sort Logic
  const filteredProducts = products.filter(p => {
    const nameMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase());
    const descMatch = (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const catMatch = (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const searchCondition = nameMatch || skuMatch || descMatch || catMatch;

    const categoryCondition = selectedCategory === 'Todos' || p.category === selectedCategory;
    const statusCondition = statusFilter === 'ALL' || (p.status || 'ACTIVE') === statusFilter;
    const billingCondition = billingFilter === 'ALL' || (p.billingType || 'ONE_TIME') === billingFilter;

    return searchCondition && categoryCondition && statusCondition && billingCondition;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'sales_desc') {
      const salesA = productStatsMap[a.id]?.count || 0;
      const salesB = productStatsMap[b.id]?.count || 0;
      return salesB - salesA;
    }
    // Default: recent
    return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      costPrice: '',
      sku: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      category: 'Websites & Landing Pages',
      billingType: 'ONE_TIME',
      status: 'ACTIVE',
      description: '',
      siteUrl: '',
      projectId: ''
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
  };

  const handleDuplicateProduct = (prod: Product) => {
    setEditingProduct(null);
    setFormData({
      name: `${prod.name} (Cópia)`,
      price: String(prod.price),
      costPrice: prod.costPrice ? String(prod.costPrice) : '',
      sku: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      category: prod.category || 'Websites & Landing Pages',
      billingType: prod.billingType || 'ONE_TIME',
      status: 'ACTIVE',
      description: prod.description || '',
      siteUrl: prod.siteUrl || '',
      projectId: prod.projectId || ''
    });
    setIsFormOpen(true);
    notify.info('Dados copiados para novo cadastro');
  };

  const handleToggleStatus = async (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = (product.status || 'ACTIVE') === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`${API_URL}/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        notify.success(`Produto ${newStatus === 'ACTIVE' ? 'ativado' : 'desativado'} com sucesso`);
        onRefreshProducts();
        if (viewingProduct?.id === product.id) {
          setViewingProduct({ ...viewingProduct, status: newStatus });
        }
      } else {
        notify.error('Erro ao alterar status do produto');
      }
    } catch (err) {
      notify.error('Erro de conexão ao atualizar status');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      notify.error('Nome e preço de venda são obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingProduct 
        ? `${API_URL}/api/products/${editingProduct.id}` 
        : `${API_URL}/api/products`;
      const method = editingProduct ? 'PUT' : 'POST';

      const payload = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
        sku: formData.sku.trim() || null,
        category: formData.category,
        billingType: formData.billingType,
        status: formData.status,
        description: formData.description.trim() || null,
        siteUrl: formData.siteUrl.trim() || null,
        projectId: formData.projectId || null
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(res);
      if (res.ok) {
        notify.success(editingProduct ? 'Produto atualizado com sucesso' : 'Produto cadastrado com sucesso');
        handleCloseForm();
        onRefreshProducts();
        if (viewingProduct?.id === editingProduct?.id) {
          setViewingProduct({ ...viewingProduct, ...payload, id: editingProduct.id });
        }
      } else {
        notify.error(data.error || 'Erro ao salvar produto');
      }
    } catch (err) {
      console.error('Error saving product:', err);
      notify.error('Erro de conexão com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${productToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        notify.success('Produto excluído com sucesso');
        setProductToDelete(null);
        if (viewingProduct?.id === productToDelete.id) {
          setViewingProduct(null);
        }
        onRefreshProducts();
      } else {
        const err = await safeJson(res);
        notify.error(err.error || 'Erro ao excluir produto');
      }
    } catch (err) {
      notify.error('Erro de conexão ao excluir produto');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      notify.error('Nenhum produto cadastrado para exportar');
      return;
    }

    const headers = ['SKU', 'Nome', 'Categoria', 'Tipo Cobrança', 'Preço Venda (R$)', 'Custo (R$)', 'Status', 'URL Site', 'Vendas Realizadas', 'Faturamento Total (R$)'];
    const rows = products.map(p => {
      const stats = productStatsMap[p.id] || { count: 0, totalRevenue: 0 };
      return [
        `"${p.sku || ''}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category || 'Geral'}"`,
        `"${p.billingType || 'ONE_TIME'}"`,
        (p.price || 0).toFixed(2),
        (p.costPrice || 0).toFixed(2),
        `"${p.status || 'ACTIVE'}"`,
        `"${p.siteUrl || ''}"`,
        stats.count,
        stats.totalRevenue.toFixed(2)
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalogo-produtos-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success('Catálogo exportado em CSV com sucesso');
  };

  // Seed sample products if catalog is empty
  const handleLoadSamples = async () => {
    const samples = [
      {
        name: 'Landing Page de Alta Conversão',
        price: 1800,
        costPrice: 250,
        sku: 'LP-CONV-01',
        category: 'Websites & Landing Pages',
        billingType: 'ONE_TIME',
        status: 'ACTIVE',
        description: 'Landing page ultra-rápida, responsiva com integração de formulários de leads, WhatsApp e analytics.'
      },
      {
        name: 'Site Institucional Premium',
        price: 3500,
        costPrice: 500,
        sku: 'SITE-INST-02',
        category: 'Websites & Landing Pages',
        billingType: 'ONE_TIME',
        status: 'ACTIVE',
        description: 'Website completo de 5 páginas com blog, painel de edição e otimização para SEO no Google.'
      },
      {
        name: 'Plano de Manutenção & Hospedagem VIP',
        price: 290,
        costPrice: 45,
        sku: 'MANUT-MENSAL',
        category: 'Manutenção & Hospedagem',
        billingType: 'MONTHLY',
        status: 'ACTIVE',
        description: 'Hospedagem Cloud, backups diários automáticos, certificado SSL e suporte prioritário mensal.'
      },
      {
        name: 'E-commerce Loja Virtual Integrada',
        price: 5200,
        costPrice: 800,
        sku: 'ECOM-PRO-03',
        category: 'E-commerce & Lojas Virtuais',
        billingType: 'ONE_TIME',
        status: 'ACTIVE',
        description: 'Loja virtual com gateway de pagamento PIX/Cartão, cálculo de frete e gestão de estoque.'
      }
    ];

    try {
      for (const sample of samples) {
        await fetch(`${API_URL}/api/products`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sample)
        });
      }
      notify.success('Produtos modelo importados com sucesso!');
      onRefreshProducts();
    } catch (e) {
      notify.error('Erro ao importar modelos');
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-0 transition-all duration-300 ${
        isFullscreen ? 'p-0 md:p-3' : 'p-4 md:p-8'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div 
        className={`bg-[#07050d] border border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'w-full h-full md:rounded-2xl rounded-none' 
            : 'w-full max-w-6xl h-[90vh] rounded-3xl'
        }`}
      >
        {/* TOP BAR / HEADER */}
        <header className="px-6 py-4 bg-[#0d0918]/90 border-b border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-inner">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 id="product-modal-title" className="text-lg md:text-xl font-bold text-white tracking-tight">
                  Catálogo & Gestão de Produtos
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {products.length} {products.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Cadastre, organize e lance vendas de sites, pacotes e serviços com controle financeiro integrado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen Toggle on Desktop */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer hidden md:flex items-center gap-1.5 text-xs font-medium"
              title={isFullscreen ? 'Reduzir tamanho' : 'Tela Cheia'}
              aria-label={isFullscreen ? 'Reduzir tamanho' : 'Tela Cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 rounded-xl transition-all cursor-pointer"
              aria-label="Fechar modal de produtos"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* METRICS KPI BANNER */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3.5 bg-slate-950/60 border-b border-slate-800/60 shrink-0">
          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Catálogo</span>
              <div className="text-lg font-bold text-white mt-0.5">{totalProducts}</div>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400/80 tracking-wider">Produtos Ativos</span>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{activeProducts}</div>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ticket Médio</span>
              <div className="text-lg font-bold text-indigo-300 mt-0.5">
                R$ {avgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Receita Gerada</span>
              <div className="text-lg font-bold text-purple-300 mt-0.5">
                R$ {totalProductSalesRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
        </section>

        {/* TOOLBAR CONTROLS */}
        <div className="px-6 py-3 bg-[#0a0713]/80 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Search & Filter inputs */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-md min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, SKU, categoria ou descrição..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              {CATEGORY_OPTIONS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Status: Todos</option>
              <option value="ACTIVE">Apenas Ativos</option>
              <option value="INACTIVE">Apenas Inativos</option>
            </select>

            {/* Billing Type Select */}
            <select
              value={billingFilter}
              onChange={e => setBillingFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Cobrança: Todas</option>
              <option value="ONE_TIME">Pagamento Único</option>
              <option value="MONTHLY">Mensalidade (SaaS/Recorrente)</option>
              <option value="YEARLY">Anual</option>
            </select>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer pr-1"
              >
                <option value="recent">Mais Recentes</option>
                <option value="price_desc">Maior Preço</option>
                <option value="price_asc">Menor Preço</option>
                <option value="name_asc">Nome (A-Z)</option>
                <option value="sales_desc">Mais Vendidos</option>
              </select>
            </div>
          </div>

          {/* Right: Actions & View Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização em Grade"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização em Tabela"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Exportar CSV do Catálogo"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>

            {/* Create Product Button */}
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-900/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Produto</span>
            </button>
          </div>
        </div>

        {/* MAIN BODY WORKSPACE (Split view if form or inspection is open) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* CATALOG LIST / GRID AREA */}
          <main className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-slate-800/80 rounded-2xl bg-slate-950/40 my-6">
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 mb-4">
                  <Package className="w-10 h-10" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">
                  {products.length === 0 ? 'Nenhum produto cadastrado no catálogo' : 'Nenhum produto encontrado com os filtros atuais'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mb-6">
                  {products.length === 0 
                    ? 'Cadastre seus serviços de desenvolvimento de sites, landing pages, lojas e planos de manutenção para agilizar a geração de propostas e lançamentos de vendas.'
                    : 'Tente limpar a busca ou mudar os filtros de categoria e status para visualizar seus itens.'}
                </p>
                <div className="flex items-center gap-3">
                  {products.length === 0 ? (
                    <>
                      <button
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-900/30"
                      >
                        <Plus className="w-4 h-4" />
                        Cadastrar Primeiro Produto
                      </button>
                      <button
                        onClick={handleLoadSamples}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        Carregar Modelos Prontos
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCategory('Todos');
                        setStatusFilter('ALL');
                        setBillingFilter('ALL');
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID CARDS VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                  const stats = productStatsMap[product.id] || { count: 0, totalRevenue: 0 };
                  const isInactive = (product.status || 'ACTIVE') === 'INACTIVE';
                  const billingCfg = BILLING_TYPES.find(b => b.value === (product.billingType || 'ONE_TIME')) || BILLING_TYPES[0];
                  
                  // Margin
                  const cost = product.costPrice || 0;
                  const margin = product.price > 0 && cost > 0 
                    ? (((product.price - cost) / product.price) * 100).toFixed(0)
                    : null;

                  return (
                    <div
                      key={product.id}
                      onClick={() => setViewingProduct(product)}
                      className={`group relative bg-[#0d0918]/80 hover:bg-[#120c22] border rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl hover:shadow-indigo-950/30 ${
                        viewingProduct?.id === product.id 
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                          : isInactive 
                            ? 'border-slate-800/60 opacity-70 hover:opacity-100' 
                            : 'border-slate-800/80 hover:border-indigo-500/50'
                      }`}
                    >
                      {/* Card Header: Category & Status */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700/50 truncate max-w-[170px]">
                            {product.category || 'Geral'}
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            {product.sku && (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                {product.sku}
                              </span>
                            )}
                            <button
                              onClick={(e) => handleToggleStatus(product, e)}
                              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider transition-all uppercase cursor-pointer border ${
                                isInactive 
                                  ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' 
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              }`}
                              title="Clique para alternar status"
                            >
                              {isInactive ? 'Inativo' : 'Ativo'}
                            </button>
                          </div>
                        </div>

                        {/* Product Title */}
                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 mb-1">
                          {product.name}
                        </h4>

                        {/* Description */}
                        {product.description ? (
                          <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                            {product.description}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 italic mb-3">Sem descrição informada</p>
                        )}
                      </div>

                      {/* Card Footer: Pricing, Margin & Direct Actions */}
                      <div className="pt-3 border-t border-slate-800/70 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">Preço de Venda</span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-base font-extrabold text-white">
                                R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              {billingCfg.value !== 'ONE_TIME' && (
                                <span className="text-[10px] font-medium text-slate-400">
                                  /{billingCfg.value === 'MONTHLY' ? 'mês' : 'ano'}
                                </span>
                              )}
                            </div>
                          </div>

                          {margin && (
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">Margem</span>
                              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ~{margin}%
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Stats / Linked site row */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1 text-slate-400">
                            <ShoppingCart className="w-3 h-3 text-slate-500" />
                            {stats.count} {stats.count === 1 ? 'venda' : 'vendas'} (R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})
                          </span>

                          {product.siteUrl && (
                            <a
                              href={product.siteUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-0.5 text-[10px] font-medium"
                            >
                              Ver Site <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>

                        {/* Quick action buttons */}
                        <div className="grid grid-cols-4 gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                          {/* Launch Sale button */}
                          <button
                            onClick={() => {
                              if (onSelectProductForSale) {
                                onSelectProductForSale(product);
                              }
                            }}
                            className="col-span-2 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                            title="Lançar venda direta com este produto"
                          >
                            <DollarSign className="w-3 h-3" />
                            Lançar Venda
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 font-medium text-[11px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                            title="Editar produto"
                          >
                            <Edit2 className="w-3 h-3" />
                            Editar
                          </button>

                          {/* Clone button */}
                          <button
                            onClick={() => handleDuplicateProduct(product)}
                            className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] rounded-lg transition-all flex items-center justify-center cursor-pointer"
                            title="Duplicar / Clonar"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE DENSE VIEW */
              <div className="border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#0e0a1b] text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5">SKU / Produto</th>
                      <th className="px-4 py-3.5">Categoria</th>
                      <th className="px-4 py-3.5">Cobrança</th>
                      <th className="px-4 py-3.5">Preço (R$)</th>
                      <th className="px-4 py-3.5">Custo / Margem</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Vendas</th>
                      <th className="px-4 py-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-xs">
                    {filteredProducts.map(product => {
                      const stats = productStatsMap[product.id] || { count: 0, totalRevenue: 0 };
                      const isInactive = (product.status || 'ACTIVE') === 'INACTIVE';
                      const cost = product.costPrice || 0;
                      const margin = product.price > 0 && cost > 0 
                        ? (((product.price - cost) / product.price) * 100).toFixed(0)
                        : null;
                      const billingCfg = BILLING_TYPES.find(b => b.value === (product.billingType || 'ONE_TIME')) || BILLING_TYPES[0];

                      return (
                        <tr 
                          key={product.id}
                          onClick={() => setViewingProduct(product)}
                          className="hover:bg-slate-900/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-white group-hover:text-indigo-300 transition-colors">{product.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">{product.sku || 'Sem SKU'}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                              {product.category || 'Geral'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-300 text-[11px]">
                            {billingCfg.label}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-white">
                            R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                            {cost > 0 ? (
                              <span>R$ {cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-emerald-400 font-bold">({margin}%)</span></span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={(e) => handleToggleStatus(product, e)}
                              className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase transition-all cursor-pointer border ${
                                isInactive 
                                  ? 'bg-slate-800 text-slate-400 border-slate-700' 
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              {isInactive ? 'Inativo' : 'Ativo'}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-slate-300 text-[11px]">
                            {stats.count} un. <span className="text-slate-500">(R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })})</span>
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onSelectProductForSale && onSelectProductForSale(product)}
                                className="p-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg transition-all cursor-pointer"
                                title="Lançar Venda"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingProduct(product)}
                                className="p-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 rounded-lg transition-all cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicateProduct(product)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all cursor-pointer"
                                title="Duplicar"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setProductToDelete(product)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </main>

          {/* SLIDE-OVER FORM DRAWER: CREATE / EDIT PRODUCT */}
          {isFormOpen && (
            <aside 
              className="w-full md:w-[460px] bg-[#0c0819] border-l border-slate-800 flex flex-col h-full absolute right-0 top-0 bottom-0 z-20 shadow-2xl animate-in slide-in-from-right duration-200"
              aria-label={editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    {editingProduct ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {editingProduct ? 'Atualize as informações do item' : 'Preencha os detalhes e precificação'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseForm}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Nome do Produto / Serviço *</span>
                    <span className="text-slate-500 text-[9px]">Ex: Landing Page Pro</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none transition-colors"
                    placeholder="Ex: Site Institucional Completo"
                  />
                </div>

                {/* SKU & Category Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Código / SKU
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:border-indigo-500 focus:outline-none"
                      placeholder="Ex: PRD-102"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="ACTIVE">Ativo (Visível)</option>
                      <option value="INACTIVE">Inativo (Pausado)</option>
                    </select>
                  </div>
                </div>

                {/* Category Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    {CATEGORY_OPTIONS.filter(c => c !== 'Todos').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Billing Type selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Modelo de Cobrança
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {BILLING_TYPES.map(type => (
                      <button
                        type="button"
                        key={type.value}
                        onClick={() => setFormData({ ...formData, billingType: type.value })}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          formData.billingType === type.value
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold leading-tight">{type.label.split(' ')[0]}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{type.value === 'ONE_TIME' ? 'Único' : type.value === 'MONTHLY' ? 'Recorrente' : 'Anual'}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price & Cost Box (with live margin calculator) */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                        Preço de Venda (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        className="w-full px-3 py-2 bg-[#090611] border border-slate-800 rounded-xl text-white font-bold text-sm focus:border-emerald-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Custo Estimado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.costPrice}
                        onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                        className="w-full px-3 py-2 bg-[#090611] border border-slate-800 rounded-xl text-slate-300 text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Realtime Profit preview */}
                  {parsedPrice > 0 && (
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Lucro Estimado:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400">
                          R$ {profitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {profitMarginPercent}% margem
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Descrição & Escopo do Serviço
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs resize-none focus:border-indigo-500 focus:outline-none leading-relaxed"
                    placeholder="Ex: Incluso até 5 seções, integração WhatsApp, formulário de contato, SEO on-page e 30 dias de suporte..."
                  />
                </div>

                {/* Link to Site / BuildDreamer Project */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Vincular a um Site / Projeto</span>
                    <span className="text-slate-500 text-[9px]">Opcional</span>
                  </label>
                  <div className="space-y-2">
                    <select
                      value={formData.projectId}
                      onChange={e => {
                        const pid = e.target.value;
                        const proj = projects.find(p => p.id === pid);
                        let autoUrl = formData.siteUrl;
                        if (proj) {
                          autoUrl = proj.domain ? `https://${proj.domain}` : `https://preview.meusite.com/${proj.id}`;
                        }
                        setFormData({
                          ...formData,
                          projectId: pid,
                          siteUrl: autoUrl
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs cursor-pointer focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Selecionar Projeto do Construtor --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.domain ? `(${p.domain})` : ''}</option>
                      ))}
                    </select>

                    <input
                      type="url"
                      value={formData.siteUrl}
                      onChange={e => setFormData({ ...formData, siteUrl: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                      placeholder="Ou cole a URL direta (ex: https://meusite.com.br)"
                    />
                  </div>
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>{editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}</span>
                  </button>
                </div>
              </form>
            </aside>
          )}

          {/* DETAIL INSPECTION DRAWER (When clicking on a product) */}
          {viewingProduct && !isFormOpen && (
            <aside 
              className="w-full md:w-[420px] bg-[#0b0718] border-l border-slate-800 flex flex-col h-full absolute right-0 top-0 bottom-0 z-20 shadow-2xl animate-in slide-in-from-right duration-200"
              aria-label="Detalhes do Produto"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Detalhes do Produto</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{viewingProduct.sku || 'Sem SKU'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Header Info */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300">
                      {viewingProduct.category || 'Geral'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      (viewingProduct.status || 'ACTIVE') === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {viewingProduct.status === 'INACTIVE' ? 'Inativo' : 'Ativo'}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white leading-snug">{viewingProduct.name}</h2>
                </div>

                {/* Financial Summary Card */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-400">Preço de Venda:</span>
                    <span className="text-lg font-extrabold text-white">
                      R$ {viewingProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {viewingProduct.costPrice && viewingProduct.costPrice > 0 && (
                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-800/60">
                      <span className="text-slate-400">Custo Estimado:</span>
                      <span className="text-slate-300 font-semibold">
                        R$ {viewingProduct.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {viewingProduct.costPrice && viewingProduct.costPrice > 0 && (
                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-800/60">
                      <span className="text-slate-400">Margem Bruta:</span>
                      <span className="text-emerald-400 font-bold">
                        R$ {(viewingProduct.price - viewingProduct.costPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({(((viewingProduct.price - viewingProduct.costPrice) / viewingProduct.price) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Sales Performance */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Desempenho Comercial</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-500 block">Vendas Fechadas</span>
                      <span className="text-base font-bold text-white">
                        {productStatsMap[viewingProduct.id]?.count || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-500 block">Total Faturado</span>
                      <span className="text-base font-bold text-emerald-400">
                        R$ {(productStatsMap[viewingProduct.id]?.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {viewingProduct.description && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Descrição do Item</span>
                    <p className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 text-xs leading-relaxed">
                      {viewingProduct.description}
                    </p>
                  </div>
                )}

                {/* Linked site & builder integration */}
                {(viewingProduct.siteUrl || viewingProduct.projectId) && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Website / Projeto Vinculado</span>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                      {viewingProduct.siteUrl && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 truncate max-w-[240px]">{viewingProduct.siteUrl}</span>
                          <a
                            href={viewingProduct.siteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-all"
                            title="Abrir URL"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                      {viewingProduct.projectId && onOpenProject && (
                        <button
                          onClick={() => {
                            onOpenProject(viewingProduct.projectId!);
                            onClose();
                          }}
                          className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 border border-indigo-500/30 cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Abrir no Editor Visual
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => {
                      if (onSelectProductForSale) {
                        onSelectProductForSale(viewingProduct);
                      }
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    Lançar Venda com este Produto
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setEditingProduct(viewingProduct)}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border border-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDuplicateProduct(viewingProduct)}
                      className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border border-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-purple-400" />
                      Duplicar
                    </button>
                  </div>

                  <button
                    onClick={() => setProductToDelete(viewingProduct)}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl border border-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Produto
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0b18] border border-rose-500/30 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Excluir Produto</h4>
                <p className="text-xs text-slate-400">Tem certeza que deseja remover este item?</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="font-bold text-white">{productToDelete.name}</div>
              <div className="text-slate-400">Preço: R$ {productToDelete.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              {productStatsMap[productToDelete.id]?.count ? (
                <div className="text-amber-400 font-semibold pt-1">
                  Atenção: Este produto possui {productStatsMap[productToDelete.id]?.count} venda(s) registrada(s) no histórico.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProduct}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-900/40 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
