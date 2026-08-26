import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Plus,
  Search,
  MapPin,
  Phone,
  Globe,
  Star,
  UserPlus,
  BookmarkCheck,
  Layout,
  Sparkles
} from 'lucide-react';

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

interface SavedLeadsTabProps {
  theme: 'light' | 'dark';
  savedLeads: Lead[];
  onToggleSaveLead: (lead: Lead) => void;
  onCadastrarLeadNoCRM: (lead: Lead) => void;
  onCreateProjectFromLead: (lead: Lead) => void;
  onStartRemasterFlow: (lead: Lead) => void;
  setShowManualLeadModal: (show: boolean) => void;
  setActiveTab: (tab: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings') => void;
}

export const SavedLeadsTab: React.FC<SavedLeadsTabProps> = ({
  theme,
  savedLeads,
  onToggleSaveLead,
  onCadastrarLeadNoCRM,
  onCreateProjectFromLead,
  onStartRemasterFlow,
  setShowManualLeadModal,
  setActiveTab
}) => {
  const [savedCurrentPage, setSavedCurrentPage] = useState(1);
  const [savedPerPage, setSavedPerPage] = useState(10);
  const [savedViewMode, setSavedViewMode] = useState<'table' | 'cards'>(() => {
    try {
      const stored = localStorage.getItem('rp_saved_leads_view_mode');
      if (stored === 'table' || stored === 'cards') return stored;
    } catch {}
    return 'table';
  });

  useEffect(() => {
    try {
      localStorage.setItem('rp_saved_leads_view_mode', savedViewMode);
    } catch {}
  }, [savedViewMode]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-yellow-400" />
            Leads Salvos ({savedLeads.length})
          </h2>
          <p className="text-xs text-slate-400">Potenciais clientes favoritados para abordagem e propostas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualLeadModal(true)}
            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Lead
          </button>
          <button
            onClick={() => setActiveTab('leads')}
            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-650 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            Buscar Leads
          </button>
        </div>
      </div>

      {savedLeads.length === 0 ? (
        <div className="p-16 bg-[#0f0b18] border border-slate-850 rounded-2xl text-center space-y-3">
          <Bookmark className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum lead salvo no momento</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Navegue até o <strong>Buscador de Clientes</strong>, faça buscas e clique no ícone de salvar em qualquer estabelecimento para adicioná-lo aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f0b18] border border-slate-850 px-4 py-3 rounded-2xl text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <span>Exibindo <strong>{Math.min((savedCurrentPage - 1) * savedPerPage + 1, savedLeads.length)}</strong>–<strong>{Math.min(savedCurrentPage * savedPerPage, savedLeads.length)}</strong> de <strong>{savedLeads.length}</strong> leads favoritados</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Items per page */}
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Por página:</span>
                <select
                  value={savedPerPage}
                  onChange={(e) => {
                    setSavedPerPage(Number(e.target.value));
                    setSavedCurrentPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setSavedViewMode('table')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${savedViewMode === 'table' ? 'bg-purple-700 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setSavedViewMode('cards')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${savedViewMode === 'cards' ? 'bg-purple-700 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Cards
                </button>
              </div>
            </div>
          </div>

          {/* Render Table */}
          {savedViewMode === 'table' ? (
            <div className="bg-[#0f0b18] border border-yellow-500/20 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-4">Estabelecimento / Categoria</th>
                      <th className="py-3.5 px-4">Endereço</th>
                      <th className="py-3.5 px-4">Contato & Presença</th>
                      <th className="py-3.5 px-4 text-center">Nota</th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap shrink-0">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 text-xs">
                    {savedLeads
                      .slice((savedCurrentPage - 1) * savedPerPage, savedCurrentPage * savedPerPage)
                      .map(lead => {
                        const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || lead.city || ''}`)}`;

                        return (
                          <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white text-sm flex items-center gap-2">
                                <span className="truncate max-w-[220px]" title={lead.name}>{lead.name}</span>
                                <BookmarkCheck className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                              </div>
                              {lead.category && (
                                <span className="text-[10px] text-yellow-400 font-mono mt-0.5 block">{lead.category}</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-slate-300 max-w-[260px]">
                              <div className="flex items-start gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                                <span className="line-clamp-2 text-xs text-slate-300" title={lead.address}>
                                  {lead.address || `${lead.city || ''} - ${lead.state || ''}`}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                                  <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                                  <span>{lead.phone}</span>
                                </div>
                                <div>
                                  {lead.website ? (
                                    <a
                                      href={lead.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 truncate max-w-[180px]"
                                      title={lead.website}
                                    >
                                      <Globe className="w-3 h-3 shrink-0" />
                                      <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                                    </a>
                                  ) : (
                                    <span className="text-[10px] font-bold text-red-400 bg-red-950/40 border border-red-500/20 px-1.5 py-0.5 rounded">
                                      Sem Website
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-lg text-xs font-bold">
                                <Star className="w-3 h-3 fill-yellow-400" />
                                {lead.rating}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap shrink-0">
                              <div className="flex items-center justify-end gap-1 flex-nowrap shrink-0 whitespace-nowrap">
                                <button
                                  onClick={() => onCadastrarLeadNoCRM(lead)}
                                  className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 rounded-lg transition-all cursor-pointer"
                                  title="Cadastrar no CRM (Novo Lead)"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>

                                <a
                                  href={mapsSearchUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/40 text-pink-400 rounded-lg transition-all"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                </a>

                                {lead.whatsappUrl && (
                                  <a
                                    href={lead.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 rounded-lg transition-all"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                <button
                                  onClick={() => onToggleSaveLead(lead)}
                                  className="p-1.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:text-red-400 rounded-lg transition-all cursor-pointer"
                                >
                                  <BookmarkCheck className="w-3.5 h-3.5 fill-yellow-400" />
                                </button>

                                <button
                                  onClick={() => onCreateProjectFromLead(lead)}
                                  className="p-1.5 bg-indigo-600/30 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-200 hover:text-white rounded-lg transition-all shadow-sm cursor-pointer"
                                >
                                  <Layout className="w-3.5 h-3.5" />
                                </button>

                                {lead.website && (
                                  <button
                                    onClick={() => onStartRemasterFlow(lead)}
                                    className="p-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-all shadow-md cursor-pointer"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
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
            </div>
          ) : (
            /* Render Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedLeads
                .slice((savedCurrentPage - 1) * savedPerPage, savedCurrentPage * savedPerPage)
                .map(lead => (
                  <div key={lead.id} className="bg-[#0f0b18] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between hover:border-yellow-500/40 transition-all shadow-md">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight">{lead.name}</h3>
                          {lead.category && (
                            <span className="text-[10px] text-yellow-400 font-mono">{lead.category}</span>
                          )}
                        </div>
                        <button
                          onClick={() => onToggleSaveLead(lead)}
                          className="p-1 text-yellow-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <BookmarkCheck className="w-5 h-5 fill-yellow-400" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span className="line-clamp-1">{lead.address}</span>
                      </p>

                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{lead.phone}</span>
                      </p>

                      <p className="text-xs flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        {lead.website ? (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline line-clamp-1">
                            {lead.website}
                          </a>
                        ) : (
                          <span className="text-red-400 font-semibold uppercase tracking-wider text-[10px] bg-red-950/30 border border-red-500/25 px-1.5 py-0.5 rounded">Sem Website</span>
                        )}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-850/80 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-mono">Salvo na Lista</span>
                      <div className="flex items-center gap-1.5 flex-nowrap shrink-0 whitespace-nowrap">
                        <button
                          onClick={() => onCadastrarLeadNoCRM(lead)}
                          className="p-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 rounded-xl transition-all shadow-sm cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || lead.city || ''}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-900 hover:bg-pink-950/40 border border-slate-800 hover:border-pink-500/40 text-pink-400 rounded-xl transition-all shadow-sm"
                        >
                          <MapPin className="w-4 h-4" />
                        </a>
                        {lead.whatsappUrl && (
                          <a
                            href={lead.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-400 rounded-xl transition-all shadow-sm"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => onCreateProjectFromLead(lead)}
                          className="p-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-xl transition-all shadow-sm cursor-pointer"
                        >
                          <Layout className="w-4 h-4" />
                        </button>
                        {lead.website && (
                          <button
                            onClick={() => onStartRemasterFlow(lead)}
                            className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition-all shadow-md cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Pagination */}
          {Math.ceil(savedLeads.length / savedPerPage) > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setSavedCurrentPage(p => Math.max(p - 1, 1))}
                disabled={savedCurrentPage === 1}
                className="px-3.5 py-2 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Anterior
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(savedLeads.length / savedPerPage) }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setSavedCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${savedCurrentPage === page
                      ? 'bg-purple-700 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                      : 'bg-[#0f0b18] border border-slate-850 text-slate-400 hover:text-white'
                      }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setSavedCurrentPage(p => Math.min(p + 1, Math.ceil(savedLeads.length / savedPerPage)))}
                disabled={savedCurrentPage === Math.ceil(savedLeads.length / savedPerPage)}
                className="px-3.5 py-2 bg-[#0f0b18] border border-slate-800 hover:border-purple-500/40 text-xs font-semibold text-slate-300 hover:text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
