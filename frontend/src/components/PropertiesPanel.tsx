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
  Edit3,
  Navigation,
  Layout,
  Image,
  Link,
  FormInput,
  List,
  Video,
  GripVertical
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

export interface ElementNode {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  children?: ElementNode[];
  path?: string;
}

interface PropertiesPanelProps {
  selectedSelector: string | null;
  selectedPath?: string | null;
  selectedStyles: Record<string, string>;
  selectedAttrs: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  onAttrChange: (attr: string, value: string) => void;
  onDeleteElement?: (path: string) => void;
  onDuplicateElement?: (path: string) => void;
  onMoveElement?: (sourcePath: string, targetPath: string, position?: 'before' | 'after' | 'inside') => void;
  onMoveElementDirection?: (path: string, direction: 'up' | 'down') => void;
  layers?: ElementNode[];
  onSelectLayer?: (selector: string, path: string) => void;
  onHoverLayer?: (path: string | null) => void;
  onSaveSelectionAsTemplate?: (title: string, category: string) => void;
  onInsertBlock?: (htmlBlock: string, cssBlock?: string, targetPath?: string, position?: 'before' | 'after' | 'inside') => void;
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
  const isHex = hex && hex.startsWith('#') && (hex.length === 7 || hex.length === 4);

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-1.5 items-center">
        <input
          type="color"
          className="w-7 h-7 rounded cursor-pointer border border-slate-800 bg-transparent p-0 shrink-0"
          value={isHex ? (hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex) : '#000000'}
          onChange={e => onChange(prop, e.target.value)}
        />
        <input
          type="text"
          className={`${inputCls} flex-1`}
          placeholder="transparent / #hex / rgba()"
          value={value || ''}
          onChange={e => onChange(prop, e.target.value)}
        />
      </div>
    </div>
  );
};

function getTagDetails(tag: string) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  const t = tag.toLowerCase();
  switch (t) {
    case 'header':
      return { icon: <Navigation className={`${cls} text-pink-400`} />, name: 'Header / Topo' };
    case 'nav':
      return { icon: <Navigation className={`${cls} text-pink-400`} />, name: 'Navegação' };
    case 'footer':
      return { icon: <Navigation className={`${cls} text-rose-400`} />, name: 'Footer / Rodapé' };
    case 'section':
      return { icon: <Layout className={`${cls} text-purple-400`} />, name: 'Seção' };
    case 'article': case 'main': case 'aside':
      return { icon: <Layout className={`${cls} text-purple-400`} />, name: t.toUpperCase() };
    case 'div':
      return { icon: <Layers className={`${cls} text-indigo-400`} />, name: 'Container' };
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return { icon: <Type className={`${cls} text-yellow-400`} />, name: `Título (${t.toUpperCase()})` };
    case 'p':
      return { icon: <AlignLeft className={`${cls} text-blue-400`} />, name: 'Parágrafo' };
    case 'span': case 'strong': case 'em':
      return { icon: <AlignLeft className={`${cls} text-cyan-400`} />, name: 'Texto Inline' };
    case 'a':
      return { icon: <Link className={`${cls} text-emerald-400`} />, name: 'Link / Botão' };
    case 'img':
      return { icon: <Image className={`${cls} text-teal-400`} />, name: 'Imagem' };
    case 'button':
      return { icon: <FormInput className={`${cls} text-orange-400`} />, name: 'Botão' };
    case 'input': case 'textarea': case 'select': case 'form':
      return { icon: <FormInput className={`${cls} text-amber-400`} />, name: 'Formulário' };
    case 'ul': case 'ol':
      return { icon: <List className={`${cls} text-slate-400`} />, name: 'Lista' };
    case 'li':
      return { icon: <List className={`${cls} text-slate-400`} />, name: 'Item da Lista' };
    case 'video': case 'iframe':
      return { icon: <Video className={`${cls} text-red-400`} />, name: 'Vídeo / Iframe' };
    default:
      return { icon: <Square className={`${cls} text-slate-500`} />, name: tag.toLowerCase() };
  }
}


