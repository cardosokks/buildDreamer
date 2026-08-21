import React, { useState } from 'react';
import {
  Settings,
  ChevronDown,
  ChevronRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Move,
  Maximize2,
  Box,
  Layers,
  Type,
  Palette,
  Square,
  Wind,
  Zap,
  Code,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignVerticalJustifyCenter,
  FileText,
  Globe,
  Search,
  Share2,
  Tag,
  Plus,
  X
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
  const zerosProps = ['margin-top','margin-bottom','margin-left','margin-right',
    'padding-top','padding-bottom','padding-left','padding-right',
    'top','right','bottom','left','letter-spacing','gap'];
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
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-900/40 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
      </button>
      {open && <div className="px-3 pb-3.5 pt-1 space-y-3">{children}</div>}
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block text-[10px] text-slate-400 mb-1 font-medium">{children}</span>
);

const inputCls = "w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-colors";
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

const BoxModelVisualizer: React.FC<{
  styles: Record<string, string>;
  onChange: (p: string, v: string) => void;
}> = ({ styles, onChange }) => {
  return (
    <div className="bg-[#05010a] border border-slate-800/80 rounded-xl p-3 select-none text-center">
      <span className="text-[9px] uppercase font-bold text-slate-500 mb-1 block">Margin & Padding (Box Model)</span>
      <div className="bg-purple-950/20 border border-dashed border-purple-500/40 rounded-lg p-2 relative">
        <span className="text-[8px] text-purple-400 font-mono absolute top-0.5 left-1.5">MARGIN</span>
        <div className="grid grid-cols-3 gap-1 items-center max-w-[200px] mx-auto my-1">
          <div />
          <input
            type="text"
            placeholder="0"
            value={styles['margin-top'] || ''}
            onChange={e => onChange('margin-top', e.target.value)}
            className="w-12 h-6 bg-slate-900 border border-slate-800 text-[10px] text-center text-white rounded mx-auto"
          />
          <div />
          <input
            type="text"
            placeholder="0"
            value={styles['margin-left'] || ''}
            onChange={e => onChange('margin-left', e.target.value)}
            className="w-12 h-6 bg-slate-900 border border-slate-800 text-[10px] text-center text-white rounded"
          />
          
          {/* Inner Padding Container */}
          <div className="bg-cyan-950/30 border border-dashed border-cyan-500/40 rounded p-1.5 relative">
            <span className="text-[8px] text-cyan-400 font-mono block">PAD</span>
            <input
              type="text"
              placeholder="0"
              value={styles['padding-top'] || ''}
              onChange={e => onChange('padding-top', e.target.value)}
              className="w-10 h-5 bg-slate-900 border border-slate-800 text-[9px] text-center text-white rounded mx-auto mb-1 block"
            />
            <div className="flex items-center justify-between gap-1">
              <input
                type="text"
                placeholder="0"
                value={styles['padding-left'] || ''}
                onChange={e => onChange('padding-left', e.target.value)}
                className="w-8 h-5 bg-slate-900 border border-slate-800 text-[9px] text-center text-white rounded"
              />
              <div className="w-3 h-3 rounded-full bg-purple-500/40 mx-auto" />
              <input
                type="text"
                placeholder="0"
                value={styles['padding-right'] || ''}
                onChange={e => onChange('padding-right', e.target.value)}
                className="w-8 h-5 bg-slate-900 border border-slate-800 text-[9px] text-center text-white rounded"
              />
            </div>
            <input
              type="text"
              placeholder="0"
              value={styles['padding-bottom'] || ''}
              onChange={e => onChange('padding-bottom', e.target.value)}
              className="w-10 h-5 bg-slate-900 border border-slate-800 text-[9px] text-center text-white rounded mx-auto mt-1 block"
            />
          </div>

          <input
            type="text"
            placeholder="0"
            value={styles['margin-right'] || ''}
            onChange={e => onChange('margin-right', e.target.value)}
            className="w-12 h-6 bg-slate-900 border border-slate-800 text-[10px] text-center text-white rounded"
          />
          <div />
          <input
            type="text"
            placeholder="0"
            value={styles['margin-bottom'] || ''}
            onChange={e => onChange('margin-bottom', e.target.value)}
            className="w-12 h-6 bg-slate-900 border border-slate-800 text-[10px] text-center text-white rounded mx-auto"
          />
          <div />
        </div>
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
  pageSeo,
  onPageSeoChange,
}) => {
  const [panelTab, setPanelTab] = useState<'styles' | 'seo'>('styles');
  const [newClassInput, setNewClassInput] = useState('');

  const get = (prop: string) => cleanComputedValue(selectedStyles[prop] || '', prop);
  const S = (p: string, v: string) => onStyleChange(p, v);

  const display = get('display') || 'block';
  const isFlex = display === 'flex';
  const isGrid = display === 'grid';
  const position = get('position') || 'static';
  const isPositioned = position !== 'static';

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

  return (
    <aside className="w-72 border-l border-slate-900 bg-[#090410] flex flex-col h-full shrink-0 select-none shadow-2xl">
      {/* Panel Top Tabs (Estilos vs SEO / Meta Tags) */}
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
          Inspector
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
          SEO & Meta
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
              value={pageSeo?.title || ''}
              onChange={(e) => onPageSeoChange && onPageSeoChange('title', e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <Label>Descrição da Página (Meta Description)</Label>
            <textarea
              rows={3}
              placeholder="Breve resumo do seu site para atrair cliques nos resultados de busca do Google."
              value={pageSeo?.description || ''}
              onChange={(e) => onPageSeoChange && onPageSeoChange('description', e.target.value)}
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
              value={pageSeo?.ogImage || ''}
              onChange={(e) => onPageSeoChange && onPageSeoChange('ogImage', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Live SERP Google Card Preview */}
          <div className="mt-4 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Prévia no Google Search</span>
            <div className="text-[11px] text-blue-400 font-medium truncate">
              {pageSeo?.title || 'Título da Sua Página'}
            </div>
            <div className="text-[10px] text-emerald-400 truncate">
              https://seusite.com.br
            </div>
            <div className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
              {pageSeo?.description || 'Adicione uma descrição para visualizar a prévia nos buscadores.'}
            </div>
          </div>
        </div>
      ) : !selectedSelector ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Settings className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-pulse" />
          <p className="text-xs text-slate-500 italic">Selecione um elemento no canvas<br />para inspecionar propriedades</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Header do Elemento Selecionado */}
          <div className="px-3.5 py-2.5 border-b border-slate-900 flex items-center justify-between gap-2 shrink-0 bg-slate-950/60">
            <div className="flex items-center gap-2 min-w-0">
              <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-[11px] font-bold text-white font-mono truncate">
                {selectedAttrs['_tag'] || 'div'}
              </span>
            </div>
            {selectedAttrs['id'] && (
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/50 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                #{selectedAttrs['id']}
              </span>
            )}
          </div>

          {/* CLASSES TAILWIND TAGS */}
          <Section title="Classes Tailwind & CSS" icon={<Code className="w-3 h-3 text-cyan-400" />} defaultOpen={true}>
            <div className="flex flex-wrap gap-1 mb-2">
              {classList.map((cls, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-950/60 border border-purple-500/40 rounded text-[10px] text-purple-200 font-mono"
                >
                  {cls}
                  <button
                    onClick={() => handleRemoveClass(cls)}
                    className="hover:text-red-400 cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddClass} className="flex gap-1">
              <input
                type="text"
                placeholder="Adicionar classe (ex: text-center, p-4)..."
                value={newClassInput}
                onChange={e => setNewClassInput(e.target.value)}
                className={`${inputCls} font-mono`}
              />
              <button
                type="submit"
                className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>
          </Section>

          {/* BOX MODEL VISUALIZER */}
          <Section title="Box Model" icon={<Box className="w-3 h-3 text-purple-400" />} defaultOpen={true}>
            <BoxModelVisualizer styles={selectedStyles} onChange={S} />
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
                    <option value="flex-end">Flex End</option>
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
        </div>
      )}
    </aside>
  );
};
