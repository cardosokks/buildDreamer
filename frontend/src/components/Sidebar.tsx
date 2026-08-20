import React, { useState, useRef } from 'react';
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
  WrapText,
  ArrowUp,
  ArrowDown,
  Navigation,
  Layers,
} from 'lucide-react';

interface ElementNode {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  children?: ElementNode[];
  // path is a dot-separated index path e.g. "0.1.2"
  path?: string;
}

interface SidebarProps {
  pages: { id: string; name: string; slug: string; isHomepage: boolean }[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  layers: ElementNode[];
  onSelectLayer: (selector: string, path: string) => void;
  onDeleteElement: (path: string) => void;
  onDuplicateElement: (path: string) => void;
  onMoveElement: (sourcePath: string, targetPath: string) => void;
  onWrapElement: (path: string) => void;
  selectedPath?: string | null;
}

function getTagIcon(tag: string) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (tag) {
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
    case 'video': case 'audio': case 'iframe':
      return <Video className={`${cls} text-rose-400`} />;
    case 'code': case 'pre': case 'script':
      return <Code className={`${cls} text-emerald-400`} />;
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
  layers,
  onSelectLayer,
  onDeleteElement,
  onDuplicateElement,
  onMoveElement,
  onWrapElement,
  selectedPath,
}) => {
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [layersCollapsed, setLayersCollapsed] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['0', '1', '2']));
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const renderLayers = (nodes: ElementNode[], depth = 0, parentPath = '') => {
    return nodes.map((node, index) => {
      const path = parentPath ? `${parentPath}.${index}` : `${index}`;
      const nodeWithPath = { ...node, path };
      const className = typeof node.className === 'string' ? node.className : '';
      const label = `${node.tag}${className ? '.' + className.split(' ')[0] : ''}${node.id ? '#' + node.id : ''}`;
      const selector = node.tag + (className ? '.' + className.split(' ').join('.') : '');
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedPaths.has(path);
      const isSelected = selectedPath === path;
      const isDragOver = dragOver === path;

      return (
        <div key={path}>
          <div
            className={`group flex items-center gap-1 rounded-lg text-xs transition-all duration-100 ${
              isSelected
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : isDragOver
                ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
                : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            style={{ paddingLeft: `${depth * 10 + 4}px`, paddingRight: '4px', paddingTop: '3px', paddingBottom: '3px' }}
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
              setDragSource(null);
            }}
          >
            {/* Expand/collapse chevron */}
            <button
              onClick={() => hasChildren && toggleExpanded(path)}
              className={`p-0.5 rounded shrink-0 ${hasChildren ? 'cursor-pointer hover:bg-slate-700' : 'opacity-0 pointer-events-none'}`}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-500" />
              )}
            </button>

            {/* Tag icon */}
            {getTagIcon(node.tag)}

            {/* Label */}
            <button
              className="flex-1 text-left truncate cursor-pointer py-0.5 font-mono text-[11px]"
              onClick={() => onSelectLayer(selector, path)}
            >
              {label}
            </button>

            {/* Action buttons (hover) */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpenPath(menuOpenPath === path ? null : path); }}
                className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors cursor-pointer"
                title="Mais ações"
              >
                <MoreVertical className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteElement(path); }}
                className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Deletar elemento"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Context Menu */}
          {menuOpenPath === path && (
            <div
              ref={menuRef}
              className="relative z-50"
              style={{ paddingLeft: `${depth * 10 + 24}px` }}
            >
              <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 text-xs w-44 mb-1">
                <button
                  onClick={() => { onDuplicateElement(path); setMenuOpenPath(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-400" /> Duplicar
                </button>
                <button
                  onClick={() => { onWrapElement(path); setMenuOpenPath(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
                >
                  <WrapText className="w-3.5 h-3.5 text-green-400" /> Wrap em &lt;div&gt;
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={() => { onDeleteElement(path); setMenuOpenPath(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 text-red-400 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </div>
            </div>
          )}

          {/* Children */}
          {hasChildren && isExpanded && (
            <div>
              {renderLayers(node.children!, depth + 1, path)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <aside className="w-60 border-r border-slate-900 bg-slate-950 flex flex-col h-full shrink-0 select-none">

      {/* Pages Section */}
      <div className="border-b border-slate-900 flex flex-col min-h-0">
        <div className="px-3 py-3 flex items-center justify-between">
          <button
            onClick={() => setPagesCollapsed(!pagesCollapsed)}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-colors"
          >
            {pagesCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <FileText className="w-3.5 h-3.5" />
            Páginas
          </button>
          <button
            onClick={onCreatePage}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Nova página"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {!pagesCollapsed && (
          <div className="px-2 pb-3 space-y-0.5 max-h-44 overflow-y-auto min-h-0">
            {pages.map(page => (
              <div
                key={page.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all group ${
                  page.id === activePageId
                    ? 'bg-purple-600/15 border border-purple-500/20 text-purple-300'
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
                    onClick={() => onDuplicatePage(page.id)}
                    className="p-1 hover:text-purple-400 rounded transition-colors cursor-pointer"
                    title="Duplicar página"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {!page.isHomepage && (
                    <button
                      onClick={() => onDeletePage(page.id)}
                      className="p-1 hover:text-red-400 rounded transition-colors cursor-pointer"
                      title="Deletar página"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layers Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-3 flex items-center justify-between border-b border-slate-900/50">
          <button
            onClick={() => setLayersCollapsed(!layersCollapsed)}
            className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition-colors"
          >
            {layersCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <MousePointer className="w-3.5 h-3.5" />
            Estrutura / Layers
          </button>
        </div>

        {!layersCollapsed && (
          <div
            className="flex-1 overflow-y-auto py-2 px-2 min-h-0 space-y-0.5"
            onClick={() => setMenuOpenPath(null)}
          >
            {layers.length > 0 ? (
              renderLayers(layers)
            ) : (
              <p className="text-[10px] text-slate-600 italic p-3 text-center">Nenhum elemento no canvas.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
