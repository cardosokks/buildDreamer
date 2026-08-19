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
  ChevronRight
} from 'lucide-react';

interface ElementNode {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  children?: ElementNode[];
}

interface SidebarProps {
  pages: { id: string; name: string; slug: string; isHomepage: boolean }[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onDuplicatePage: (id: string) => void;
  onDeletePage: (id: string) => void;
  layers: ElementNode[];
  onSelectLayer: (selector: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onCreatePage,
  onDuplicatePage,
  onDeletePage,
  layers,
  onSelectLayer
}) => {
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [layersCollapsed, setLayersCollapsed] = useState(false);

  const renderLayers = (nodes: ElementNode[], depth = 0) => {
    return nodes.map((node, index) => {
      const label = `${node.tag}${node.className ? '.' + node.className.split(' ')[0] : ''}`;
      const selector = node.tag + (node.className ? '.' + node.className.split(' ').join('.') : '');
      
      return (
        <div key={index} className="space-y-1">
          <button
            onClick={() => onSelectLayer(selector)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-900 rounded-lg text-left text-xs text-slate-350 transition-colors group cursor-pointer"
            style={{ paddingLeft: `${Math.max(12, depth * 12)}px` }}
          >
            {node.tag === 'div' || node.tag === 'section' ? (
              <Layout className="w-3.5 h-3.5 text-purple-400" />
            ) : node.tag === 'p' || node.tag === 'h1' || node.tag === 'h2' || node.tag === 'span' ? (
              <Type className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="truncate">{label}</span>
          </button>
          {node.children && node.children.length > 0 && renderLayers(node.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <aside className="w-64 border-r border-slate-900 bg-slate-950 flex flex-col h-full shrink-0">
      
      {/* Pages Section */}
      <div className="border-b border-slate-900 flex flex-col min-h-0">
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={() => setPagesCollapsed(!pagesCollapsed)}
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
          >
            {pagesCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <FileText className="w-4 h-4" />
            Páginas
          </button>
          <button
            onClick={onCreatePage}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Nova página"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {!pagesCollapsed && (
          <div className="px-4 pb-4 space-y-1 max-h-48 overflow-y-auto min-h-0">
            {pages.map(page => (
              <div 
                key={page.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all group ${page.id === activePageId ? 'bg-purple-600/10 border border-purple-500/20 text-purple-300' : 'hover:bg-slate-900 border border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <button
                  onClick={() => onSelectPage(page.id)}
                  className="flex items-center gap-2 truncate text-left w-full cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 shrink-0" />
                  <span className="truncate font-medium">{page.name}</span>
                  {page.isHomepage && <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono">HOME</span>}
                </button>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                  <button
                    onClick={() => onDuplicatePage(page.id)}
                    className="p-1 hover:text-purple-400 rounded transition-colors cursor-pointer"
                    title="Duplicar página"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {!page.isHomepage && (
                    <button
                      onClick={() => onDeletePage(page.id)}
                      className="p-1 hover:text-red-400 rounded transition-colors cursor-pointer"
                      title="Deletar página"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
        <div className="p-4 flex items-center justify-between">
          <button 
            onClick={() => setLayersCollapsed(!layersCollapsed)}
            className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
          >
            {layersCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <MousePointer className="w-4 h-4" />
            Layers / Estrutura
          </button>
        </div>

        {!layersCollapsed && (
          <div className="flex-1 overflow-y-auto space-y-1 px-4 pb-4 min-h-0">
            {layers.length > 0 ? renderLayers(layers) : (
              <p className="text-xs text-slate-500 italic p-2">Nenhum elemento no canvas.</p>
            )}
          </div>
        )}
      </div>

    </aside>
  );
};
