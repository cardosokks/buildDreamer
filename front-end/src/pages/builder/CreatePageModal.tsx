import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Copy, 
  FileText, 
  Globe, 
  Check, 
  AlertCircle, 
  Loader2, 
  Layout, 
  ShoppingBag, 
  User, 
  Wrench, 
  Phone, 
  DollarSign, 
  Grid, 
  Home, 
  Search, 
  ChevronDown, 
  ChevronUp,
  Layers
} from 'lucide-react';

export interface PageItem {
  id: string;
  name: string;
  slug: string;
  html?: string;
  css?: string;
  js?: string;
  isHomepage?: boolean;
}

export interface PageCreationData {
  name: string;
  slug: string;
  templateType: string;
  duplicatePageId?: string;
  aiPrompt?: string;
  isHomepage?: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

interface CreatePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPages: PageItem[];
  onCreatePage: (data: PageCreationData) => Promise<void>;
}

const TEMPLATE_OPTIONS = [
  {
    id: 'blank',
    title: 'Página em Branco',
    desc: 'Estrutura limpa e neutra pronta para você desenhar do seu jeito.',
    icon: FileText,
    badge: 'Início Limpo',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
  },
  {
    id: 'landing',
    title: 'Landing Page de Vendas',
    desc: 'Hero banner de alta conversão, lista de benefícios, prova social e CTA.',
    icon: Layout,
    badge: 'Alta Conversão',
    badgeColor: 'bg-purple-950/60 text-purple-300 border-purple-500/30'
  },
  {
    id: 'about',
    title: 'Sobre Nós / Institucional',
    desc: 'História da empresa, valores, estatísticas de impacto e apresentação da equipe.',
    icon: User,
    badge: 'Institucional',
    badgeColor: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
  },
  {
    id: 'services',
    title: 'Serviços & Soluções',
    desc: 'Catálogo de serviços com cartões detalhados, diferenciais e orçamentos.',
    icon: Wrench,
    badge: 'Comercial',
    badgeColor: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
  },
  {
    id: 'contact',
    title: 'Contato & Localização',
    desc: 'Formulário moderno, horários de atendimento, mapa e dados de contato.',
    icon: Phone,
    badge: 'Atendimento',
    badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
  },
  {
    id: 'pricing',
    title: 'Preços & Planos',
    desc: 'Tabela comparativa de preços com destaque de mais popular e FAQ.',
    icon: DollarSign,
    badge: 'Tabela de Preços',
    badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-500/30'
  },
  {
    id: 'portfolio',
    title: 'Galeria / Portfólio',
    desc: 'Grid responsivo de projetos realizados, casos de sucesso e avaliações.',
    icon: Grid,
    badge: 'Portfólio',
    badgeColor: 'bg-pink-950/60 text-pink-300 border-pink-500/30'
  },
  {
    id: 'ai',
    title: 'Gerar com Inteligência Artificial',
    desc: 'Descreva a página que você imagina e a IA constrói o layout completo.',
    icon: Sparkles,
    badge: 'IA Autônoma',
    badgeColor: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold border-transparent'
  },
  {
    id: 'duplicate',
    title: 'Duplicar Página Existente',
    desc: 'Copie exatamente o código e o design de uma página já criada no projeto.',
    icon: Copy,
    badge: 'Clone',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
  }
];

