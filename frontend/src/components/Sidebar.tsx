import React, { useState } from 'react';
import {
  Type,
  Square,
  Layout,
  MousePointer,
  Plus,
  Trash2,
  FileText,
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
  Boxes,
  MessageCircle,
  CreditCard,
  Eye,
  EyeOff,
  Edit2,
  Home
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
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  onSetHomepage?: (id: string) => void;
  layers: ElementNode[];
  onSelectLayer: (selector: string, path: string) => void;
  onHoverLayer?: (path: string | null) => void;
  onDeleteElement: (path: string) => void;
  onDuplicateElement: (path: string) => void;
  onMoveElement: (sourcePath: string, targetPath: string) => void;
  onInsertBlock?: (htmlBlock: string, cssBlock?: string) => void;
  selectedPath?: string | null;
}

function getTagIcon(tag: string) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (tag.toLowerCase()) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return <Type className={`${cls} text-yellow-400`} />;
    case 'p': case 'span': case 'label': case 'strong': case 'em':
      return <AlignLeft className={`${cls} text-blue-400`} />;
    case 'a':
      return <Link className={`${cls} text-cyan-400`} />;
    case 'img':
      return <Image className={`${cls} text-green-400`} />;
    case 'button': case 'input': case 'textarea': case 'select':
      return <FormInput className={`${cls} text-orange-400`} />;
    case 'ul': case 'ol': case 'li':
      return <List className={`${cls} text-slate-400`} />;
    case 'nav': case 'header': case 'footer':
      return <Navigation className={`${cls} text-pink-400`} />;
    case 'section': case 'article': case 'main': case 'aside':
      return <Layout className={`${cls} text-purple-400`} />;
    case 'div':
      return <Layers className={`${cls} text-indigo-400`} />;
    case 'video': case 'iframe':
      return <Video className={`${cls} text-rose-400`} />;
    default:
      return <Square className={`${cls} text-slate-500`} />;
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onCreatePage,
  onDuplicatePage,
  onDeletePage,
  onSetHomepage,
  layers,
  onSelectLayer,
  onHoverLayer,
  onDeleteElement,
  onDuplicateElement,
  onMoveElement,
  onInsertBlock,
  selectedPath,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'blocks'>('layers');
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['0', '1', '2', '0.0', '0.1']));
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Context Menu State (Botão Direito)
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'page' | 'layer';
    idOrPath: string;
    isHomepage?: boolean;
  }>({ visible: false, x: 0, y: 0, type: 'layer', idOrPath: '' });

  const handleContextMenu = (e: React.MouseEvent, type: 'page' | 'layer', idOrPath: string, isHomepage = false) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      idOrPath,
      isHomepage
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

  const renderLayers = (nodes: ElementNode[], depth = 0, parentPath = '') => {
    return nodes.map((node, index) => {
      const path = parentPath ? `${parentPath}.${index}` : `${index}`;
      const className = typeof node.className === 'string' ? node.className : '';
      const cleanClass = className ? className.split(' ').filter(c => !c.startsWith('studio-'))[0] : '';
      const label = `${node.tag}${cleanClass ? '.' + cleanClass : ''}${node.id ? '#' + node.id : ''}`;
      const selector = node.tag + (cleanClass ? '.' + cleanClass : '');
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedPaths.has(path);
      const isSelected = selectedPath === path;
      const isDragOver = dragOver === path;

      return (
        <div key={path} role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
          <div
            className={`group flex items-center justify-between gap-1 rounded-lg text-xs transition-all duration-100 cursor-pointer ${
              isSelected
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-sm'
                : isDragOver
                ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-200'
                : 'hover:bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            style={{ paddingLeft: `${depth * 12 + 6}px`, paddingRight: '6px', paddingTop: '4px', paddingBottom: '4px' }}
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
            <div className="flex items-center gap-1.5 min-w-0">
              {hasChildren ? (
                <button
                  onClick={(e) => toggleExpanded(path, e)}
                  className="p-0.5 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              ) : (
                <span className="w-3 h-3 inline-block" />
              )}
              {getTagIcon(node.tag)}
              <span className="truncate font-mono text-[11px]">{label}</span>
            </div>

            {/* Ações rápidas discretas */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              <button
                onClick={(e) => handleContextMenu(e, 'layer', path)}
                className="p-1 hover:text-white rounded transition-colors text-slate-500"
                title="Mais opções (Botão direito)"
              >
                <MoreVertical className="w-3 h-3" />
              </button>
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div role="group">
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
</section>`
    },
    {
      id: 'features-grid',
      title: 'Grade de Recursos / Serviços',
      category: 'Conteúdo',
      icon: <Boxes className="w-4 h-4 text-cyan-400" />,
      html: `
<section style="padding: 70px 20px; max-width: 1100px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 50px;">
    <h2 style="font-size: 32px; font-weight: 700; color: #ffffff; margin-bottom: 12px;">Nossos Diferenciais</h2>
    <p style="color: #94a3b8; font-size: 15px;">Soluções sob medida para acelerar seu negócio.</p>
  </div>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; transition: transform 0.2s;">
      <div style="width: 44px; height: 44px; background: rgba(168,85,247,0.2); border: 1px solid rgba(168,85,247,0.4); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #c084fc; margin-bottom: 16px; font-size: 20px;">⚡</div>
      <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Alta Performance</h3>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">Sites otimizados com pontuação máxima no Google PageSpeed.</p>
    </div>
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; transition: transform 0.2s;">
      <div style="width: 44px; height: 44px; background: rgba(6,182,212,0.2); border: 1px solid rgba(6,182,212,0.4); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #22d3ee; margin-bottom: 16px; font-size: 20px;">📱</div>
      <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 8px;">100% Responsivo</h3>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">Perfeição visual garantida em celulares Android, iOS e computadores.</p>
    </div>
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; transition: transform 0.2s;">
      <div style="width: 44px; height: 44px; background: rgba(236,72,153,0.2); border: 1px solid rgba(236,72,153,0.4); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #f472b6; margin-bottom: 16px; font-size: 20px;">🛡️</div>
      <h3 style="color: #ffffff; font-size: 18px; font-weight: 600; margin-bottom: 8px;">Segurança & SEO</h3>
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">Estrutura semântica configurada para ranquear no topo do Google.</p>
    </div>
  </div>
</section>`
    },
    {
      id: 'cta-banner',
      title: 'Chamada para Ação (CTA)',
      category: 'Conversão',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
      html: `
<section style="padding: 60px 20px; max-width: 900px; margin: 40px auto; background: linear-gradient(135deg, #7e22ce 0%, #3b82f6 100%); border-radius: 24px; text-align: center; box-shadow: 0 10px 40px rgba(126,34,206,0.3);">
  <h2 style="font-size: 32px; font-weight: 800; color: #ffffff; margin-bottom: 12px;">Pronto para Elevar Seu Negócio?</h2>
  <p style="color: #e2e8f0; font-size: 16px; max-width: 550px; margin: 0 auto 28px auto;">Entre em contato hoje mesmo e solicite uma demonstração exclusiva.</p>
  <a href="https://wa.me/5500000000000" target="_blank" style="display: inline-block; padding: 14px 36px; background: #ffffff; color: #7e22ce; font-weight: 800; text-decoration: none; border-radius: 12px; font-size: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
    Falar no WhatsApp
  </a>
</section>`
    },
    {
      id: 'footer-clean',
      title: 'Rodapé Completo',
      category: 'Rodapé',
      icon: <Layout className="w-4 h-4 text-slate-400" />,
      html: `
<footer style="padding: 40px 20px; background: #030007; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; color: #64748b; font-size: 13px;">
  <p style="margin-bottom: 8px; color: #cbd5e1;">© 2026 Minha Empresa. Todos os direitos reservados.</p>
  <p>Desenvolvido com excelência visual e alta tecnologia.</p>
</footer>`
    }
  ];

  return (
    <aside 
      className="w-64 border-r border-slate-900 bg-[#090410] flex flex-col h-full shrink-0 select-none relative"
      onClick={closeContextMenu}
    >
      {/* Pages Section */}
      <div className="border-b border-slate-900/80 flex flex-col min-h-0">
        <div className="px-3.5 py-3 flex items-center justify-between">
          <button
            onClick={() => setPagesCollapsed(!pagesCollapsed)}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-colors"
          >
            {pagesCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <FileText className="w-3.5 h-3.5" />
            Páginas ({pages.length})
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreatePage();
            }}
            className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm"
            title="Criar nova página no site"
          >
            <Plus className="w-3 h-3" />
            Nova
          </button>
        </div>

        {!pagesCollapsed && (
          <div className="px-2 pb-3 space-y-0.5 max-h-36 overflow-y-auto min-h-0">
            {pages.map(page => (
              <div
                key={page.id}
                onContextMenu={(e) => handleContextMenu(e, 'page', page.id, page.isHomepage)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all group ${
                  page.id === activePageId
                    ? 'bg-purple-600/20 border border-purple-500/30 text-purple-300'
                    : 'hover:bg-slate-900 border border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <button
                  onClick={() => onSelectPage(page.id)}
                  className="flex items-center gap-2 truncate text-left w-full cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium">{page.name}</span>
                  {page.isHomepage && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono">HOME</span>}
                </button>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                  <button
                    onClick={(e) => handleContextMenu(e, 'page', page.id, page.isHomepage)}
                    className="p-1 hover:text-white text-slate-500 rounded transition-colors cursor-pointer"
                    title="Menu de opções (Botão direito)"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Selector: Layers vs Ready Blocks */}
      <div className="flex border-b border-slate-900 bg-slate-950/60 p-1 gap-1">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'layers'
              ? 'bg-purple-600/25 text-purple-300 border border-purple-500/30 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MousePointer className="w-3 h-3" />
          DOM Tree
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
          Blocos Prontos
        </button>
      </div>

      {/* Main Body */}
      {activeTab === 'layers' ? (
        <div className="flex-1 flex flex-col min-h-0" role="tree">
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
            Clique para Adicionar à Página:
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

      {/* ─── Context Menu (Botão Direito) ─── */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-[#0f0b18] border border-purple-500/30 rounded-xl shadow-2xl py-1.5 w-44 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 150), left: Math.min(contextMenu.x, window.innerWidth - 180) }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'page' ? (
            <>
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
              <button
                onClick={() => {
                  onDuplicateElement(contextMenu.idOrPath);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicar (Ctrl+D)
              </button>
              <button
                onClick={() => {
                  onDeleteElement(contextMenu.idOrPath);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir (Del)
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
};
