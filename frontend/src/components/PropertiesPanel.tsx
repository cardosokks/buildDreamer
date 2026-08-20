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
} from 'lucide-react';

// Convert "rgb(r, g, b)" or "rgba(r,g,b,a)" to "#rrggbb" for color inputs
const rgbToHex = (color: string): string => {
  if (!color || color === 'transparent' || color.startsWith('#')) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color;
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n).toString(16).padStart(2, '0'))
    .join('');
};

// Strip computed px values to just the number part when not set inline
const cleanComputedValue = (val: string, prop: string): string => {
  if (!val) return '';
  // If the value looks like a default computed value (e.g. 0px for margin), return empty
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
}

// Reusable building blocks
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, icon, children, defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-900/80">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-900/50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown className="w-3 h-3 text-slate-600" /> : <ChevronRight className="w-3 h-3 text-slate-600" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2.5">{children}</div>}
    </div>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="block text-[10px] text-slate-500 mb-1 font-medium">{children}</span>
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
  
  // Clean value to extract numeric representation and unit
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
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(hex);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        <input
          type="color"
          className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
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

const SpacingBox: React.FC<{
  label: string;
  props: { top: string; right: string; bottom: string; left: string };
  values: Record<string, string>;
  onChange: (p: string, v: string) => void;
}> = ({ label, props, values, onChange }) => (
  <div>
    <Label>{label}</Label>
    <div className="grid grid-cols-3 gap-1 items-center">
      <div />
      <input type="text" placeholder="Top" className={`${inputCls} text-center`}
        value={values[props.top] || ''} onChange={e => onChange(props.top, e.target.value)} />
      <div />
      <input type="text" placeholder="L" className={`${inputCls} text-center`}
        value={values[props.left] || ''} onChange={e => onChange(props.left, e.target.value)} />
      <div className="w-4 h-4 rounded border border-slate-700 bg-slate-800 mx-auto" />
      <input type="text" placeholder="R" className={`${inputCls} text-center`}
        value={values[props.right] || ''} onChange={e => onChange(props.right, e.target.value)} />
      <div />
      <input type="text" placeholder="Bot" className={`${inputCls} text-center`}
        value={values[props.bottom] || ''} onChange={e => onChange(props.bottom, e.target.value)} />
      <div />
    </div>
  </div>
);

