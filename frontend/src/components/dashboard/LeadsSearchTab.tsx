import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Globe,
  Phone,
  Star,
  Users,
  SlidersHorizontal,
  Bookmark,
  BookmarkCheck,
  Play,
  Zap,
  Sparkles,
  Loader2,
  Trash2,
  Edit2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List
} from 'lucide-react';
import { API_URL } from '../../config';
import { useNotification } from '../../context/NotificationContext';

interface Lead {
  id: string;
  name: string;
  category?: string;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  phone: string;
  whatsappUrl?: string | null;
  email?: string | null;
  website: string | null;
  hasWebsite?: boolean;
  source?: string;
  rating: string;
  totalReviews?: number;
  openingHours?: string;
  needsWebsite?: boolean;
}

interface FilterPreset {
  id: string;
  name: string;
  niche: string;
  city: string;
  state: string;
  country: string;
  onlyWithoutWebsite: boolean;
  onlyWithWebsite?: boolean;
  hasPhoneOnly: boolean;
  hasWhatsappOnly?: boolean;
  minRating: number;
}

interface LeadsSearchTabProps {
  token: string;
  theme: 'light' | 'dark';
  savedLeads: Lead[];
  onToggleSaveLead: (lead: Lead) => void;
  onStartRemasterFlow: (lead: Lead) => void;
}

