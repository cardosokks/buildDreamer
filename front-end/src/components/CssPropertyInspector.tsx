import React, { useState, useEffect, useMemo } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Maximize2,
  Box,
  Layers,
  Type,
  Palette,
  Square,
  Sparkles,
  Code,
  Tag,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Sliders
} from 'lucide-react';

export interface CssPropertyInspectorProps {
  selectedPath: string | null;
  selectedSelector: string | null;
  selectedStyles: Record<string, string>;
  selectedAttrs: Record<string, string>;
  onStyleChange: (prop: string, value: string) => void;
  onAttrChange: (attr: string, value: string) => void;
  onDuplicateElement?: (path: string) => void;
  onDeleteElement?: (path: string) => void;
}

const rgbToHex = (color: string): string => {
  if (!color || color === 'transparent' || color.startsWith('#')) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color;
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n, 10).toString(16).padStart(2, '0'))
    .join('');
};

const cleanComputedValue = (val: string, prop: string): string => {
  if (!val) return '';
  const zerosProps = [
    'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'top', 'right', 'bottom', 'left', 'letter-spacing', 'gap'
  ];
  if (zerosProps.includes(prop) && (val === '0px' || val === '0' || val === 'normal' || val === 'auto')) return '';
  if (prop === 'background-color' && (val === 'rgba(0, 0, 0, 0)' || val === 'transparent')) return '';
  if (prop === 'opacity' && val === '1') return '';
  if (prop === 'box-shadow' && val === 'none') return '';
  return val;
};

const inputCls =
  'w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors';

const selectCls =
  'w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors cursor-pointer';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">
    {children}
  </label>
);

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-900/80">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-900/40 transition-colors cursor-pointer select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-slate-200">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        )}
      </button>
      {isOpen && <div className="px-3.5 pb-3.5 space-y-3">{children}</div>}
    </div>
  );
};

const UnitInput: React.FC<{
  label: string;
  prop: string;
  value: string;
  onChange: (prop: string, val: string) => void;
  placeholder?: string;
}> = ({ label, prop, value, onChange, placeholder = 'ex: 16px, 100%, auto' }) => {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="text"
        className={inputCls}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(prop, e.target.value)}
      />
    </div>
  );
};

const ColorInput: React.FC<{
  label: string;
  prop: string;
  value: string;
  onChange: (prop: string, val: string) => void;
}> = ({ label, prop, value, onChange }) => {
  const hex = rgbToHex(value);
  const isHex = hex && hex.startsWith('#') && (hex.length === 7 || hex.length === 4);

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1.5 items-center">
        <input
          type="color"
          className="w-7 h-7 rounded cursor-pointer border border-slate-800 bg-transparent p-0 shrink-0"
          value={isHex ? hex : '#7c3aed'}
          onChange={e => onChange(prop, e.target.value)}
          title="Selecionar Cor"
        />
        <input
          type="text"
          className={`${inputCls} flex-1 font-mono`}
          placeholder="transparent / #hex / rgba()"
          value={value}
          onChange={e => onChange(prop, e.target.value)}
        />
      </div>
    </div>
  );
};

