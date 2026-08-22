import React, { useState, useEffect } from 'react';
import {
  Settings,
  ChevronDown,
  ChevronRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Move,
  Maximize2,
  Box,
  Layers,
  Type,
  Palette,
  Square,
  Sparkles,
  Code,
  Globe,
  Search,
  Share2,
  Tag,
  Trash2,
  Copy,
  Edit3
} from 'lucide-react';

const rgbToHex = (color: string): string => {
  if (!color || color === 'transparent' || color.startsWith('#')) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color;
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n).toString(16).padStart(2, '0'))
    .join('');
};

const cleanComputedValue = (val: string, prop: string): string => {
  if (!val) return '';
  const zerosProps = [
    'margin-top','margin-bottom','margin-left','margin-right',
    'padding-top','padding-bottom','padding-left','padding-right',
    'top','right','bottom','left','letter-spacing','gap'
  ];
  if (zerosProps.includes(prop) && (val === '0px' || val === '0' || val === 'normal' || val === 'auto')) return '';
  if (prop === 'opacity' && val === '1') return '';
  if (prop === 'z-index' && val === 'auto') return '';
  if (prop === 'border-width' && val === '0px') return '';
  if (prop === 'transform' && val === 'none') return '';
  if (prop === 'transition' && val === 'all 0s ease 0s') return '';
  if (prop === 'box-shadow' && val === 'none') return '';
  return val;
};

interface PropertiesPanelProps {
  selectedSelector: string | null;
  selectedPath?: string | null;
  selectedStyles: Record<string, string>;
  selectedAttrs: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  onAttrChange: (attr: string, value: string) => void;
  onDeleteElement?: (path: string) => void;
  onDuplicateElement?: (path: string) => void;
  pageSeo?: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  onPageSeoChange?: (key: 'title' | 'description' | 'ogImage', value: string) => void;
}

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, icon, children, defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-900/80">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-900/40 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 space-y-3">{children}</div>}
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block text-[10px] text-slate-400 mb-1 font-medium">{children}</span>
);

const inputCls = "w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors";
const selectCls = "w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500";

const UnitInput: React.FC<{
  label: string;
  prop: string;
  value: string;
  onChange: (p: string, v: string) => void;
  placeholder?: string;
}> = ({ label, prop, value, onChange, placeholder }) => {
  const units = ['px', '%', 'rem', 'em', 'vw', 'vh', 'auto'];
  const strVal = String(value || '').trim();
  const isAuto = strVal === 'auto';
  const match = strVal.match(/^([\d.-]+)(.*)$/);
  const num = isAuto ? '' : (match ? match[1] : strVal);
  const unit = isAuto ? 'auto' : (match ? (match[2] || 'px') : 'px');

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1">
        <input
          type="text"
          className={`${inputCls} flex-1`}
          placeholder={placeholder || '—'}
          disabled={isAuto}
          value={num}
          onChange={e => {
            const v = e.target.value;
            if (v === '') {
              onChange(prop, '');
            } else {
              onChange(prop, `${v}${unit === 'auto' ? 'px' : unit}`);
            }
          }}
        />
        <select
          className="bg-slate-900 border border-slate-800 rounded-lg px-1 py-1.5 text-[10px] text-slate-400 cursor-pointer focus:outline-none"
          value={unit}
          onChange={e => {
            const selectedUnit = e.target.value;
            if (selectedUnit === 'auto') {
              onChange(prop, 'auto');
            } else {
              onChange(prop, `${num || '0'}${selectedUnit}`);
            }
          }}
        >
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    </div>
  );
};