const IconToggleGroup: React.FC<{
  options: { value: string; icon: React.ReactNode; title: string }[];
  selected: string;
  onChange: (v: string) => void;
}> = ({ options, selected, onChange }) => (
  <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
    {options.map(o => (
      <button
        key={o.value}
        title={o.title}
        onClick={() => onChange(o.value)}
        className={`flex-1 flex items-center justify-center p-1.5 rounded cursor-pointer transition-all ${
          selected === o.value ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'
        }`}
      >
        {o.icon}
      </button>
    ))}
  </div>
);

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedSelector,
  selectedPath,
  selectedStyles,
  selectedAttrs,
  onStyleChange,
  onAttrChange,
}) => {
  if (!selectedSelector) {
    return (
      <aside className="w-64 border-l border-slate-900 bg-slate-950 flex flex-col h-full shrink-0 items-center justify-center">
        <div className="text-center p-6 space-y-2">
          <Settings className="w-8 h-8 text-slate-700 mx-auto" />
          <p className="text-xs text-slate-600 italic">Selecione um elemento<br />para editar as propriedades</p>
        </div>
      </aside>
    );
  }

  const get = (prop: string) => cleanComputedValue(selectedStyles[prop] || '', prop);
  const S = (p: string, v: string) => onStyleChange(p, v);

  const display = get('display') || 'block';
  const isFlex = display === 'flex';
  const isGrid = display === 'grid';
  const position = get('position') || 'static';
  const isPositioned = position !== 'static';

  const cleanSelector = selectedSelector.split('>').pop()?.trim() || selectedSelector;

  return (
    <aside className="w-64 border-l border-slate-900 bg-slate-950 flex flex-col h-full shrink-0">

      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-900 flex items-center gap-2 shrink-0">
        <Settings className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">{cleanSelector}</span>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* CONTEÚDO DO ELEMENTO (text editing) */}
        {selectedAttrs['_hasChildren'] !== 'true' && selectedAttrs['_tag'] && !['img','input','hr','br','meta','link'].includes(selectedAttrs['_tag']) && (
          <Section title="Conteúdo do Texto" icon={<FileText className="w-3 h-3" />} defaultOpen={true}>
            <div>
              <Label>Texto do elemento ({selectedAttrs['_tag']})</Label>
              <textarea
                className={`${inputCls} resize-none leading-relaxed`}
                rows={3}
                placeholder="Digite o texto aqui..."
                value={selectedAttrs['_textContent'] || ''}
                onChange={e => onAttrChange('_textContent', e.target.value)}
              />
            </div>
          </Section>
        )}

        {/* ATRIBUTOS HTML */}
        <Section title="Atributos HTML" icon={<Code className="w-3 h-3" />} defaultOpen={true}>
          <div>
            <Label>id</Label>
            <input className={inputCls} placeholder="identificador" value={selectedAttrs['id'] || ''}
              onChange={e => onAttrChange('id', e.target.value)} />
          </div>
          <div>
            <Label>class</Label>
            <input className={inputCls} placeholder="classes CSS" value={selectedAttrs['class'] || ''}
              onChange={e => onAttrChange('class', e.target.value)} />
          </div>
          {(selectedAttrs['_tag'] === 'a') && (
            <>
              <div>
                <Label>href</Label>
                <input className={inputCls} placeholder="https://..." value={selectedAttrs['href'] || ''}
                  onChange={e => onAttrChange('href', e.target.value)} />
              </div>
              <div>
                <Label>target</Label>
                <select className={selectCls} value={selectedAttrs['target'] || '_self'}
                  onChange={e => onAttrChange('target', e.target.value)}>
                  <option value="_self">_self</option>
                  <option value="_blank">_blank</option>
                </select>
              </div>
            </>
          )}
          {(selectedAttrs['_tag'] === 'img') && (
            <>
              <div>
                <Label>src</Label>
                <input className={inputCls} placeholder="URL da imagem" value={selectedAttrs['src'] || ''}
                  onChange={e => onAttrChange('src', e.target.value)} />
              </div>
              <div>
                <Label>alt</Label>
                <input className={inputCls} placeholder="Descrição" value={selectedAttrs['alt'] || ''}
                  onChange={e => onAttrChange('alt', e.target.value)} />
              </div>
            </>
          )}
          {(['input', 'textarea'].includes(selectedAttrs['_tag'] || '')) && (
            <div>
              <Label>placeholder</Label>
              <input className={inputCls} placeholder="Texto de exemplo" value={selectedAttrs['placeholder'] || ''}
                onChange={e => onAttrChange('placeholder', e.target.value)} />
            </div>
          )}
        </Section>

        {/* DIMENSÕES */}
        <Section title="Dimensões" icon={<Maximize2 className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <UnitInput label="Width" prop="width" value={get('width')} onChange={S} />
            <UnitInput label="Height" prop="height" value={get('height')} onChange={S} />
            <UnitInput label="Min W" prop="min-width" value={get('min-width')} onChange={S} />
            <UnitInput label="Max W" prop="max-width" value={get('max-width')} onChange={S} />
            <UnitInput label="Min H" prop="min-height" value={get('min-height')} onChange={S} />
            <UnitInput label="Max H" prop="max-height" value={get('max-height')} onChange={S} />
          </div>
          <div>
            <Label>Overflow</Label>
            <div className="grid grid-cols-2 gap-1">
              <select className={selectCls} value={get('overflow-x') || 'visible'}
                onChange={e => S('overflow-x', e.target.value)}>
                <option value="visible">X: visible</option>
                <option value="hidden">X: hidden</option>
                <option value="auto">X: auto</option>
                <option value="scroll">X: scroll</option>
              </select>
              <select className={selectCls} value={get('overflow-y') || 'visible'}
                onChange={e => S('overflow-y', e.target.value)}>
                <option value="visible">Y: visible</option>
                <option value="hidden">Y: hidden</option>
                <option value="auto">Y: auto</option>
                <option value="scroll">Y: scroll</option>
              </select>
            </div>
          </div>
        </Section>

        {/* ESPAÇAMENTO */}
        <Section title="Espaçamento" icon={<Box className="w-3 h-3" />}>
          <SpacingBox
            label="Margin"
            props={{ top: 'margin-top', right: 'margin-right', bottom: 'margin-bottom', left: 'margin-left' }}
            values={selectedStyles}
            onChange={S}
          />
          <SpacingBox
            label="Padding"
            props={{ top: 'padding-top', right: 'padding-right', bottom: 'padding-bottom', left: 'padding-left' }}
            values={selectedStyles}
            onChange={S}
          />
        </Section>

        {/* LAYOUT */}
        <Section title="Layout" icon={<Layers className="w-3 h-3" />}>
          <div>
            <Label>Display</Label>
            <select className={selectCls} value={display} onChange={e => S('display', e.target.value)}>
              <option value="block">Block</option>
              <option value="flex">Flex</option>
              <option value="grid">Grid</option>
              <option value="inline">Inline</option>
              <option value="inline-block">Inline Block</option>
              <option value="inline-flex">Inline Flex</option>
              <option value="none">None (oculto)</option>
            </select>
          </div>

          {isFlex && (
            <>
              <div>
                <Label>Flex Direction</Label>
                <select className={selectCls} value={get('flex-direction') || 'row'}
                  onChange={e => S('flex-direction', e.target.value)}>
                  <option value="row">Row →</option>
                  <option value="row-reverse">Row Reverse ←</option>
                  <option value="column">Column ↓</option>
                  <option value="column-reverse">Column Reverse ↑</option>
                </select>
              </div>
              <div>
                <Label>Align Items</Label>
                <IconToggleGroup
                  selected={get('align-items') || 'stretch'}
                  onChange={v => S('align-items', v)}
                  options={[
                    { value: 'flex-start', icon: <AlignStartHorizontal className="w-3.5 h-3.5" />, title: 'flex-start' },
                    { value: 'center', icon: <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />, title: 'center' },
                    { value: 'flex-end', icon: <AlignEndHorizontal className="w-3.5 h-3.5" />, title: 'flex-end' },
                    { value: 'stretch', icon: <AlignJustify className="w-3.5 h-3.5" />, title: 'stretch' },
                  ]}
                />
              </div>
              <div>
                <Label>Justify Content</Label>
                <select className={selectCls} value={get('justify-content') || 'flex-start'}
                  onChange={e => S('justify-content', e.target.value)}>
                  <option value="flex-start">Start</option>
                  <option value="center">Center</option>
                  <option value="flex-end">End</option>
                  <option value="space-between">Space Between</option>
                  <option value="space-around">Space Around</option>
                  <option value="space-evenly">Space Evenly</option>
                </select>
              </div>
              <div>
                <Label>Flex Wrap</Label>
                <select className={selectCls} value={get('flex-wrap') || 'nowrap'}
                  onChange={e => S('flex-wrap', e.target.value)}>
                  <option value="nowrap">No Wrap</option>
                  <option value="wrap">Wrap</option>
                  <option value="wrap-reverse">Wrap Reverse</option>
                </select>
              </div>
              <UnitInput label="Gap" prop="gap" value={get('gap')} onChange={S} placeholder="8px" />
            </>
          )}

          {isGrid && (
            <>
              <div>
                <Label>Grid Template Columns</Label>
                <input className={inputCls} placeholder="repeat(3, 1fr)" value={get('grid-template-columns')}
                  onChange={e => S('grid-template-columns', e.target.value)} />
              </div>
              <div>
                <Label>Grid Template Rows</Label>
                <input className={inputCls} placeholder="auto" value={get('grid-template-rows')}
                  onChange={e => S('grid-template-rows', e.target.value)} />
              </div>
              <UnitInput label="Gap" prop="gap" value={get('gap')} onChange={S} placeholder="16px" />
            </>
          )}
        </Section>

        {/* POSICIONAMENTO */}
        <Section title="Posicionamento" icon={<Move className="w-3 h-3" />} defaultOpen={false}>
          <div>
            <Label>Position</Label>
            <select className={selectCls} value={position} onChange={e => S('position', e.target.value)}>
              <option value="static">Static</option>
              <option value="relative">Relative</option>
              <option value="absolute">Absolute</option>
              <option value="fixed">Fixed</option>
              <option value="sticky">Sticky</option>
            </select>
          </div>
          {isPositioned && (
            <div className="grid grid-cols-2 gap-1.5">
              <UnitInput label="Top" prop="top" value={get('top')} onChange={S} />
              <UnitInput label="Right" prop="right" value={get('right')} onChange={S} />
              <UnitInput label="Bottom" prop="bottom" value={get('bottom')} onChange={S} />
              <UnitInput label="Left" prop="left" value={get('left')} onChange={S} />
            </div>
          )}
          <div>
            <Label>Z-Index</Label>
            <input type="number" className={inputCls} placeholder="0" value={get('z-index')}
              onChange={e => S('z-index', e.target.value)} />
          </div>
        </Section>

        {/* TIPOGRAFIA */}
        <Section title="Tipografia" icon={<Type className="w-3 h-3" />}>
          <div>
            <Label>Font Family</Label>
            <select className={selectCls} value={get('font-family') || 'inherit'}
              onChange={e => S('font-family', e.target.value)}>
              <option value="inherit">Herdar</option>
              <option value="'Inter', sans-serif">Inter</option>
              <option value="'Roboto', sans-serif">Roboto</option>
              <option value="'Outfit', sans-serif">Outfit</option>
              <option value="'Poppins', sans-serif">Poppins</option>
              <option value="'Playfair Display', serif">Playfair Display</option>
              <option value="'Lora', serif">Lora</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              <option value="monospace">Monospace</option>
              <option value="serif">Serif</option>
              <option value="sans-serif">Sans-Serif</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <UnitInput label="Font Size" prop="font-size" value={get('font-size')} onChange={S} placeholder="16px" />
            <UnitInput label="Line Height" prop="line-height" value={get('line-height')} onChange={S} placeholder="1.5" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Font Weight</Label>
              <select className={selectCls} value={get('font-weight') || '400'}
                onChange={e => S('font-weight', e.target.value)}>
                <option value="100">100 Thin</option>
                <option value="200">200 ExtraLight</option>
                <option value="300">300 Light</option>
                <option value="400">400 Regular</option>
                <option value="500">500 Medium</option>
                <option value="600">600 SemiBold</option>
                <option value="700">700 Bold</option>
                <option value="800">800 ExtraBold</option>
                <option value="900">900 Black</option>
              </select>
            </div>
            <UnitInput label="Letter Spacing" prop="letter-spacing" value={get('letter-spacing')} onChange={S} placeholder="0px" />
          </div>
          <div>
            <Label>Text Align</Label>
            <IconToggleGroup
              selected={get('text-align') || 'left'}
              onChange={v => S('text-align', v)}
              options={[
                { value: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, title: 'Left' },
                { value: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, title: 'Center' },
                { value: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, title: 'Right' },
                { value: 'justify', icon: <AlignJustify className="w-3.5 h-3.5" />, title: 'Justify' },
              ]}
            />
          </div>
          <div>
            <Label>Decoração / Estilo</Label>
            <div className="flex gap-1.5">
              {[
                { prop: 'font-style', val: 'italic', icon: <Italic className="w-3.5 h-3.5" />, active: get('font-style') === 'italic' },
                { prop: 'font-weight', val: get('font-weight') === '700' ? '400' : '700', icon: <Bold className="w-3.5 h-3.5" />, active: Number(get('font-weight')) >= 700 },
                { prop: 'text-decoration', val: get('text-decoration') === 'underline' ? 'none' : 'underline', icon: <Underline className="w-3.5 h-3.5" />, active: get('text-decoration') === 'underline' },
                { prop: 'text-decoration', val: get('text-decoration') === 'line-through' ? 'none' : 'line-through', icon: <Strikethrough className="w-3.5 h-3.5" />, active: get('text-decoration') === 'line-through' },
              ].map((btn, i) => (
                <button key={i}
                  onClick={() => S(btn.prop, btn.val)}
                  className={`flex-1 flex items-center justify-center p-1.5 rounded-lg border cursor-pointer transition-all ${btn.active ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}>
                  {btn.icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Text Transform</Label>
            <select className={selectCls} value={get('text-transform') || 'none'}
              onChange={e => S('text-transform', e.target.value)}>
              <option value="none">none</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
          <ColorInput label="Cor do Texto" prop="color" value={get('color')} onChange={S} />
        </Section>

        {/* APARÊNCIA */}
        <Section title="Aparência" icon={<Palette className="w-3 h-3" />}>
          <ColorInput label="Background Color" prop="background-color" value={get('background-color')} onChange={S} />
          <div>
            <Label>Background Image / Gradient</Label>
            <input className={inputCls} placeholder="linear-gradient(...) / url(...)"
              value={get('background-image')} onChange={e => S('background-image', e.target.value)} />
          </div>
          <div>
            <Label>Background Size</Label>
            <select className={selectCls} value={get('background-size') || 'auto'}
              onChange={e => S('background-size', e.target.value)}>
              <option value="auto">auto</option>
              <option value="cover">cover</option>
              <option value="contain">contain</option>
            </select>
          </div>
          <div>
            <Label>Opacidade: {get('opacity') || '1'}</Label>
            <input type="range" min="0" max="1" step="0.01"
              className="w-full accent-purple-500 cursor-pointer"
              value={get('opacity') || '1'}
              onChange={e => S('opacity', e.target.value)} />
          </div>
          <div>
            <Label>Cursor</Label>
            <select className={selectCls} value={get('cursor') || 'default'}
              onChange={e => S('cursor', e.target.value)}>
              <option value="default">default</option>
              <option value="pointer">pointer</option>
              <option value="text">text</option>
              <option value="not-allowed">not-allowed</option>
              <option value="grab">grab</option>
              <option value="crosshair">crosshair</option>
            </select>
          </div>
        </Section>

        {/* BORDA */}
        <Section title="Borda" icon={<Square className="w-3 h-3" />} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Border Style</Label>
              <select className={selectCls} value={get('border-style') || 'none'}
                onChange={e => S('border-style', e.target.value)}>
                <option value="none">none</option>
                <option value="solid">solid</option>
                <option value="dashed">dashed</option>
                <option value="dotted">dotted</option>
                <option value="double">double</option>
              </select>
            </div>
            <UnitInput label="Border Width" prop="border-width" value={get('border-width')} onChange={S} placeholder="1px" />
          </div>
          <ColorInput label="Border Color" prop="border-color" value={get('border-color')} onChange={S} />
          <div>
            <Label>Border Radius (geral)</Label>
            <div className="flex gap-1">
              <input type="range" min="0" max="100" className="flex-1 accent-purple-500 cursor-pointer"
                value={parseInt(get('border-radius')) || 0}
                onChange={e => S('border-radius', `${e.target.value}px`)} />
              <span className="text-[10px] text-slate-400 w-8 text-right">{get('border-radius') || '0px'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <UnitInput label="↖ TL" prop="border-top-left-radius" value={get('border-top-left-radius')} onChange={S} placeholder="0px" />
            <UnitInput label="↗ TR" prop="border-top-right-radius" value={get('border-top-right-radius')} onChange={S} placeholder="0px" />
            <UnitInput label="↙ BL" prop="border-bottom-left-radius" value={get('border-bottom-left-radius')} onChange={S} placeholder="0px" />
            <UnitInput label="↘ BR" prop="border-bottom-right-radius" value={get('border-bottom-right-radius')} onChange={S} placeholder="0px" />
          </div>
        </Section>

        {/* SOMBRA */}
        <Section title="Sombra" icon={<Wind className="w-3 h-3" />} defaultOpen={false}>
          <div>
            <Label>Box Shadow</Label>
            <input className={inputCls} placeholder="0 4px 24px rgba(0,0,0,0.3)"
              value={get('box-shadow')} onChange={e => S('box-shadow', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'None', val: 'none' },
              { label: 'sm', val: '0 1px 3px rgba(0,0,0,0.2)' },
              { label: 'md', val: '0 4px 16px rgba(0,0,0,0.3)' },
              { label: 'lg', val: '0 10px 40px rgba(0,0,0,0.4)' },
              { label: 'xl', val: '0 20px 60px rgba(0,0,0,0.5)' },
              { label: 'inner', val: 'inset 0 2px 8px rgba(0,0,0,0.3)' },
            ].map(p => (
              <button key={p.label} onClick={() => S('box-shadow', p.val)}
                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-slate-700 cursor-pointer transition-colors">
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <Label>Text Shadow</Label>
            <input className={inputCls} placeholder="0 2px 8px rgba(0,0,0,0.5)"
              value={get('text-shadow')} onChange={e => S('text-shadow', e.target.value)} />
          </div>
        </Section>

        {/* TRANSIÇÃO */}
        <Section title="Transição / Animação" icon={<Zap className="w-3 h-3" />} defaultOpen={false}>
          <div>
            <Label>Transition</Label>
            <input className={inputCls} placeholder="all 0.3s ease"
              value={get('transition')} onChange={e => S('transition', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[
              { label: 'Rápido', val: 'all 0.15s ease' },
              { label: 'Normal', val: 'all 0.3s ease' },
              { label: 'Lento', val: 'all 0.6s ease' },
              { label: 'Bounce', val: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)' },
            ].map(p => (
              <button key={p.label} onClick={() => S('transition', p.val)}
                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-white hover:border-slate-700 cursor-pointer transition-colors">
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <Label>Transform</Label>
            <input className={inputCls} placeholder="scale(1) rotate(0deg) translateX(0)"
              value={get('transform')} onChange={e => S('transform', e.target.value)} />
          </div>
        </Section>

      </div>
    </aside>
  );
};
