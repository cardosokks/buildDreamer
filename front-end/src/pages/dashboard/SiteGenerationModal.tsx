import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Layers,
  Palette,
  Layout,
  Plus,
  Trash2,
  Wand2,
  CheckCircle2,
  Search,
  UserCheck,
  Building2,
  Phone,
  MapPin,
  Clock,
  Star,
  Globe,
  Sliders,
  Terminal,
  Zap,
  Check,
  RotateCcw,
  Boxes,
  HelpCircle
} from 'lucide-react';
import {
  SITE_TYPE_PRESETS,
  VISUAL_STYLE_PRESETS,
  DIGITAL_DESIGN_SOLUTIONS,
  SitePageDefinition,
  buildStructuredSitePrompt
} from '../../utils/promptEngine';

export interface LeadItem {
  id?: string;
  name: string;
  category?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  rating?: string | number;
  totalReviews?: number;
}

interface SiteGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (projectConfig: {
    name: string;
    description: string;
    isAIPrompt: boolean;
    pagesToGenerate: SitePageDefinition[];
    siteStyle: string;
    segment: string;
    colorPalette: string;
    businessName: string;
    targetLead?: LeadItem | null;
    digitalFeatures: string[];
    heroLayout: string;
    sectionTransitions: string;
  }) => Promise<void>;
  savedLeads?: LeadItem[];
  initialLead?: LeadItem | null;
  onAutoPlanWithAI?: (businessName: string, segment: string, extraInstructions: string) => Promise<any>;
  isPlanningWithAI?: boolean;
}