export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedSelector,
  selectedPath,
  selectedStyles,
  selectedAttrs,
  onStyleChange,
  onAttrChange,
  onDeleteElement,
  onDuplicateElement,
  onMoveElement,
  onMoveElementDirection,
  layers = [],
  onSelectLayer,
  onHoverLayer,
  onSaveSelectionAsTemplate,
  onInsertBlock,
  pageSeo,
  onPageSeoChange,
}) => {
  const [panelTab, setPanelTab] = useState<'layers' | 'styles' | 'attrs' | 'seo'>('layers');
  const [newClassInput, setNewClassInput] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['0', '1', '2', '3', '0.0', '1.0']));
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'layer';
    idOrPath: string;
  }>({ visible: false, x: 0, y: 0, type: 'layer', idOrPath: '' });

  const handleContextMenu = (e: React.MouseEvent, type: 'layer', idOrPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      idOrPath
    });
  };

  const closeContextMenu = () => {
    if (contextMenu.visible) {
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };


  // Troca automática para estilos se um elemento for selecionado enquanto na aba layers se desejado
  useEffect(() => {
    if (selectedSelector && panelTab === 'layers' && !selectedPath) {
      setPanelTab('styles');
    }
  }, [selectedSelector]);

  const toggleExpanded = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const isDescendant = (parentPath: string, childPath: string) => {
    return childPath === parentPath || childPath.startsWith(parentPath + '.');
  };

  const renderLayers = (nodes: ElementNode[], depth = 0, parentPath = ''): React.ReactNode[] => {
    return nodes.map((node, index) => {
      const path = parentPath ? `${parentPath}.${index}` : `${index}`;
      const className = typeof node.className === 'string' ? node.className : '';
      const cleanClass = className ? className.split(' ').filter(c => !c.startsWith('studio-'))[0] : '';
      const { icon, name } = getTagDetails(node.tag);
      const selector = node.tag + (cleanClass ? '.' + cleanClass : '');
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedPaths.has(path);
      const isSelected = selectedPath === path;
      const isDragOver = dragOver === path;
      const isLockedRoot = path === '0' || path === '1' || path === '2';

      return (
        <div key={path} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected} className="relative">
          {isDragOver && dragOverPosition === 'before' && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500 rounded-full z-10 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}

          <div
            className={`group relative flex items-center justify-between gap-2 rounded-lg text-xs transition-all duration-100 cursor-pointer select-none ${
              isSelected
                ? 'bg-purple-600/35 text-white border border-purple-500/60 shadow-sm font-semibold'
                : isDragOver && dragOverPosition === 'inside'
                ? 'bg-indigo-600/30 border-2 border-indigo-400 text-indigo-200'
                : 'hover:bg-slate-900/90 text-slate-300 hover:text-white border border-transparent'
            }`}
            style={{ 
              paddingLeft: `${Math.max(6, depth * 14 + 6)}px`, 
              paddingRight: '8px', 
              paddingTop: '6px', 
              paddingBottom: '6px' 
            }}
            onClick={() => onSelectLayer && onSelectLayer(selector, path)}
            onContextMenu={(e) => isLockedRoot ? null : handleContextMenu(e, 'layer', path)}
            onMouseEnter={() => onHoverLayer && onHoverLayer(path)}
            onMouseLeave={() => onHoverLayer && onHoverLayer(null)}
            draggable={!isLockedRoot}
            onDragStart={(e) => {
              if (isLockedRoot) {
                e.preventDefault();
                return;
              }
              e.stopPropagation();
              setDragSource(path);
              e.dataTransfer.setData('text/plain', `layer:${path}`);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragSource && dragSource !== path && !isDescendant(dragSource, path)) {
                setDragOver(path);
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                if (isLockedRoot) {
                  setDragOverPosition('inside');
                } else if (offsetY < rect.height * 0.25) {
                  setDragOverPosition('before');
                } else if (offsetY > rect.height * 0.75) {
                  setDragOverPosition('after');
                } else {
                  setDragOverPosition('inside');
                }
              }
            }}
            onDragLeave={() => {
              setDragOver(null);
              setDragOverPosition(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              let pos = dragOverPosition || 'inside';
              if (isLockedRoot) {
                pos = 'inside';
              }
              setDragOver(null);
              setDragOverPosition(null);

              const templateHtml = e.dataTransfer.getData('application/x-template-html');
              const templateCss = e.dataTransfer.getData('application/x-template-css');

              if (templateHtml && onInsertBlock) {
                onInsertBlock(templateHtml, templateCss || undefined, path, pos);
                return;
              }

              if (dragSource && dragSource !== path && !isDescendant(dragSource, path)) {
                if (onMoveElement) onMoveElement(dragSource, path, pos);
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {!isLockedRoot && (
                <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-slate-400 cursor-grab shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
              )}
              
              {hasChildren ? (
                <button
                  onClick={(e) => toggleExpanded(path, e)}
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white shrink-0"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              ) : (
                <span className="w-3.5 h-3.5 shrink-0 inline-block" />
              )}

              {icon}

              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-sans text-xs text-white font-medium truncate">{name}</span>
                {path === '0' && (
                  <span className="text-[8px] font-bold text-pink-400 bg-pink-950/40 border border-pink-500/25 px-1 py-0.2 rounded uppercase shrink-0">
                    Header
                  </span>
                )}
                {path === '2' && (
                  <span className="text-[8px] font-bold text-rose-400 bg-rose-950/40 border border-rose-500/25 px-1 py-0.2 rounded uppercase shrink-0">
                    Footer
                  </span>
                )}
                {node.id && (
                  <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0">
                    #{node.id}
                  </span>
                )}
                {cleanClass && !node.id && (
                  <span className="text-[10px] text-purple-400/90 font-mono truncate max-w-[80px] shrink-0">
                    .{cleanClass}
                  </span>
                )}
                {node.text && (
                  <span className="text-[10px] text-slate-500 font-normal italic truncate max-w-[80px] shrink-0">
                    "{node.text}"
                  </span>
                )}
              </div>
            </div>

            {!isLockedRoot && (
              <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-mono shrink-0">
                Menu
              </span>
            )}
          </div>

          {isDragOver && dragOverPosition === 'after' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 rounded-full z-10 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}

          {hasChildren && isExpanded && (
            <div role="group" className="border-l border-slate-800/80 ml-3 pl-0.5">
              {renderLayers(node.children!, depth + 1, path)}
            </div>
          )}
        </div>
      );
    });
  };

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
    <aside className="w-80 border-l border-slate-900 bg-[var(--bg-app)] flex flex-col h-full shrink-0 select-none shadow-2xl z-20" onClick={closeContextMenu}>
      {/* Panel Top Tabs: Árvore DOM unificada com Estilos, Atributos e SEO */}
      <div className="flex border-b border-slate-900 bg-slate-950/80 p-1 gap-1">
        <button
          onClick={() => setPanelTab('layers')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
            panelTab === 'layers'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Árvore de Blocos DOM"
        >
          <Layers className="w-3 h-3" />
          Árvore
        </button>
        <button
          onClick={() => setPanelTab('styles')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
            panelTab === 'styles'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Estilos CSS"
        >
          <Palette className="w-3 h-3" />
          Estilos
        </button>
        <button
          onClick={() => setPanelTab('attrs')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
            panelTab === 'attrs'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Atributos & Conteúdo"
        >
          <Code className="w-3 h-3" />
          Atributos
        </button>
        <button
          onClick={() => setPanelTab('seo')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
            panelTab === 'seo'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm font-bold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title="SEO da Página"
        >
          <Globe className="w-3 h-3" />
          SEO
        </button>
      </div>

      {panelTab === 'layers' ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-2.5 border-b border-slate-900 bg-slate-950/40 flex items-center justify-between text-[11px] text-slate-500 px-3">
            <span className="font-bold text-slate-400">Árvore de Blocos DOM</span>
            <div className="flex items-center gap-2 text-[10px]">
              <button onClick={() => setExpandedPaths(new Set(['0', '1', '2', '3', '0.0', '1.0']))} className="hover:text-purple-300 transition-colors">Expandir</button>
              <span>•</span>
              <button onClick={() => setExpandedPaths(new Set())} className="hover:text-purple-300 transition-colors">Recolher</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-0">
            {layers.length > 0 ? (
              renderLayers(layers)
            ) : (
              <p className="text-[10px] text-slate-600 italic p-4 text-center">Nenhum elemento no canvas.</p>
            )}
          </div>
        </div>
      ) : panelTab === 'seo' ? (
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

          {/* Edição de Texto / Conteúdo do Elemento (Apenas para elementos textuais reais) */}
          {(selectedAttrs['_isTextEditable'] === 'true' || ['p','h1','h2','h3','h4','h5','h6','span','a','button','li','label','b','strong','em','small','blockquote'].includes(tag)) && (
            <div>
              <Label>Texto / Conteúdo</Label>
              <textarea
                rows={3}
                placeholder="Digite o texto deste elemento..."
                value={selectedAttrs['_textContent'] || ''}
                onChange={e => onAttrChange('_textContent', e.target.value)}
                className={`${inputCls} resize-none`}
              />
              <span className="text-[9px] text-slate-500 block mt-1">Dica: 2 cliques no canvas ativam a digitação direta inline.</span>
            </div>
          )}

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
    
      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-slate-900 border border-slate-700 shadow-xl rounded-md w-48 py-1 overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (onDuplicateElement) onDuplicateElement(contextMenu.idOrPath);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5" /> Duplicar Elemento
          </button>
          <button
            onClick={() => {
              if (onDeleteElement) onDeleteElement(contextMenu.idOrPath);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir Elemento
          </button>
        </div>
      )}

    </aside>
  );
};