export const CreatePageModal: React.FC<CreatePageModalProps> = ({
  isOpen,
  onClose,
  existingPages,
  onCreatePage
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [templateType, setTemplateType] = useState('blank');
  const [duplicatePageId, setDuplicatePageId] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isHomepage, setIsHomepage] = useState(false);
  
  // SEO Expandable Section
  const [showSeoOptions, setShowSeoOptions] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setSlug('');
      setIsSlugCustomized(false);
      setTemplateType('blank');
      setDuplicatePageId(existingPages.length > 0 ? existingPages[0].id : '');
      setAiPrompt('');
      setIsHomepage(existingPages.length === 0);
      setShowSeoOptions(false);
      setSeoTitle('');
      setSeoDescription('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen, existingPages]);

  // Handle Name Input Change & Auto-slug Generation
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugCustomized) {
      const generatedSlug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generatedSlug);
    }
  };

  // Check for duplicate slugs
  const isSlugDuplicate = existingPages.some(
    p => p.slug.toLowerCase() === slug.trim().toLowerCase()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanSlug = slug.trim().toLowerCase() || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!cleanName) {
      setError('O nome da página é obrigatório.');
      return;
    }

    if (isSlugDuplicate) {
      setError(`O slug "/${cleanSlug}" já está em uso por outra página deste projeto.`);
      return;
    }

    if (templateType === 'duplicate' && !duplicatePageId) {
      setError('Selecione uma página existente para duplicar.');
      return;
    }

    if (templateType === 'ai' && !aiPrompt.trim()) {
      setError('Descreva como você deseja a sua página para a IA.');
      return;
    }

    setLoading(true);

    try {
      await onCreatePage({
        name: cleanName,
        slug: cleanSlug,
        templateType,
        duplicatePageId: templateType === 'duplicate' ? duplicatePageId : undefined,
        aiPrompt: templateType === 'ai' ? aiPrompt.trim() : undefined,
        isHomepage,
        seoTitle: seoTitle.trim() || cleanName,
        seoDescription: seoDescription.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao criar a página. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0b0813] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200 text-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-slate-850 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Criar Nova Página</h2>
              <p className="text-xs text-slate-400">Personalize o nome, modelo e configurações de publicação</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-300 text-xs shadow-md">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}

          {/* Nome e Slug da Página */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nome da Página <span className="text-pink-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Nossos Serviços, Sobre Nós, Preços"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>URL / Slug Amigável</span>
                {isSlugCustomized && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSlugCustomized(false);
                      handleNameChange(name);
                    }}
                    className="text-[10px] text-purple-400 hover:underline"
                  >
                    Resetar Automático
                  </button>
                )}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs text-slate-500 font-mono">/</span>
                <input
                  type="text"
                  required
                  placeholder="nossos-servicos"
                  value={slug}
                  onChange={e => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    setIsSlugCustomized(true);
                  }}
                  className={`w-full pl-7 pr-4 py-3 bg-slate-950 border rounded-xl text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-1 transition-all ${
                    isSlugDuplicate
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-slate-800 focus:border-purple-500 focus:ring-purple-500'
                  }`}
                />
              </div>
              {isSlugDuplicate && (
                <p className="text-[11px] text-red-400 mt-1">Este slug já pertence a outra página.</p>
              )}
            </div>
          </div>

          {/* Marcar como Página Inicial */}
          <div className="flex items-center gap-3 p-3.5 bg-slate-950/60 border border-slate-850 rounded-2xl">
            <input
              type="checkbox"
              id="isHomepageCheck"
              checked={isHomepage}
              onChange={e => setIsHomepage(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="isHomepageCheck" className="text-xs font-medium text-slate-200 cursor-pointer flex items-center gap-2">
              <Home className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Definir como Página Inicial (Página principal `index / /`)</span>
            </label>
          </div>

          {/* Escolha do Modelo / Template */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-300">
              Escolha o Tipo ou Modelo de Criação <span className="text-pink-400">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TEMPLATE_OPTIONS.map((tmpl) => {
                const IconComp = tmpl.icon;
                const isSelected = templateType === tmpl.id;

                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setTemplateType(tmpl.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 relative group ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
                        : 'bg-slate-950/80 border-slate-850 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`p-2 rounded-xl border ${isSelected ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border font-mono ${tmpl.badgeColor}`}>
                        {tmpl.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                        {tmpl.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                        {tmpl.desc}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-purple-500 text-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Opção Condicional: Duplicar Página Existente */}
          {templateType === 'duplicate' && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 animate-in fade-in duration-150">
              <label className="block text-xs font-bold text-slate-200">
                Selecione a página de origem para clonar:
              </label>
              {existingPages.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma página existente no projeto para clonar.</p>
              ) : (
                <select
                  value={duplicatePageId}
                  onChange={e => setDuplicatePageId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-750 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {existingPages.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug}) {p.isHomepage ? '★ Inicial' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Opção Condicional: Prompt de Inteligência Artificial */}
          {templateType === 'ai' && (
            <div className="p-4 bg-gradient-to-br from-purple-950/30 to-pink-950/20 border border-purple-500/30 rounded-2xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-bold">
                <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
                <span>Instruções para a IA construir esta página:</span>
              </div>
              <textarea
                rows={3}
                required
                placeholder="Ex: Crie uma página moderna de serviços de advocacia empresarial, com tabela de preços, lista de advogados especialistas e botão WhatsApp de consulta..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/90 border border-purple-500/30 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              />
            </div>
          )}

          {/* Configurações Avançadas de SEO (Accordion) */}
          <div className="border border-slate-850 rounded-2xl overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setShowSeoOptions(!showSeoOptions)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>Otimização SEO e Meta Tags (Opcional)</span>
              </div>
              {showSeoOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showSeoOptions && (
              <div className="p-4 border-t border-slate-850 space-y-3.5 bg-slate-950/80">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Título da Página (&lt;title&gt;)
                  </label>
                  <input
                    type="text"
                    placeholder={name ? `${name} | Nome do Seu Negócio` : 'Título otimizado para o Google'}
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Descrição Meta (&lt;meta name="description"&gt;)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Breve resumo da página para aparecer nas buscas do Google (até 160 caracteres)"
                    value={seoDescription}
                    onChange={e => setSeoDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rodapé / Ações */}
          <div className="pt-3 border-t border-slate-850 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading || isSlugDuplicate}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl text-xs shadow-xl shadow-purple-600/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{templateType === 'ai' ? 'Gerando Página com IA...' : 'Criando Página...'}</span>
                </>
              ) : (
                <>
                  {templateType === 'ai' ? <Sparkles className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  <span>{templateType === 'ai' ? 'Gerar Página com IA' : 'Criar Nova Página'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