export const SiteGenerationModal: React.FC<SiteGenerationModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  savedLeads = [],
  initialLead = null,
  onAutoPlanWithAI,
  isPlanningWithAI = false
}) => {
  // Wizard Active Tab: 'business' | 'pages' | 'design' | 'prompt'
  const [activeStep, setActiveStep] = useState<'business' | 'pages' | 'design' | 'prompt'>('business');

  // Step 1: Business & Lead Data
  const [targetLead, setTargetLead] = useState<LeadItem | null>(initialLead);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [businessName, setBusinessName] = useState(initialLead?.name || '');
  const [segment, setSegment] = useState(initialLead?.category || '');
  const [phone, setPhone] = useState(initialLead?.phone || '');
  const [address, setAddress] = useState(initialLead?.address || '');
  const [openingHours, setOpeningHours] = useState('Segunda a Sábado: 08:00 às 20:00');
  const [rating, setRating] = useState(String(initialLead?.rating || '5.0'));
  const [reviewsCount, setReviewsCount] = useState<number>(initialLead?.totalReviews || 128);
  const [websiteUrl, setWebsiteUrl] = useState(initialLead?.website || '');
  const [extraInstructions, setExtraInstructions] = useState('');

  // Step 2: Multi-page Architecture & Site Preset
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('institutional');
  const [pagesList, setPagesList] = useState<SitePageDefinition[]>(
    SITE_TYPE_PRESETS.institutional.defaultPages
  );
  const [newPageName, setNewPageName] = useState('');
  const [newPagePurpose, setNewPagePurpose] = useState('');

  // Step 3: Visual Design & Solutions
  const [selectedStyleId, setSelectedStyleId] = useState<string>('dark_cyber_luxury');
  const [customStyleText, setCustomStyleText] = useState('');
  const [heroLayout, setHeroLayout] = useState<'auto' | 'bento' | 'splitscreen_3d' | 'parallax' | 'saas_mockup' | 'editorial'>('auto');
  const [sectionTransitions, setSectionTransitions] = useState<'waves' | 'slants' | 'curves' | 'overlapping_cards' | 'gradient_glows' | 'auto'>('auto');
  const [activeFeatures, setActiveFeatures] = useState<string[]>([
    'swiper_3d',
    'realtime_status',
    'floating_whatsapp',
    'pricing_toggle',
    'animated_counters',
    'faq_search',
    'lead_confetti',
    'interactive_map'
  ]);

  // Step 4: Prompt Review
  const [compiledPrompt, setCompiledPrompt] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync initial lead when it changes or modal opens
  useEffect(() => {
    if (initialLead) {
      setTargetLead(initialLead);
      setBusinessName(initialLead.name || '');
      setSegment(initialLead.category || '');
      if (initialLead.phone) setPhone(initialLead.phone);
      if (initialLead.address) setAddress(initialLead.address);
      if (initialLead.rating) setRating(String(initialLead.rating));
      if (initialLead.totalReviews) setReviewsCount(initialLead.totalReviews);
      if (initialLead.website) setWebsiteUrl(initialLead.website);
    }
  }, [initialLead, isOpen]);

  // Apply Site Type Preset
  const handleApplyPreset = (presetKey: string) => {
    setSelectedPresetKey(presetKey);
    const preset = SITE_TYPE_PRESETS[presetKey];
    if (preset) {
      setPagesList(preset.defaultPages);
      if (preset.recommendedHero) setHeroLayout(preset.recommendedHero);
      if (preset.recommendedTransitions) setSectionTransitions(preset.recommendedTransitions);
      if (preset.features) setActiveFeatures(preset.features);
    }
  };

  // Add custom page to architecture
  const handleAddPage = () => {
    const name = newPageName.trim();
    if (!name) return;
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (pagesList.some(p => p.slug === slug)) {
      return;
    }
    setPagesList(prev => [
      ...prev,
      {
        name,
        slug,
        isHomepage: false,
        purpose: newPagePurpose.trim() || `Subpágina exclusiva de ${name}`
      }
    ]);
    setNewPageName('');
    setNewPagePurpose('');
    setSelectedPresetKey('custom');
  };

  // Remove page from architecture
  const handleRemovePage = (slugToRemove: string) => {
    if (slugToRemove === 'index') return;
    setPagesList(prev => prev.filter(p => p.slug !== slugToRemove));
    setSelectedPresetKey('custom');
  };

  // Toggle digital feature
  const handleToggleFeature = (featureId: string) => {
    setActiveFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  // Recompile Structured Prompt whenever relevant data updates
  const recompilePrompt = () => {
    const selectedStyleObj = VISUAL_STYLE_PRESETS.find(s => s.id === selectedStyleId);
    const finalStyleStr = customStyleText.trim() || selectedStyleObj?.name || 'Ultra Moderno & Fluído';
    const finalPaletteStr = selectedStyleObj?.tagline || 'Cores vibrantes com alto contraste e iluminação sutil';

    const compiled = buildStructuredSitePrompt({
      businessName: businessName.trim() || 'Empresa Modelo',
      segment: segment.trim() || 'Comércio e Serviços',
      visualStyle: finalStyleStr,
      colorPalette: finalPaletteStr,
      heroLayout,
      sectionTransitions,
      pagesList,
      digitalFeatures: activeFeatures,
      extraInstructions: extraInstructions.trim(),
      leadInfo: {
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        openingHours: openingHours.trim() || undefined,
        rating: rating || undefined,
        reviewsCount: reviewsCount || undefined,
        website: websiteUrl.trim() || undefined
      }
    });

    setCompiledPrompt(compiled);
    return compiled;
  };

  // Trigger Autonomous AI Planning
  const handleTriggerAIPlanning = async () => {
    if (!businessName.trim() || !segment.trim()) {
      return;
    }
    if (onAutoPlanWithAI) {
      try {
        const plan = await onAutoPlanWithAI(businessName.trim(), segment.trim(), extraInstructions.trim());
        if (plan) {
          if (Array.isArray(plan.suggestedPages) && plan.suggestedPages.length > 0) {
            setPagesList(plan.suggestedPages.map((p: any) => ({
              name: p.name,
              slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              isHomepage: !!p.isHomepage,
              purpose: p.purpose || ''
            })));
          }
          if (plan.colorPalette?.mood) {
            setCustomStyleText(plan.colorPalette.mood);
          }
          recompilePrompt();
        }
      } catch (err) {
        console.error('Erro no planejamento autônomo:', err);
      }
    }
  };

  // Submit Final Site Generation
  const handleFinalSubmit = async () => {
    if (!businessName.trim()) return;
    setIsSubmitting(true);
    try {
      const finalPrompt = compiledPrompt || recompilePrompt();
      const selectedStyleObj = VISUAL_STYLE_PRESETS.find(s => s.id === selectedStyleId);

      await onGenerate({
        name: businessName.trim(),
        description: finalPrompt,
        isAIPrompt: true,
        pagesToGenerate: pagesList,
        siteStyle: customStyleText.trim() || selectedStyleObj?.name || 'Moderno',
        segment: segment.trim() || 'Geral',
        colorPalette: selectedStyleObj?.tagline || 'Elegante',
        businessName: businessName.trim(),
        targetLead: targetLead,
        digitalFeatures: activeFeatures,
        heroLayout,
        sectionTransitions
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-5xl bg-[#0d0a14] border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header com Navegação de Etapas (Wizard) */}
        <div className="p-4 sm:p-5 border-b border-purple-500/20 bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 text-purple-400 rounded-xl border border-purple-500/40 shadow-inner">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Gerador de Sites Multi-Páginas com IA
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-bold text-white rounded-full uppercase tracking-wider shadow-sm">
                  Design Studio 2.0
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-purple-300/80 mt-0.5">
                Crie sites completos com arquitetura de páginas, recursos de alta conversão e estética contemporânea.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'business', label: '1. Cliente & Negócio', icon: Building2 },
            { id: 'pages', label: '2. Arquitetura Multi-Páginas', icon: Layers },
            { id: 'design', label: '3. Estilo & Recursos Digitais', icon: Palette },
            { id: 'prompt', label: '4. Prompt Studio & Gerar', icon: Terminal }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeStep === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'prompt') recompilePrompt();
                  setActiveStep(tab.id as any);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-purple-950/80 border-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* ========================================================================= */}
          {/* ETAPA 1: CLIENTE & DADOS DO NEGÓCIO */}
          {/* ========================================================================= */}
          {activeStep === 'business' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Vinculação de Lead / CRM */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Vincular Cliente / Lead Salvo do Google Maps (Opcional)
                    </span>
                  </div>
                  {targetLead && (
                    <button
                      type="button"
                      onClick={() => setTargetLead(null)}
                      className="text-xs text-rose-400 hover:underline font-medium cursor-pointer"
                    >
                      Desvincular Cliente
                    </button>
                  )}
                </div>

                {targetLead ? (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{targetLead.name}</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                            {targetLead.category || 'Lead'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {targetLead.address ? `${targetLead.address} • ` : ''}
                          {targetLead.phone || 'Sem telefone'} • Nota {targetLead.rating || '5.0'} ⭐
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar cliente nos leads salvos por nome, telefone ou categoria..."
                        value={leadSearchQuery}
                        onChange={(e) => setLeadSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-500"
                      />
                    </div>

                    {savedLeads.length > 0 && (
                      <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-850">
                        {savedLeads
                          .filter(l =>
                            l.name.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
                            (l.category && l.category.toLowerCase().includes(leadSearchQuery.toLowerCase())) ||
                            (l.phone && l.phone.includes(leadSearchQuery))
                          )
                          .slice(0, 5)
                          .map(lead => (
                            <div
                              key={lead.id || lead.name}
                              onClick={() => {
                                setTargetLead(lead);
                                setBusinessName(lead.name);
                                setSegment(lead.category || 'Comércio Local');
                                if (lead.phone) setPhone(lead.phone);
                                if (lead.address) setAddress(lead.address);
                                if (lead.rating) setRating(String(lead.rating));
                                if (lead.totalReviews) setReviewsCount(lead.totalReviews);
                                if (lead.website) setWebsiteUrl(lead.website);
                              }}
                              className="p-2 hover:bg-slate-900 rounded-lg cursor-pointer transition-all flex items-center justify-between"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-semibold text-white truncate">🏢 {lead.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {lead.category || 'Comércio'} • {lead.phone || lead.address || 'Sem contato'}
                                </div>
                              </div>
                              <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-1 rounded-md border border-purple-500/30 shrink-0">
                                Preencher Dados ➔
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Informações Principais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Nome da Empresa / Projeto *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bella Napoli Ristorante, Studio Innova..."
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-purple-400" />
                    <span>Nicho / Ramo de Atuação *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Restaurante Italiano, Advocacia Tributária, Clínica de Estética..."
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>

              {/* Contatos & Detalhes Operacionais */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp / Telefone</span>
                  </label>
                  <input
                    type="text"
                    placeholder="(61) 99999-8888"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-pink-400" />
                    <span>Endereço Completo</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Av. Principal, 1200 - Centro"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Horário de Funcionamento</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Seg a Sáb: 08h às 20h"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Nota Google Maps</span>
                  </label>
                  <input
                    type="text"
                    placeholder="5.0"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Qtd. de Avaliações Reais</span>
                  </label>
                  <input
                    type="number"
                    placeholder="128"
                    value={reviewsCount}
                    onChange={(e) => setReviewsCount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    <span>Website Atual (Se houver)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="https://exemplo.com.br"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>

              {/* Botão de Planejamento Autônomo com IA */}
              <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 rounded-xl flex items-center justify-between flex-wrap gap-2.5">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-400 animate-pulse" />
                  <div>
                    <div className="text-xs font-bold text-white">
                      Planejador Autônomo da IA (3 Passos)
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Analisa o segmento de mercado e sugere paleta de cores e arquitetura de páginas ideais.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerAIPlanning}
                  disabled={isPlanningWithAI || !businessName.trim() || !segment.trim()}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {isPlanningWithAI ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analisando Nicho...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Executar Planejamento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: ARQUITETURA MULTI-PÁGINAS */}
          {/* ========================================================================= */}
          {activeStep === 'pages' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Seletor de Presets de Nicho */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Escolha o Tipo de Site / Nicho para Carregar a Estrutura Recomendada:</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.entries(SITE_TYPE_PRESETS).map(([key, preset]) => {
                    const isSelected = selectedPresetKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleApplyPreset(key)}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-950/70 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/50'
                            : 'bg-slate-950 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-white flex items-center justify-between">
                          <span>{preset.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                          {preset.defaultPages.length} páginas: {preset.defaultPages.map(p => p.name).join(', ')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de Páginas do Site */}
              <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Páginas Configuradas no Projeto ({pagesList.length} páginas interligadas)
                    </span>
                  </div>
                  <span className="text-[11px] text-purple-300 font-medium">
                    Todas as páginas compartilharão o mesmo Header, Footer e Paleta Visual
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {pagesList.map((page, idx) => (
                    <div
                      key={page.slug}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-2 transition-all ${
                        page.isHomepage
                          ? 'bg-purple-950/40 border-purple-500/50 shadow-sm'
                          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="text-[10px] font-mono text-purple-400 font-bold mt-0.5">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">{page.name}</span>
                            {page.isHomepage && (
                              <span className="text-[9px] bg-purple-500/30 text-purple-200 px-1.5 py-0.2 rounded font-semibold">
                                Principal (Home)
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            /{page.slug}.html
                          </div>
                          {page.purpose && (
                            <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                              {page.purpose}
                            </div>
                          )}
                        </div>
                      </div>

                      {!page.isHomepage && (
                        <button
                          type="button"
                          onClick={() => handleRemovePage(page.slug)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer"
                          title="Remover página"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Adicionar Nova Página */}
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="Nome da página (ex: Galeria, Blog, Equipe)..."
                      value={newPageName}
                      onChange={(e) => setNewPageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPage();
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-500"
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Objetivo da página (ex: Apresentar fotos dos trabalhos anteriores com filtros)..."
                      value={newPagePurpose}
                      onChange={(e) => setNewPagePurpose(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPage();
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddPage}
                      disabled={!newPageName.trim()}
                      className="w-full py-2 bg-slate-800 hover:bg-purple-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: SISTEMA VISUAL & RECURSOS DIGITAIS */}
          {/* ========================================================================= */}
          {activeStep === 'design' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Estilos Visuais */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-purple-400" />
                  <span>Estilo Visual & Atmosfera da Marca:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {VISUAL_STYLE_PRESETS.map((style) => {
                    const isSelected = selectedStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setSelectedStyleId(style.id)}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-950/70 border-purple-500 text-white shadow-md ring-1 ring-purple-500/50'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white">{style.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2">{style.tagline}</p>
                        </div>

                        {/* Color swatches */}
                        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/60">
                          {style.previewColors.map((color, cIdx) => (
                            <div
                              key={cIdx}
                              className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2.5">
                  <input
                    type="text"
                    placeholder="Ou descreva um estilo visual customizado (ex: Dark minimalista com detalhes em cobre e tipografia suíça)..."
                    value={customStyleText}
                    onChange={(e) => setCustomStyleText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>

              {/* Layout do Hero Section */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layout className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Layout do Hero Section Principal:</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'auto', label: 'IA Auto Mix', desc: 'Baseado no Nicho' },
                    { id: 'bento', label: 'Bento Grid 2.0', desc: 'Métricas & SaaS' },
                    { id: 'splitscreen_3d', label: 'Splitscreen 3D', desc: 'Spline & Conversão' },
                    { id: 'parallax', label: 'Parallax Header', desc: 'Mídia & Imersivo' },
                    { id: 'editorial', label: 'High-End Editorial', desc: 'Elegância & Luxo' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setHeroLayout(item.id as any)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        heroLayout === item.id
                          ? 'bg-purple-950/70 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{item.label}</div>
                      <div className="text-[10px] opacity-70 truncate">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transições de Seção */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-pink-400" />
                  <span>Transições Fluídas de Seção (Anti-Layout Reto):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'auto', label: 'IA Auto Mix', desc: 'Mix Orgânico' },
                    { id: 'overlapping_cards', label: '🃏 Sobrepostos', desc: 'Cards Flutuantes' },
                    { id: 'waves', label: '🌊 Ondas SVG', desc: 'Curvas Suaves' },
                    { id: 'slants', label: '📐 Cortes Slants', desc: 'Ângulos Modernos' },
                    { id: 'gradient_glows', label: '🌟 Néon Glow', desc: 'Linhas de Luz' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSectionTransitions(item.id as any)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        sectionTransitions === item.id
                          ? 'bg-purple-950/70 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{item.label}</div>
                      <div className="text-[10px] opacity-70 truncate">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recursos Digitais e Soluções Interativas */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Recursos Digitais & Módulos Interativos Disponíveis no Mercado:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DIGITAL_DESIGN_SOLUTIONS.map((feat) => {
                    const isEnabled = activeFeatures.includes(feat.id);
                    return (
                      <div
                        key={feat.id}
                        onClick={() => handleToggleFeature(feat.id)}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                          isEnabled
                            ? 'bg-purple-950/40 border-purple-500/60 text-white'
                            : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                            isEnabled
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isEnabled && <Check className="w-3 h-3" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{feat.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                            {feat.description}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instruções Extras Opcionais */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Instruções Específicas Adicionais (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Incluir seção de depoimentos de alunos com fotos, botão de WhatsApp em verde esmeralda com balão de boas-vindas..."
                  value={extraInstructions}
                  onChange={(e) => setExtraInstructions(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl focus:outline-none text-xs text-white resize-none placeholder-slate-600"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: PROMPT STUDIO & GERAR */}
          {/* ========================================================================= */}
          {activeStep === 'prompt' && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Metadata Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Empresa</span>
                  <div className="text-xs font-bold text-white mt-0.5 truncate">{businessName || 'Não informado'}</div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Arquitetura</span>
                  <div className="text-xs font-bold text-purple-300 mt-0.5 truncate">
                    {pagesList.length} página(s): {pagesList.map(p => p.name).join(', ')}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Recursos Digitais</span>
                  <div className="text-xs font-bold text-emerald-300 mt-0.5 truncate">
                    {activeFeatures.length} soluções ativas
                  </div>
                </div>
              </div>

              {/* Textarea do Prompt Estruturado */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    <span>Prompt Master Estruturado (Editável)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => recompilePrompt()}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Regenerar Prompt com Parâmetros Atuais
                  </button>
                </div>
                <textarea
                  value={compiledPrompt}
                  onChange={(e) => setCompiledPrompt(e.target.value)}
                  rows={14}
                  className="w-full px-4 py-3.5 bg-slate-950 border border-purple-500/50 focus:border-purple-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-xs font-mono text-purple-100 leading-relaxed resize-y shadow-inner"
                  placeholder="Gerando prompt estruturado..."
                />
              </div>

              <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl flex items-start gap-2.5 text-[11px] text-purple-200">
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  O motor de inteligência artificial receberá esta instrução estruturada e construirá o código HTML/Tailwind, JavaScript funcional e o design completo de todas as páginas em background.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-purple-500/20 bg-slate-950 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (activeStep === 'pages') setActiveStep('business');
              else if (activeStep === 'design') setActiveStep('pages');
              else if (activeStep === 'prompt') setActiveStep('design');
              else onClose();
            }}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            {activeStep === 'business' ? 'Cancelar' : 'Voltar Etapa'}
          </button>

          <div className="flex items-center gap-2">
            {activeStep !== 'prompt' ? (
              <button
                type="button"
                onClick={() => {
                  if (activeStep === 'business') {
                    if (!businessName.trim() || !segment.trim()) {
                      alert('Por favor, informe ao menos o Nome da Empresa e o Segmento.');
                      return;
                    }
                    setActiveStep('pages');
                  } else if (activeStep === 'pages') {
                    setActiveStep('design');
                  } else if (activeStep === 'design') {
                    recompilePrompt();
                    setActiveStep('prompt');
                  }
                }}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Avançar Etapa</span>
                <span>➔</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !businessName.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xl shadow-purple-600/40 transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Iniciando Geração Multi-Páginas...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Confirmar e Gerar Site Completo com IA</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