export const LeadsSearchTab: React.FC<LeadsSearchTabProps> = ({
  token,
  theme,
  savedLeads,
  onToggleSaveLead,
  onStartRemasterFlow
}) => {
  const notify = useNotification();

  // Search filter states
  const [leadQuery, setLeadQuery] = useState('');
  const [leadCity, setLeadCity] = useState('');
  const [leadState, setLeadState] = useState('');
  const [leadCountry, setLeadCountry] = useState('Brasil');
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(false);
  const [onlyWithWebsite, setOnlyWithWebsite] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [hasWhatsappOnly, setHasWhatsappOnly] = useState(false);
  const [minRating, setMinRating] = useState('0');
  const [minReviews, setMinReviews] = useState('0');
  const [sortBy, setSortBy] = useState<'rating' | 'reviews' | 'name'>('rating');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Results states
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  
  // Pagination & view modes
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    try {
      const stored = localStorage.getItem('rp_leads_view_mode');
      if (stored === 'table' || stored === 'cards') return stored;
    } catch {}
    return 'table';
  });

  // Presets states
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [showPresetListModal, setShowPresetListModal] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetForm, setPresetForm] = useState({
    name: '',
    niche: '',
    city: '',
    state: '',
    country: 'Brasil',
    onlyWithoutWebsite: false,
    onlyWithWebsite: false,
    hasPhoneOnly: false,
    hasWhatsappOnly: false,
    minRating: 0
  });

  useEffect(() => {
    try {
      localStorage.setItem('rp_leads_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  // Load presets
  const fetchPresets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leads/presets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFilterPresets(data.presets || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchPresets();
  }, [token]);

  // Search leads handler
  const handleSearchLeads = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!leadQuery || !leadCity) {
      notify.error('Nicho e Cidade são campos obrigatórios para a busca.', 'Busca');
      return;
    }

    setLoadingLeads(true);
    setLeadsList([]);
    setCurrentPage(1);

    try {
      const queryParams = new URLSearchParams({
        niche: leadQuery,
        city: leadCity,
        state: leadState,
        country: leadCountry,
        onlyWithoutWebsite: onlyWithoutWebsite.toString(),
        onlyWithWebsite: onlyWithWebsite.toString(),
        hasPhone: hasPhoneOnly.toString(),
        hasWhatsapp: hasWhatsappOnly.toString(),
        minRating: minRating,
        minReviews: minReviews,
        sortBy: sortBy
      });

      const res = await fetch(`${API_URL}/api/leads/search?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro na prospecção');
      }

      const data = await res.json();
      setLeadsList(data.leads || []);
      notify.success(`Encontramos ${data.leads?.length || 0} potenciais clientes em ${leadCity}!`, 'Sucesso');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Falha ao buscar clientes.', 'Erro');
    } finally {
      setLoadingLeads(false);
    }
  };

  // Presets Handlers
  const handleApplyPreset = (preset: FilterPreset) => {
    setLeadQuery(preset.niche);
    setLeadCity(preset.city);
    setLeadState(preset.state || '');
    setLeadCountry(preset.country || 'Brasil');
    setOnlyWithoutWebsite(!!preset.onlyWithoutWebsite);
    setOnlyWithWebsite(!!preset.onlyWithWebsite);
    setHasPhoneOnly(!!preset.hasPhoneOnly);
    setHasWhatsappOnly(!!preset.hasWhatsappOnly);
    setMinRating(preset.minRating ? preset.minRating.toString() : '0');
    setShowPresetListModal(false);
    notify.success(`Filtro "${preset.name}" aplicado! Clique em buscar.`, 'Filtro');
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetForm.name || !presetForm.niche || !presetForm.city) return;

    try {
      const method = editingPresetId ? 'PUT' : 'POST';
      const endpoint = editingPresetId 
        ? `${API_URL}/api/leads/presets/${editingPresetId}` 
        : `${API_URL}/api/leads/presets`;

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(presetForm)
      });

      if (res.ok) {
        fetchPresets();
        setPresetModalOpen(false);
        setEditingPresetId(null);
        notify.success(editingPresetId ? 'Filtro atualizado com sucesso!' : 'Filtro salvo com sucesso!', 'Presets');
      } else {
        const data = await res.json();
        notify.error(data.error || 'Erro ao salvar preset.', 'Erro');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm('Deseja realmente excluir este filtro salvo?')) return;
    try {
      const res = await fetch(`${API_URL}/api/leads/presets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setFilterPresets(prev => prev.filter(p => p.id !== id));
        notify.success('Filtro excluído com sucesso.', 'Excluído');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Pagination helper
  const indexOfLastLead = currentPage * leadsPerPage;
  const indexOfFirstLead = indexOfLastLead - leadsPerPage;
  const currentLeads = leadsList.slice(indexOfFirstLead, indexOfLastLead);
  const totalPages = Math.ceil(leadsList.length / leadsPerPage);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-pink-400" />
            Buscador de Clientes & Leads
          </h2>
          <p className="text-xs text-slate-400">Encontre empresas locais sem site para oferecer seus serviços.</p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowPresetListModal(true)}
            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros Prontos ({filterPresets.length})
          </button>
        </div>
      </div>

      {/* Advanced Search Form */}
      <form onSubmit={handleSearchLeads} className="bg-[#0f0b18] border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input
              type="text"
              required
              placeholder="Nicho: Padaria, Dentista, Supermercado..."
              value={leadQuery}
              onChange={(e) => setLeadQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
            />
          </div>
          <div className="md:col-span-3 relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input
              type="text"
              required
              placeholder="Cidade (ex: Formosa, Brasília)"
              value={leadCity}
              onChange={(e) => setLeadCity(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
            />
          </div>
          <div className="md:col-span-2 relative">
            <input
              type="text"
              placeholder="Estado (ex: GO, DF)"
              value={leadState}
              onChange={(e) => setLeadState(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm text-white placeholder-slate-600"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={loadingLeads}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {loadingLeads ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Prospectando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Prospectar Clientes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Advanced Filter Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-850/60">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithoutWebsite}
                onChange={(e) => {
                  setOnlyWithoutWebsite(e.target.checked);
                  if (e.target.checked) setOnlyWithWebsite(false);
                }}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              Apenas <strong>SEM Site</strong>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithWebsite}
                onChange={(e) => {
                  setOnlyWithWebsite(e.target.checked);
                  if (e.target.checked) setOnlyWithoutWebsite(false);
                }}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              Apenas <strong>COM Site</strong>
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={hasPhoneOnly}
                onChange={(e) => setHasPhoneOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              Apenas <strong>COM Telefone</strong>
            </label>

            <label className="flex items-center gap-2 text-xs text-emerald-300 cursor-pointer">
              <input
                type="checkbox"
                checked={hasWhatsappOnly}
                onChange={(e) => setHasWhatsappOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              Apenas <strong>COM WhatsApp</strong>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
          >
            Filtros Avançados
            {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-950/40 rounded-xl border border-slate-850 animate-slide-down">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Nota Mínima Avaliações</label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="0">Qualquer Nota</option>
                <option value="3">★ 3.0 ou mais</option>
                <option value="4">★ 4.0 ou mais</option>
                <option value="4.5">★ 4.5 ou mais</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Mínimo de Avaliações</label>
              <select
                value={minReviews}
                onChange={(e) => setMinReviews(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="0">Qualquer quantidade</option>
                <option value="5">Mais de 5 avaliações</option>
                <option value="15">Mais de 15 avaliações</option>
                <option value="50">Mais de 50 avaliações</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Ordenar Por</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="rating">Nota (Maior primeiro)</option>
                <option value="reviews">Qtd. Avaliações (Maior primeiro)</option>
                <option value="name">Ordem Alfabética</option>
              </select>
            </div>

            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setPresetForm({
                    name: '',
                    niche: leadQuery,
                    city: leadCity,
                    state: leadState,
                    country: leadCountry,
                    onlyWithoutWebsite,
                    onlyWithWebsite,
                    hasPhoneOnly,
                    hasWhatsappOnly,
                    minRating: Number(minRating) || 0
                  });
                  setPresetModalOpen(true);
                }}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                Salvar como Filtro
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Leads Table/Cards results list */}
      {leadsList.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Mostrando {indexOfFirstLead + 1}-{Math.min(indexOfLastLead, leadsList.length)} de {leadsList.length} leads
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg border transition-all ${viewMode === 'table' ? 'bg-slate-900 border-slate-800 text-white' : 'text-slate-500 hover:text-white border-transparent'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg border transition-all ${viewMode === 'cards' ? 'bg-slate-900 border-slate-800 text-white' : 'text-slate-500 hover:text-white border-transparent'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {viewMode === 'table' ? (
            <div className="bg-[#0f0b18] border border-slate-850 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-850/60 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3">Empresa</th>
                    <th className="px-5 py-3">Contato</th>
                    <th className="px-5 py-3">Avaliação</th>
                    <th className="px-5 py-3 text-center">Status Site</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/30">
                  {currentLeads.map(lead => {
                    const isSaved = savedLeads.some(sl => sl.phone === lead.phone || (lead.website && sl.website === lead.website));
                    return (
                      <tr key={lead.id} className="hover:bg-slate-900/35 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white text-sm">{lead.name}</div>
                          <div className="text-slate-400 text-[11px] mt-0.5">{lead.category}</div>
                          <div className="text-slate-500 text-[10px] mt-0.5 max-w-xs truncate">{lead.address}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-slate-300 font-mono">{lead.phone || 'Sem Telefone'}</div>
                          {lead.phone && lead.phone !== 'Sem Telefone' && lead.phone !== 'Não informado' && (
                            <a
                              href={lead.whatsappUrl || `https://wa.me/55${lead.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-green-400 hover:underline mt-0.5 block font-semibold"
                            >
                              WhatsApp Direto
                            </a>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 font-bold text-yellow-400">
                            ★ {lead.rating || '0.0'}
                            <span className="text-slate-500 font-normal">({lead.totalReviews || 0})</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {lead.hasWebsite || lead.website ? (
                            <div className="flex flex-col items-center gap-1">
                              <a
                                href={lead.website?.startsWith('http') ? lead.website : `https://${lead.website}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 rounded-full font-semibold text-[10px] flex items-center gap-1 transition-all"
                                title="Abrir site original em nova aba"
                              >
                                <Globe className="w-3 h-3 text-cyan-400" />
                                <span className="max-w-[120px] truncate">{lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, '') : 'Ver Site'}</span>
                              </a>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-950/50 text-red-400 border border-red-500/20 rounded-full font-semibold text-[10px]">
                              Sem Site
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onToggleSaveLead(lead)}
                              className={`p-1.5 rounded-lg border transition-colors ${isSaved ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                              title={isSaved ? 'Remover dos favoritos' : 'Favoritar Lead'}
                            >
                              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                            </button>

                            {lead.hasWebsite || lead.website ? (
                              <button
                                onClick={() => onStartRemasterFlow(lead)}
                                className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-purple-600/30"
                                title="Melhorar e Remasterizar o site atual desta empresa com IA"
                              >
                                <Sparkles className="w-3 h-3 text-yellow-300 fill-current" />
                                Melhorar Site
                              </button>
                            ) : (
                              <button
                                onClick={() => onStartRemasterFlow(lead)}
                                className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                title="Construir proposta de novo site para esta empresa"
                              >
                                <Zap className="w-3 h-3 fill-current" />
                                Criar Site
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentLeads.map(lead => {
                const isSaved = savedLeads.some(sl => sl.phone === lead.phone || (lead.website && sl.website === lead.website));
                return (
                  <div key={lead.id} className="bg-[#0f0b18] border border-slate-850 hover:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-white text-sm line-clamp-1">{lead.name}</h3>
                          <span className="text-[10px] text-slate-400">{lead.category}</span>
                        </div>
                        {lead.hasWebsite || lead.website ? (
                          <a
                            href={lead.website?.startsWith('http') ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 text-[9px] rounded-full shrink-0 font-bold bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 transition-all"
                            title="Abrir site original"
                          >
                            <Globe className="w-2.5 h-2.5 text-cyan-400" />
                            Site
                          </a>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] rounded-full shrink-0 font-bold bg-red-950/40 text-red-400 border border-red-500/20">
                            Sem Site
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-400 mt-3.5">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{lead.address}</span>
                        </p>
                        <p className="flex items-center justify-between gap-1.5">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-mono">{lead.phone || 'Sem Telefone'}</span>
                          </span>
                          {lead.phone && lead.phone !== 'Sem Telefone' && lead.phone !== 'Não informado' && (
                            <a
                              href={lead.whatsappUrl || `https://wa.me/55${lead.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-green-400 hover:underline font-semibold"
                            >
                              WhatsApp
                            </a>
                          )}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-yellow-500" />
                          <span>Nota: <strong>{lead.rating || '0.0'}</strong> ({lead.totalReviews || 0} reviews)</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-slate-850/60 flex items-center justify-between">
                      <button
                        onClick={() => onToggleSaveLead(lead)}
                        className={`p-1.5 rounded-lg border transition-colors ${isSaved ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                      >
                        {isSaved ? <BookmarkCheck className="w-4.5 h-4.5" /> : <Bookmark className="w-4.5 h-4.5" />}
                      </button>

                      {lead.hasWebsite || lead.website ? (
                        <button
                          onClick={() => onStartRemasterFlow(lead)}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/30"
                          title="Melhorar e Remasterizar o site atual com IA"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-yellow-300 fill-current" />
                          Melhorar Site
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartRemasterFlow(lead)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          Criar Site
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination buttons */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 disabled:opacity-40 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl transition-all"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 disabled:opacity-40 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl transition-all"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preset List / Manager Modal */}
      {showPresetListModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-[#0f0b18] border border-cyan-500/30 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-880">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="text-cyan-400 w-5 h-5" />
                  Filtros Pré-Prontos Salvos
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Selecione um modelo de busca para prospectar com 1 clique.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingPresetId(null);
                    setPresetForm({
                      name: '',
                      niche: leadQuery,
                      city: leadCity,
                      state: leadState,
                      country: leadCountry,
                      onlyWithoutWebsite,
                      onlyWithWebsite,
                      hasPhoneOnly,
                      hasWhatsappOnly,
                      minRating: 0
                    });
                    setPresetModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Filtro
                </button>
                <button onClick={() => setShowPresetListModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto py-4 space-y-3 pr-1 flex-1">
              {filterPresets.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                  <SlidersHorizontal className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Nenhum filtro salvo ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterPresets.map(preset => (
                    <div key={preset.id} className="bg-slate-950/70 border border-slate-850 hover:border-cyan-500/40 rounded-xl p-4 flex flex-col justify-between transition-all">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-bold text-white text-sm line-clamp-1">{preset.name}</h3>
                          <span className="px-2 py-0.5 bg-cyan-950/50 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-mono shrink-0">
                            {preset.niche}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-400 mt-2">
                          <p className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-pink-400 shrink-0" />
                            <span className="truncate">{preset.city}{preset.state ? ` - ${preset.state}` : ''} ({preset.country || 'Brasil'})</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>Sem site: <strong>{preset.onlyWithoutWebsite ? 'Sim' : 'Não'}</strong></span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>Telefone: <strong>{preset.hasPhoneOnly ? 'Sim' : 'Qualquer'}</strong></span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingPresetId(preset.id);
                              setPresetForm({
                                name: preset.name,
                                niche: preset.niche,
                                city: preset.city,
                                state: preset.state || '',
                                country: preset.country || 'Brasil',
                                onlyWithoutWebsite: !!preset.onlyWithoutWebsite,
                                onlyWithWebsite: !!preset.onlyWithWebsite,
                                hasPhoneOnly: !!preset.hasPhoneOnly,
                                hasWhatsappOnly: !!preset.hasWhatsappOnly,
                                minRating: preset.minRating || 0
                              });
                              setPresetModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="p-1.5 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleApplyPreset(preset)}
                          className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600 border border-cyan-500/40 text-cyan-200 hover:text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Buscar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preset Form Modal */}
      {presetModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f0b18] border border-cyan-500/30 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingPresetId ? 'Editar Filtro Salvo' : 'Salvar Novo Filtro de Busca'}
            </h3>
            <form onSubmit={handleSavePreset} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Nome do Filtro</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Padarias em Brasília sem Site"
                  value={presetForm.name}
                  onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Nicho / Palavra-chave</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pizzaria, Dentista"
                    value={presetForm.niche}
                    onChange={(e) => setPresetForm({ ...presetForm, niche: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Cidade</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Formosa, Brasília"
                    value={presetForm.city}
                    onChange={(e) => setPresetForm({ ...presetForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    placeholder="Ex: GO, DF, SP"
                    value={presetForm.state}
                    onChange={(e) => setPresetForm({ ...presetForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">País</label>
                  <input
                    type="text"
                    placeholder="Brasil"
                    value={presetForm.country}
                    onChange={(e) => setPresetForm({ ...presetForm, country: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              {/* Filtros em Checkbox no Modal */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <label className="block text-[11px] font-bold text-slate-400">Condições do Filtro</label>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={presetForm.onlyWithoutWebsite}
                      onChange={(e) => {
                        setPresetForm({
                          ...presetForm,
                          onlyWithoutWebsite: e.target.checked,
                          onlyWithWebsite: e.target.checked ? false : presetForm.onlyWithWebsite
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    Apenas <strong>SEM Site</strong>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={presetForm.onlyWithWebsite}
                      onChange={(e) => {
                        setPresetForm({
                          ...presetForm,
                          onlyWithWebsite: e.target.checked,
                          onlyWithoutWebsite: e.target.checked ? false : presetForm.onlyWithoutWebsite
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    Apenas <strong>COM Site</strong>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={presetForm.hasPhoneOnly}
                      onChange={(e) => setPresetForm({ ...presetForm, hasPhoneOnly: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    Apenas <strong>COM Telefone</strong>
                  </label>

                  <label className="flex items-center gap-2 text-emerald-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={presetForm.hasWhatsappOnly}
                      onChange={(e) => setPresetForm({ ...presetForm, hasWhatsappOnly: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    Apenas <strong>COM WhatsApp</strong>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Nota Mínima</label>
                <select
                  value={presetForm.minRating}
                  onChange={(e) => setPresetForm({ ...presetForm, minRating: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value={0}>Qualquer Nota</option>
                  <option value={3}>★ 3.0 ou mais</option>
                  <option value={4}>★ 4.0 ou mais</option>
                  <option value={4.5}>★ 4.5 ou mais</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPresetModalOpen(false)}
                  className="px-4 py-2 border border-slate-800 text-xs font-bold text-slate-400 rounded-xl hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-cyan-600/30"
                >
                  Salvar Filtro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