const ColorInput: React.FC<{
  label: string;
  prop: string;
  value: string;
  onChange: (p: string, v: string) => void;
}> = ({ label, prop, value, onChange }) => {
  const hex = rgbToHex(value);
  const isHex = hex.startsWith('#') && (hex.length === 7 || hex.length === 4);

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1.5 items-center">
        <input
          type="color"
          className="w-7 h-7 rounded cursor-pointer border border-slate-800 bg-transparent p-0 shrink-0"
          value={isHex ? hex : '#000000'}
          onChange={e => onChange(prop, e.target.value)}
        />
        <input
          type="text"
          className={`${inputCls} flex-1`}
          placeholder="transparent / #hex / rgba()"
          value={value}
          onChange={e => onChange(prop, e.target.value)}
        />
      </div>
    </div>
  );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedSelector,
  selectedPath,
  selectedStyles,
  selectedAttrs,
  onStyleChange,
  onAttrChange,
  onDeleteElement,
  onDuplicateElement,
  pageSeo,
  onPageSeoChange,
}) => {
  const [panelTab, setPanelTab] = useState<'styles' | 'attrs' | 'seo'>('styles');
  const [newClassInput, setNewClassInput] = useState('');

  // SEO Local States with Debounce to prevent lag/freezing
  const [localSeoTitle, setLocalSeoTitle] = useState(pageSeo?.title || '');
  const [localSeoDesc, setLocalSeoDesc] = useState(pageSeo?.description || '');
  const [localSeoOgImage, setLocalSeoOgImage] = useState(pageSeo?.ogImage || '');

  useEffect(() => {
    setLocalSeoTitle(pageSeo?.title || '');
    setLocalSeoDesc(pageSeo?.description || '');
    setLocalSeoOgImage(pageSeo?.ogImage || '');
  }, [pageSeo?.title, pageSeo?.description, pageSeo?.ogImage]);

  // Debounced save for SEO
  useEffect(() => {
    const handler = setTimeout(() => {
      if (onPageSeoChange && localSeoTitle !== (pageSeo?.title || '')) {
        onPageSeoChange('title', localSeoTitle);
      }
    }, 600);
    return () => clearTimeout(handler);
  }, [localSeoTitle]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onPageSeoChange && localSeoDesc !== (pageSeo?.description || '')) {
        onPageSeoChange('description', localSeoDesc);
      }
    }, 600);
    return () => clearTimeout(handler);
  }, [localSeoDesc]);

  const get = (prop: string) => cleanComputedValue(selectedStyles[prop] || '', prop);
  const S = (p: string, v: string) => onStyleChange(p, v);

  const display = get('display') || 'block';
  const isFlex = display === 'flex';

  const classList = (selectedAttrs['class'] || '').split(' ').filter(Boolean);

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassInput.trim()) return;
    const updated = [...classList, newClassInput.trim()].join(' ');
    onAttrChange('class', updated);
    setNewClassInput('');
  };

  const handleRemoveClass = (clsToRemove: string) => {
    const updated = classList.filter(c => c !== clsToRemove).join(' ');
    onAttrChange('class', updated);
  };

  const tag = selectedAttrs['_tag'] || 'div';
  const isImage = tag === 'img';
  const isLink = tag === 'a';
  const isInput = ['input', 'textarea', 'select'].includes(tag);

  return (
    <aside className="w-72 border-l border-slate-900 bg-[#090410] flex flex-col h-full shrink-0 select-none shadow-2xl">
      {/* Panel Top Tabs */}
      <div className="flex border-b border-slate-900 bg-slate-950/60 p-1 gap-1">
        <button
          onClick={() => setPanelTab('styles')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            panelTab === 'styles'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Palette className="w-3 h-3" />
          Estilos
        </button>
        <button
          onClick={() => setPanelTab('attrs')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            panelTab === 'attrs'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Code className="w-3 h-3" />
          Atributos
        </button>
        <button
          onClick={() => setPanelTab('seo')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            panelTab === 'seo'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Globe className="w-3 h-3" />
          SEO
        </button>
      </div>

      {panelTab === 'seo' ? (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1.5 mb-2">
              <Search className="w-3 h-3" />
              Otimização Para Buscas (Google)
            </span>
            <Label>Título da Página (SEO Title)</Label>
            <input
              type="text"
              placeholder="Ex: Minha Empresa | Soluções em Tecnologia"
              value={localSeoTitle}
              onChange={(e) => setLocalSeoTitle(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <Label>Descrição da Página (Meta Description)</Label>
            <textarea
              rows={3}
              placeholder="Breve resumo do seu site para atrair cliques nos resultados de busca do Google."
              value={localSeoDesc}
              onChange={(e) => setLocalSeoDesc(e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-pink-400 tracking-wider flex items-center gap-1.5 mb-2">
              <Share2 className="w-3 h-3" />
              Compartilhamento WhatsApp / Redes (OG)
            </span>
            <Label>URL da Imagem de Prévia (og:image)</Label>
            <input
              type="text"
              placeholder="https://exemplo.com/banner-social.jpg"
              value={localSeoOgImage}
              onChange={(e) => {
                setLocalSeoOgImage(e.target.value);
                if (onPageSeoChange) onPageSeoChange('ogImage', e.target.value);
              }}
              className={inputCls}
            />
          </div>

          {/* Live SERP Google Card Preview */}
          <div className="mt-4 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Prévia no Google Search</span>
            <div className="text-[11px] text-blue-400 font-medium truncate">
              {localSeoTitle || 'Título da Sua Página'}
            </div>
            <div className="text-[10px] text-emerald-400 truncate">
              https://seusite.com.br
            </div>
            <div className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
              {localSeoDesc || 'Adicione uma descrição para visualizar a prévia nos buscadores.'}
            </div>
          </div>
        </div>
      ) : !selectedSelector ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Settings className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-pulse" />
          <p className="text-xs text-slate-500 italic">Selecione um elemento no canvas<br />ou na árvore DOM para editar</p>
        </div>
      ) : panelTab === 'attrs' ? (
        /* PAINEL DE ATRIBUTOS HTML & CONTEÚDO */
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
          <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white font-mono">{tag}</span>
            </div>
            {selectedPath && onDeleteElement && (
              <button
                onClick={() => onDeleteElement(selectedPath)}
                className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                title="Excluir Elemento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Edição de Texto / Conteúdo do Elemento */}
          <div>
            <Label>Texto / Conteúdo Interno</Label>
            <textarea
              rows={3}
              placeholder="Digite o texto deste elemento..."
              value={selectedAttrs['_textContent'] || ''}
              onChange={e => onAttrChange('_textContent', e.target.value)}
              className={`${inputCls} resize-none`}
            />
            <span className="text-[9px] text-slate-500 block mt-1">Dica: Você também pode dar 2 cliques rápidos direto no canvas para editar o texto inline.</span>
          </div>

          <div>
            <Label>ID do Elemento</Label>
            <input
              type="text"
              placeholder="Ex: header-principal"
              value={selectedAttrs['id'] || ''}
              onChange={e => onAttrChange('id', e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>

          {isLink && (
            <div>
              <Label>Link de Destino (href)</Label>
              <input
                type="text"
                placeholder="https://exemplo.com ou #secao"
                value={selectedAttrs['href'] || ''}
                onChange={e => onAttrChange('href', e.target.value)}
                className={inputCls}
              />
              <div className="mt-2">
                <Label>Alvo (Target)</Label>
                <select
                  value={selectedAttrs['target'] || '_self'}
                  onChange={e => onAttrChange('target', e.target.value)}
                  className={selectCls}
                >
                  <option value="_self">Mesma Aba (_self)</option>
                  <option value="_blank">Nova Aba (_blank)</option>
                </select>
              </div>
            </div>
          )}

          {isImage && (
            <div className="space-y-2">
              <div>
                <Label>URL da Imagem (src)</Label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/foto.jpg"
                  value={selectedAttrs['src'] || ''}
                  onChange={e => onAttrChange('src', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Texto Alternativo (alt)</Label>
                <input
                  type="text"
                  placeholder="Descrição da imagem para acessibilidade"
                  value={selectedAttrs['alt'] || ''}
                  onChange={e => onAttrChange('alt', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {isInput && (
            <div className="space-y-2">
              <div>
                <Label>Placeholder</Label>
                <input
                  type="text"
                  placeholder="Digite seu nome..."
                  value={selectedAttrs['placeholder'] || ''}
                  onChange={e => onAttrChange('placeholder', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PAINEL DE ESTILOS & INSPECTOR */
        <div className="flex-1 overflow-y-auto">
          <div className="px-3.5 py-2.5 border-b border-slate-900 flex items-center justify-between gap-2 shrink-0 bg-slate-950/60">
            <div className="flex items-center gap-2 min-w-0">
              <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-[11px] font-bold text-white font-mono truncate">
                {selectedAttrs['_tag'] || 'div'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {selectedPath && onDuplicateElement && (
                <button
                  onClick={() => onDuplicateElement(selectedPath)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                  title="Duplicar Elemento"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              {selectedPath && onDeleteElement && (
                <button
                  onClick={() => onDeleteElement(selectedPath)}
                  className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                  title="Excluir Elemento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* CLASSES TAILWIND TAGS */}
          <Section title="Classes Tailwind & CSS" icon={<Code className="w-3 h-3 text-cyan-400" />} defaultOpen={true}>
            <form onSubmit={handleAddClass} className="flex gap-1">
              <input
                type="text"
                placeholder="+ class (ex: p-4 rounded-xl)"
                value={newClassInput}
                onChange={e => setNewClassInput(e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <button type="submit" className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg cursor-pointer">
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-1 mt-2">
              {classList.map(cls => (
                <span
                  key={cls}
                  className="inline-flex items-center gap-1 bg-purple-950/40 border border-purple-500/30 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded"
                >
                  {cls}
                  <button
                    type="button"
                    onClick={() => handleRemoveClass(cls)}
                    className="hover:text-red-400 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </Section>

          {/* LAYOUT & DISPLAY */}
          <Section title="Layout & Display" icon={<Layers className="w-3 h-3 text-pink-400" />} defaultOpen={true}>
            <div>
              <Label>Display</Label>
              <select className={selectCls} value={display} onChange={e => S('display', e.target.value)}>
                <option value="block">Block</option>
                <option value="flex">Flex</option>
                <option value="grid">Grid</option>
                <option value="inline-block">Inline-Block</option>
                <option value="none">None (Oculto)</option>
              </select>
            </div>

            {isFlex && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <Label>Flex Direction</Label>
                  <select className={selectCls} value={get('flex-direction')} onChange={e => S('flex-direction', e.target.value)}>
                    <option value="row">Row (Horizontal)</option>
                    <option value="column">Column (Vertical)</option>
                    <option value="row-reverse">Row Reverse</option>
                    <option value="column-reverse">Column Reverse</option>
                  </select>
                </div>
                <div>
                  <Label>Justify Content</Label>
                  <select className={selectCls} value={get('justify-content')} onChange={e => S('justify-content', e.target.value)}>
                    <option value="flex-start">Start</option>
                    <option value="center">Center</option>
                    <option value="flex-end">End</option>
                    <option value="space-between">Space Between</option>
                    <option value="space-around">Space Around</option>
                  </select>
                </div>
                <div>
                  <Label>Align Items</Label>
                  <select className={selectCls} value={get('align-items')} onChange={e => S('align-items', e.target.value)}>
                    <option value="stretch">Stretch</option>
                    <option value="flex-start">Flex Start</option>
                    <option value="center">Center</option>
                    <option value="flex-end">End</option>
                  </select>
                </div>
                <UnitInput label="Gap" prop="gap" value={get('gap')} onChange={S} placeholder="16px" />
              </div>
            )}
          </Section>

          {/* TIPOGRAFIA */}
          <Section title="Tipografia" icon={<Type className="w-3 h-3 text-yellow-400" />} defaultOpen={true}>
            <div className="grid grid-cols-2 gap-2">
              <UnitInput label="Tamanho da Fonte" prop="font-size" value={get('font-size')} onChange={S} placeholder="16px" />
              <div>
                <Label>Peso (Weight)</Label>
                <select className={selectCls} value={get('font-weight')} onChange={e => S('font-weight', e.target.value)}>
                  <option value="300">Light (300)</option>
                  <option value="400">Regular (400)</option>
                  <option value="500">Medium (500)</option>
                  <option value="600">Semibold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="800">Extrabold (800)</option>
                </select>
              </div>
            </div>
            <ColorInput label="Cor do Texto" prop="color" value={get('color')} onChange={S} />
            <div>
              <Label>Alinhamento do Texto</Label>
              <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                {[
                  { icon: <AlignLeft className="w-3.5 h-3.5" />, val: 'left' },
                  { icon: <AlignCenter className="w-3.5 h-3.5" />, val: 'center' },
                  { icon: <AlignRight className="w-3.5 h-3.5" />, val: 'right' },
                  { icon: <AlignJustify className="w-3.5 h-3.5" />, val: 'justify' }
                ].map(item => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => S('text-align', item.val)}
                    className={`flex-1 flex items-center justify-center p-1 rounded transition-colors cursor-pointer ${
                      get('text-align') === item.val ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* CORES & FUNDO */}
          <Section title="Fundo & Bordas" icon={<Palette className="w-3 h-3 text-emerald-400" />} defaultOpen={false}>
            <ColorInput label="Cor de Fundo" prop="background-color" value={get('background-color')} onChange={S} />
            <div className="grid grid-cols-2 gap-2">
              <UnitInput label="Raio da Borda" prop="border-radius" value={get('border-radius')} onChange={S} placeholder="8px" />
              <UnitInput label="Largura Borda" prop="border-width" value={get('border-width')} onChange={S} placeholder="1px" />
            </div>
            <ColorInput label="Cor da Borda" prop="border-color" value={get('border-color')} onChange={S} />
          </Section>

          {/* EFEITOS & SOMBRAS */}
          <Section title="Efeitos & Sombras" icon={<Sparkles className="w-3 h-3 text-cyan-400" />} defaultOpen={false}>
            <UnitInput label="Opacidade" prop="opacity" value={get('opacity')} onChange={S} placeholder="1 (0 a 1)" />
            <UnitInput label="Sombra da Caixa (Box Shadow)" prop="box-shadow" value={get('box-shadow')} onChange={S} placeholder="0 10px 25px rgba(0,0,0,0.5)" />
            <UnitInput label="Transformação (Transform)" prop="transform" value={get('transform')} onChange={S} placeholder="scale(1.05) rotate(0deg)" />
          </Section>
        </div>
      )}
    </aside>
  );
};
