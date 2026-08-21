import React, { useState } from 'react';
import {
  Type,
  Square,
  Layout,
  Plus,
  Trash2,
  Copy,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Image,
  Link,
  List,
  AlignLeft,
  Code,
  FormInput,
  Video,
  MoreVertical,
  Navigation,
  Layers,
  Sparkles,
  Component,
  ArrowUp,
  ArrowDown,
  Eye,
  CornerDownRight,
  Home,
  GripVertical,
  Edit2,
  Check,
  X
} from 'lucide-react';

export interface ElementNode {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  children?: ElementNode[];
  path?: string;
}

interface SidebarProps {
  pages: { id: string; name: string; slug: string; isHomepage: boolean }[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onRenamePage?: (id: string, newName: string) => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onSetHomepage?: (id: string) => void;
  layers: ElementNode[];
  onSelectLayer: (selector: string, path: string) => void;
  onHoverLayer?: (path: string | null) => void;
  onDeleteElement: (path: string) => void;
  onDuplicateElement: (path: string) => void;
  onMoveElement: (sourcePath: string, targetPath: string) => void;
  onMoveElementDirection?: (path: string, direction: 'up' | 'down') => void;
  onInsertBlock?: (htmlBlock: string, cssBlock?: string) => void;
  selectedPath?: string | null;
}

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

export const Sidebar: React.FC<SidebarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  onSetHomepage,
  layers,
  onSelectLayer,
  onHoverLayer,
  onDeleteElement,
  onDuplicateElement,
  onMoveElement,
  onMoveElementDirection,
  onInsertBlock,
  selectedPath,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'blocks'>('layers');
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['0', '1', '2', '3', '0.0', '0.1', '1.0']));
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Inline Page Renaming State
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');

  const startRenamePage = (id: string, currentName: string) => {
    setEditingPageId(id);
    setEditingPageName(currentName);
  };

  const submitRenamePage = (id: string) => {
    if (editingPageName.trim() && onRenamePage) {
      onRenamePage(id, editingPageName.trim());
    }
    setEditingPageId(null);
    setEditingPageName('');
  };

  // Context Menu State (WordPress Block Actions)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'page' | 'layer';
    idOrPath: string;
    isHomepage?: boolean;
    pageName?: string;
  }>({ visible: false, x: 0, y: 0, type: 'layer', idOrPath: '' });

  const handleContextMenu = (e: React.MouseEvent, type: 'page' | 'layer', idOrPath: string, isHomepage = false, pageName = '') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      idOrPath,
      isHomepage,
      pageName
    });
  };

  const closeContextMenu = () => {
    if (contextMenu.visible) {
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const toggleExpanded = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPaths(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    function collect(nodes: ElementNode[], parent = '') {
      nodes.forEach((n, idx) => {
        const p = parent ? `${parent}.${idx}` : `${idx}`;
        all.add(p);
        if (n.children) collect(n.children, p);
      });
    }
    collect(layers);
    setExpandedPaths(all);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  const renderLayers = (nodes: ElementNode[], depth = 0, parentPath = '') => {
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

      return (
        <div key={path} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
          <div
            className={`group relative flex items-center justify-between gap-1.5 rounded-lg text-xs transition-all duration-100 cursor-pointer select-none ${
              isSelected
                ? 'bg-purple-600/35 text-white border border-purple-500/60 shadow-sm font-semibold'
                : isDragOver
                ? 'bg-indigo-600/30 border-2 border-indigo-400 text-indigo-200'
                : 'hover:bg-slate-900/90 text-slate-300 hover:text-white border border-transparent'
            }`}
            style={{ 
              paddingLeft: `${Math.max(6, depth * 14 + 6)}px`, 
              paddingRight: '6px', 
              paddingTop: '5px', 
              paddingBottom: '5px' 
            }}
            onClick={() => onSelectLayer(selector, path)}
            onContextMenu={(e) => handleContextMenu(e, 'layer', path)}
            onMouseEnter={() => onHoverLayer && onHoverLayer(path)}
            onMouseLeave={() => onHoverLayer && onHoverLayer(null)}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setDragSource(path);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragSource !== path) setDragOver(path);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(null);
              if (dragSource && dragSource !== path) {
                onMoveElement(dragSource, path);
              }
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <GripVertical className="w-3 h-3 text-slate-600 group-hover:text-slate-400 cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {hasChildren ? (
                <button
                  onClick={(e) => toggleExpanded(path, e)}
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white shrink-0"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <span className="w-3.5 h-3.5 shrink-0 inline-block" />
              )}

              {icon}

              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate font-sans text-xs">{name}</span>
                {node.id && (
                  <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1 rounded border border-cyan-500/20">
                    #{node.id}
                  </span>
                )}
                {cleanClass && !node.id && (
                  <span className="text-[10px] text-purple-400 font-mono truncate opacity-70">
                    .{cleanClass.slice(0, 10)}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions (WordPress Gutenberg Style) */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              {onMoveElementDirection && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveElementDirection(path, 'up');
                    }}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400"
                    title="Mover para Cima"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveElementDirection(path, 'down');
                    }}
                    className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400"
                    title="Mover para Baixo"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateElement(path);
                }}
                className="p-1 hover:text-white rounded hover:bg-slate-800 text-slate-400"
                title="Duplicar Bloco (Ctrl+D)"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteElement(path);
                }}
                className="p-1 hover:text-red-400 rounded hover:bg-red-500/20 text-slate-400"
                title="Excluir Bloco (Delete)"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div role="group" className="border-l border-slate-800/80 ml-3 pl-0.5">
              {renderLayers(node.children!, depth + 1, path)}
            </div>
          )}
        </div>
      );
    });
  };

  const readyBlocks = [
    {
      id: 'hero-modern',
      title: 'Hero Banner Neon',
      category: 'Cabeçalho',
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      html: `
<section class="hero-section" style="padding: 80px 20px; text-align: center; background: radial-gradient(circle at center, rgba(168,85,247,0.15) 0%, rgba(13,7,20,0.9) 100%); border-bottom: 1px solid rgba(168,85,247,0.2);">
  <div style="max-width: 900px; margin: 0 auto;">
    <span style="display: inline-block; padding: 6px 16px; background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.4); border-radius: 99px; color: #d8b4fe; font-size: 13px; font-weight: 600; margin-bottom: 20px;">
      ✨ NOVIDADE EXCLUSIVA
    </span>
    <h1 style="font-size: 42px; font-weight: 800; color: #ffffff; line-height: 1.2; margin-bottom: 20px; text-shadow: 0 0 20px rgba(168,85,247,0.3);">
      Transforme Ideias em Realidade Digital
    </h1>
    <p style="font-size: 17px; color: #94a3b8; line-height: 1.6; max-width: 650px; margin: 0 auto 32px auto;">
      Construa interfaces extraordinárias, rápidas e responsivas para computadores e dispositivos móveis com total precisão.
    </p>
    <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
      <a href="#contato" style="padding: 14px 32px; background: #9333ea; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; box-shadow: 0 0 20px rgba(147,51,234,0.4); transition: transform 0.2s;">
        Começar Agora
      </a>
      <a href="#saiba-mais" style="padding: 14px 32px; background: rgba(255,255,255,0.05); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.1);">
        Saiba Mais
      </a>
    </div>
  </div>
</section>
      `
    },
    {
      id: 'features-grid',
      title: 'Grid de Benefícios / Serviços',
      category: 'Seções',
      icon: <Layout className="w-4 h-4 text-indigo-400" />,
      html: `
<section style="padding: 80px 20px; background: #090410; border-bottom: 1px solid rgba(255,255,255,0.05);">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 50px;">
      <h2 style="font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 12px;">Nossos Diferenciais Exclusivos</h2>
      <p style="color: #94a3b8; font-size: 15px;">Desenvolvido com tecnologia de ponta para alavancar seus resultados.</p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
      <div style="padding: 30px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">⚡ Velocidade Extrema</h3>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">Carregamento ultrarrápido com código otimizado e arquitetura moderna.</p>
      </div>
      <div style="padding: 30px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">📱 100% Responsivo</h3>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">Adaptação impecável para celulares, tablets e telas de computador.</p>
      </div>
      <div style="padding: 30px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 10px;">🛡️ Segurança Blindada</h3>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">Proteção e confiabilidade garantidas em todas as etapas da navegação.</p>
      </div>
    </div>
  </div>
</section>
      `
    }
  ];

  return (
    <aside 
      className="w-72 border-r border-slate-900 bg-[#090410] flex flex-col h-full shrink-0 select-none shadow-xl z-20"
      onClick={closeContextMenu}
    >
      {/* Pages Section */}
      <div className="border-b border-slate-900 flex flex-col">
        <div className="px-3.5 py-2.5 flex items-center justify-between">
          <button
            onClick={() => setPagesCollapsed(!pagesCollapsed)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white cursor-pointer"
          >
            {pagesCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Páginas ({pages.length})</span>
          </button>
          
          <button
            onClick={onCreatePage}
            className="p-1 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 rounded-md transition-colors cursor-pointer"
            title="Adicionar Nova Página"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {!pagesCollapsed && (
          <div className="px-2 pb-3 space-y-0.5 max-h-40 overflow-y-auto min-h-0">
            {pages.map(page => (
              <div
                key={page.id}
                onContextMenu={(e) => handleContextMenu(e, 'page', page.id, page.isHomepage, page.name)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all group ${
                  page.id === activePageId
                    ? 'bg-purple-600/20 border border-purple-500/30 text-purple-300 font-semibold'
                    : 'hover:bg-slate-900 border border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {editingPageId === page.id ? (
                  <div className="flex items-center gap-1.5 w-full" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingPageName}
                      onChange={(e) => setEditingPageName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRenamePage(page.id);
                        if (e.key === 'Escape') setEditingPageId(null);
                      }}
                      autoFocus
                      className="flex-1 bg-slate-950 border border-purple-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={() => submitRenamePage(page.id)}
                      className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      title="Confirmar nome"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditingPageId(null)}
                      className="p-0.5 text-slate-500 hover:text-white cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onSelectPage(page.id)}
                      className="flex items-center gap-2 truncate text-left w-full cursor-pointer min-w-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                      <span className="truncate">{page.name}</span>
                      {page.isHomepage && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono shrink-0">HOME</span>}
                    </button>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startRenamePage(page.id, page.name);
                        }}
                        className="p-1 hover:text-white text-slate-500 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        title="Renomear Página"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleContextMenu(e, 'page', page.id, page.isHomepage, page.name)}
                        className="p-1 hover:text-white text-slate-500 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        title="Opções da página"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Selector: DOM Tree vs Blocos Prontos */}
      <div className="flex border-b border-slate-900 bg-slate-950/60 p-1 gap-1">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'layers'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Layers className="w-3 h-3" />
          Árvore de Blocos (DOM)
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'blocks'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Component className="w-3 h-3" />
          Blocos
        </button>
      </div>

      {/* Main Body */}
      {activeTab === 'layers' ? (
        <div className="flex-1 flex flex-col min-h-0" role="tree">
          {/* Header da Árvore com Expand/Collapse rápido */}
          <div className="px-3 py-1.5 bg-slate-950/40 border-b border-slate-900 flex items-center justify-between text-[10px] text-slate-400">
            <span>Estrutura Hierárquica</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={expandAll}
                className="hover:text-purple-300 cursor-pointer"
                title="Expandir todos os nós"
              >
                Expandir
              </button>
              <span>•</span>
              <button 
                onClick={collapseAll}
                className="hover:text-purple-300 cursor-pointer"
                title="Recolher todos os nós"
              >
                Recolher
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2 min-h-0 space-y-0.5">
            {layers.length > 0 ? (
              renderLayers(layers)
            ) : (
              <p className="text-[10px] text-slate-600 italic p-3 text-center">Nenhum elemento no canvas.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block px-1">
            Clique para Inserir na Página:
          </span>
          {readyBlocks.map((block) => (
            <div
              key={block.id}
              onClick={() => onInsertBlock && onInsertBlock(block.html)}
              className="p-3 bg-slate-900/70 hover:bg-purple-950/40 border border-slate-850 hover:border-purple-500/50 rounded-xl transition-all group cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {block.icon}
                  <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                    {block.title}
                  </span>
                </div>
                <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </div>
              <span className="text-[10px] text-slate-500 font-medium">Categoria: {block.category}</span>
            </div>
          ))}
        </div>
      )}

      {/* Context Menu (Botão Direito Estilo WordPress Gutenberg) */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-[#0f0b18] border border-purple-500/30 rounded-xl shadow-2xl py-1.5 w-48 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'page' ? (
            <>
              <button
                onClick={() => {
                  startRenamePage(contextMenu.idOrPath, contextMenu.pageName || '');
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Renomear Página
              </button>
              <button
                onClick={() => {
                  onDuplicatePage(contextMenu.idOrPath);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicar Página
              </button>
              {onSetHomepage && !contextMenu.isHomepage && (
                <button
                  onClick={() => {
                    onSetHomepage(contextMenu.idOrPath);
                    closeContextMenu();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" />
                  Definir como Home
                </button>
              )}
              {!contextMenu.isHomepage && (
                <button
                  onClick={() => {
                    onDeletePage(contextMenu.idOrPath);
                    closeContextMenu();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Página
                </button>
              )}
            </>
          ) : (
            <>
              {onMoveElementDirection && (
                <>
                  <button
                    onClick={() => {
                      onMoveElementDirection(contextMenu.idOrPath, 'up');
                      closeContextMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Mover para Cima
                  </button>
                  <button
                    onClick={() => {
                      onMoveElementDirection(contextMenu.idOrPath, 'down');
                      closeContextMenu();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    Mover para Baixo
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  onDuplicateElement(contextMenu.idOrPath);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicar Bloco (Ctrl+D)
              </button>
              <button
                onClick={() => {
                  onDeleteElement(contextMenu.idOrPath);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Bloco (Delete)
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
};