export const CssPropertyInspector: React.FC<CssPropertyInspectorProps> = ({
  selectedPath,
  selectedSelector,
  selectedStyles,
  selectedAttrs,
  onStyleChange,
  onAttrChange,
  onDuplicateElement,
  onDeleteElement
}) => {
  // State-managed styles mapping
  const [localStyles, setLocalStyles] = useState<Record<string, string>>(selectedStyles || {});
  const [newClassInput, setNewClassInput] = useState('');

  // Sync state when selection changes or selectedStyles prop updates
  useEffect(() => {
    setLocalStyles(selectedStyles || {});
  }, [selectedPath, selectedStyles]);

  const update = (prop: string, val: string) => {
    setLocalStyles(prev => ({ ...prev, [prop]: val }));
    onStyleChange(prop, val);
  };

  const get = (prop: string): string => {
    return cleanComputedValue(localStyles[prop] || '', prop);
  };

  // Class list handling
  const classList = useMemo(() => {
    return (selectedAttrs['class'] || '')
      .split(' ')
      .map(c => c.trim())
      .filter(Boolean);
  }, [selectedAttrs]);

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassInput.trim()) return;
    const toAdd = newClassInput.trim().split(' ').filter(Boolean);
    const updated = Array.from(new Set([...classList, ...toAdd])).join(' ');
    onAttrChange('class', updated);
    setNewClassInput('');
  };

  const handleRemoveClass = (clsToRemove: string) => {
    const updated = classList.filter(c => c !== clsToRemove).join(' ');
    onAttrChange('class', updated);
  };

  const handleQuickAddClass = (cls: string) => {
    if (classList.includes(cls)) return;
    const updated = [...classList, cls].join(' ');
    onAttrChange('class', updated);
  };

  const tag = selectedAttrs['_tag'] || 'div';
  const display = get('display') || 'block';
  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid' || display === 'inline-grid';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header bar with tag and quick actions */}
      <div className="px-3.5 py-2.5 border-b border-slate-900 flex items-center justify-between gap-2 shrink-0 bg-slate-950/70">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-xs font-bold text-white font-mono truncate">
            {tag}
          </span>
          {selectedAttrs['id'] && (
            <span className="text-[10px] text-purple-300 font-mono bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/30 truncate max-w-[120px]">
              #{selectedAttrs['id']}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedPath && onDuplicateElement && (
            <button
              type="button"
              onClick={() => onDuplicateElement(selectedPath)}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="Duplicar Elemento"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          {selectedPath && onDeleteElement && (
            <button
              type="button"
              onClick={() => onDeleteElement(selectedPath)}
              className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
              title="Excluir Elemento"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 1. CLASSES TAILWIND & CSS */}
      <Section title="Classes Tailwind & CSS" icon={<Code className="w-3.5 h-3.5 text-cyan-400" />} defaultOpen={true}>
        <form onSubmit={handleAddClass} className="flex gap-1.5">
          <input
            type="text"
            placeholder="+ class (ex: p-4 rounded-xl)"
            value={newClassInput}
            onChange={e => setNewClassInput(e.target.value)}
            className={`${inputCls} flex-1`}
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Adicionar
          </button>
        </form>

        {/* Quick pill suggestions */}
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-[9px] text-slate-500 font-bold uppercase w-full">Atalhos rápidos:</span>
          {['flex', 'grid', 'p-4', 'p-6', 'rounded-xl', 'shadow-lg', 'text-center', 'm-auto'].map(sug => (
            <button
              key={sug}
              type="button"
              onClick={() => handleQuickAddClass(sug)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-purple-900/40 text-slate-400 hover:text-purple-300 border border-slate-800 transition-colors cursor-pointer"
            >
              +{sug}
            </button>
          ))}
        </div>

        {classList.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto p-1 bg-slate-950/60 rounded-lg border border-slate-900">
            {classList.map(cls => (
              <span
                key={cls}
                className="inline-flex items-center gap-1 bg-purple-950/50 border border-purple-500/30 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded"
              >
                {cls}
                <button
                  type="button"
                  onClick={() => handleRemoveClass(cls)}
                  className="hover:text-red-400 cursor-pointer ml-0.5 font-bold"
                  title={`Remover classe ${cls}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* 2. DIMENSÕES & TAMANHO */}
      <Section title="Dimensões & Tamanho" icon={<Maximize2 className="w-3.5 h-3.5 text-blue-400" />} defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2.5">
          <UnitInput label="Largura (Width)" prop="width" value={get('width')} onChange={update} placeholder="auto / 100% / 320px" />
          <UnitInput label="Altura (Height)" prop="height" value={get('height')} onChange={update} placeholder="auto / 100% / 240px" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <UnitInput label="Largura Máx (Max-W)" prop="max-width" value={get('max-width')} onChange={update} placeholder="none / 1200px" />
          <UnitInput label="Altura Mín (Min-H)" prop="min-height" value={get('min-height')} onChange={update} placeholder="auto / 100vh" />
        </div>
        <div>
          <Label>Transbordamento (Overflow)</Label>
          <select className={selectCls} value={get('overflow')} onChange={e => update('overflow', e.target.value)}>
            <option value="visible">Visible (Padrão)</option>
            <option value="hidden">Hidden (Cortar)</option>
            <option value="auto">Auto (Barra se necessário)</option>
            <option value="scroll">Scroll (Barra sempre)</option>
          </select>
        </div>
      </Section>

      {/* 3. ESPAÇAMENTO (BOX MODEL) */}
      <Section title="Espaçamento (Padding & Margin)" icon={<Box className="w-3.5 h-3.5 text-emerald-400" />} defaultOpen={true}>
        {/* Padding */}
        <div className="space-y-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Padding (Interno)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <UnitInput label="Topo (Top)" prop="padding-top" value={get('padding-top')} onChange={update} placeholder="0px" />
            <UnitInput label="Base (Bottom)" prop="padding-bottom" value={get('padding-bottom')} onChange={update} placeholder="0px" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <UnitInput label="Esquerda (Left)" prop="padding-left" value={get('padding-left')} onChange={update} placeholder="0px" />
            <UnitInput label="Direita (Right)" prop="padding-right" value={get('padding-right')} onChange={update} placeholder="0px" />
          </div>
        </div>

        {/* Margin */}
        <div className="space-y-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Margin (Externo)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <UnitInput label="Topo (Top)" prop="margin-top" value={get('margin-top')} onChange={update} placeholder="0px" />
            <UnitInput label="Base (Bottom)" prop="margin-bottom" value={get('margin-bottom')} onChange={update} placeholder="0px" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <UnitInput label="Esquerda (Left)" prop="margin-left" value={get('margin-left')} onChange={update} placeholder="0px / auto" />
            <UnitInput label="Direita (Right)" prop="margin-right" value={get('margin-right')} onChange={update} placeholder="0px / auto" />
          </div>
        </div>
      </Section>

      {/* 4. LAYOUT & DISPLAY */}
      <Section title="Layout & Display" icon={<Layers className="w-3.5 h-3.5 text-pink-400" />} defaultOpen={true}>
        <div>
          <Label>Display</Label>
          <select className={selectCls} value={display} onChange={e => update('display', e.target.value)}>
            <option value="block">Block</option>
            <option value="flex">Flexbox</option>
            <option value="grid">CSS Grid</option>
            <option value="inline-block">Inline-Block</option>
            <option value="inline">Inline</option>
            <option value="none">None (Ocultar)</option>
          </select>
        </div>

        {isFlex && (
          <div className="space-y-2.5 pt-1 p-2 bg-purple-950/20 border border-purple-500/20 rounded-xl">
            <div>
              <Label>Flex Direction</Label>
              <select className={selectCls} value={get('flex-direction')} onChange={e => update('flex-direction', e.target.value)}>
                <option value="row">Row (Horizontal)</option>
                <option value="column">Column (Vertical)</option>
                <option value="row-reverse">Row Reverse</option>
                <option value="column-reverse">Column Reverse</option>
              </select>
            </div>
            <div>
              <Label>Justify Content</Label>
              <select className={selectCls} value={get('justify-content')} onChange={e => update('justify-content', e.target.value)}>
                <option value="flex-start">Start</option>
                <option value="center">Center</option>
                <option value="flex-end">End</option>
                <option value="space-between">Space Between</option>
                <option value="space-around">Space Around</option>
                <option value="space-evenly">Space Evenly</option>
              </select>
            </div>
            <div>
              <Label>Align Items</Label>
              <select className={selectCls} value={get('align-items')} onChange={e => update('align-items', e.target.value)}>
                <option value="stretch">Stretch</option>
                <option value="flex-start">Flex Start</option>
                <option value="center">Center</option>
                <option value="flex-end">End</option>
                <option value="baseline">Baseline</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <UnitInput label="Espaço (Gap)" prop="gap" value={get('gap')} onChange={update} placeholder="16px" />
              <div>
                <Label>Flex Wrap</Label>
                <select className={selectCls} value={get('flex-wrap')} onChange={e => update('flex-wrap', e.target.value)}>
                  <option value="nowrap">No Wrap</option>
                  <option value="wrap">Wrap</option>
                  <option value="wrap-reverse">Wrap Reverse</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {isGrid && (
          <div className="space-y-2.5 pt-1 p-2 bg-purple-950/20 border border-purple-500/20 rounded-xl">
            <UnitInput label="Colunas (Grid Template)" prop="grid-template-columns" value={get('grid-template-columns')} onChange={update} placeholder="repeat(3, 1fr)" />
            <UnitInput label="Espaço (Gap)" prop="gap" value={get('gap')} onChange={update} placeholder="16px" />
          </div>
        )}
      </Section>

      {/* 5. TIPOGRAFIA */}
      <Section title="Tipografia" icon={<Type className="w-3.5 h-3.5 text-yellow-400" />} defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2.5">
          <UnitInput label="Tamanho da Fonte" prop="font-size" value={get('font-size')} onChange={update} placeholder="16px" />
          <div>
            <Label>Peso (Font Weight)</Label>
            <select className={selectCls} value={get('font-weight')} onChange={e => update('font-weight', e.target.value)}>
              <option value="300">300 (Light)</option>
              <option value="400">400 (Normal)</option>
              <option value="500">500 (Medium)</option>
              <option value="600">600 (Semi Bold)</option>
              <option value="700">700 (Bold)</option>
              <option value="800">800 (Extra Bold)</option>
              <option value="900">900 (Black)</option>
            </select>
          </div>
        </div>

        <ColorInput label="Cor do Texto" prop="color" value={get('color')} onChange={update} />

        <div>
          <Label>Alinhamento do Texto</Label>
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            {[
              { val: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, title: 'Esquerda' },
              { val: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, title: 'Centro' },
              { val: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, title: 'Direita' },
              { val: 'justify', icon: <AlignJustify className="w-3.5 h-3.5" />, title: 'Justificado' }
            ].map(item => (
              <button
                key={item.val}
                type="button"
                onClick={() => update('text-align', item.val)}
                className={`flex-1 py-1 flex items-center justify-center rounded transition-colors cursor-pointer ${
                  get('text-align') === item.val
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={item.title}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <UnitInput label="Altura da Linha (Line-Height)" prop="line-height" value={get('line-height')} onChange={update} placeholder="1.5" />
          <UnitInput label="Espaçamento Letras" prop="letter-spacing" value={get('letter-spacing')} onChange={update} placeholder="0px" />
        </div>
      </Section>

      {/* 6. FUNDO & BORDAS */}
      <Section title="Fundo & Bordas" icon={<Square className="w-3.5 h-3.5 text-indigo-400" />} defaultOpen={true}>
        <ColorInput label="Cor de Fundo" prop="background-color" value={get('background-color')} onChange={update} />

        <div className="grid grid-cols-2 gap-2.5">
          <UnitInput label="Arredondamento (Radius)" prop="border-radius" value={get('border-radius')} onChange={update} placeholder="8px / 9999px" />
          <UnitInput label="Largura da Borda" prop="border-width" value={get('border-width')} onChange={update} placeholder="1px" />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label>Estilo da Borda</Label>
            <select className={selectCls} value={get('border-style')} onChange={e => update('border-style', e.target.value)}>
              <option value="none">Nenhuma</option>
              <option value="solid">Sólida (Solid)</option>
              <option value="dashed">Tracejada (Dashed)</option>
              <option value="dotted">Pontilhada (Dotted)</option>
            </select>
          </div>
          <ColorInput label="Cor da Borda" prop="border-color" value={get('border-color')} onChange={update} />
        </div>
      </Section>

      {/* 7. EFEITOS & SOMBRAS */}
      <Section title="Efeitos & Sombras" icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />} defaultOpen={false}>
        <div>
          <div className="flex justify-between items-center mb-1">
            <Label>Opacidade</Label>
            <span className="text-[10px] text-purple-300 font-mono">{get('opacity') || '1'}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={get('opacity') || '1'}
            onChange={e => update('opacity', e.target.value)}
            className="w-full accent-purple-600 cursor-pointer"
          />
        </div>

        <div>
          <Label>Sombra da Caixa (Box Shadow)</Label>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => update('box-shadow', 'none')}
              className="py-1 px-2 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-colors"
            >
              Sem sombra
            </button>
            <button
              type="button"
              onClick={() => update('box-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)')}
              className="py-1 px-2 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-colors"
            >
              Suave
            </button>
            <button
              type="button"
              onClick={() => update('box-shadow', '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.05)')}
              className="py-1 px-2 text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-colors"
            >
              Média
            </button>
            <button
              type="button"
              onClick={() => update('box-shadow', '0 0 25px rgba(168, 85, 247, 0.35)')}
              className="py-1 px-2 text-[10px] bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 rounded border border-purple-500/30 transition-colors"
            >
              Brilho Roxo
            </button>
          </div>
          <input
            type="text"
            className={inputCls}
            placeholder="0 10px 25px rgba(0,0,0,0.2)"
            value={get('box-shadow')}
            onChange={e => update('box-shadow', e.target.value)}
          />
        </div>

        <div>
          <Label>Cursor</Label>
          <select className={selectCls} value={get('cursor')} onChange={e => update('cursor', e.target.value)}>
            <option value="default">Default (Padrão)</option>
            <option value="pointer">Pointer (Mãozinha)</option>
            <option value="text">Text (Texto)</option>
            <option value="move">Move (Mover)</option>
            <option value="not-allowed">Not Allowed (Proibido)</option>
          </select>
        </div>

        <UnitInput label="Transição (Transition)" prop="transition" value={get('transition')} onChange={update} placeholder="all 0.2s ease" />
      </Section>
    </div>
  );
};
