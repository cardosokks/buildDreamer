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

export interface CustomTemplate {
  id: string;
  title: string;
  category: string;
  html: string;
  css?: string;
  createdAt: number;
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
  onMoveElement: (sourcePath: string, targetPath: string, position?: 'before' | 'after' | 'inside') => void;
  onMoveElementDirection?: (path: string, direction: 'up' | 'down') => void;
  onInsertBlock?: (htmlBlock: string, cssBlock?: string, targetPath?: string, position?: 'before' | 'after' | 'inside') => void;
  onSaveSelectionAsTemplate?: (title: string, category: string) => void;
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
  onSaveSelectionAsTemplate,
  selectedPath,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'blocks'>('layers');
  const [pagesCollapsed, setPagesCollapsed] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['0', '1', '2', '3', '0.0', '0.1', '1.0']));
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Template Manager State
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('ALL');
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    title: '',
    category: 'Geral',
    html: '',
    css: ''
  });

  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('studio_custom_templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const loadTemplates = () => {
    try {
      const stored = localStorage.getItem('studio_custom_templates');
      setCustomTemplates(stored ? JSON.parse(stored) : []);
    } catch {}
  };

  const saveCustomTemplatesToStorage = (list: CustomTemplate[]) => {
    setCustomTemplates(list);
    try {
      localStorage.setItem('studio_custom_templates', JSON.stringify(list));
    } catch {}
  };

  const handleCreateCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateForm.title.trim() || !newTemplateForm.html.trim()) return;

    const newTemplate: CustomTemplate = {
      id: `tmpl-${Date.now()}`,
      title: newTemplateForm.title.trim(),
      category: newTemplateForm.category.trim() || 'Geral',
      html: newTemplateForm.html.trim(),
      css: newTemplateForm.css.trim() || undefined,
      createdAt: Date.now()
    };

    saveCustomTemplatesToStorage([newTemplate, ...customTemplates]);
    setNewTemplateForm({ title: '', category: 'Geral', html: '', css: '' });
    setShowNewTemplateModal(false);
  };

  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Deseja excluir este template personalizado?')) return;
    const updated = customTemplates.filter(t => t.id !== id);
    saveCustomTemplatesToStorage(updated);
  };

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

  // Context Menu State
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

  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | 'inside' | null>(null);

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
            onClick={() => onSelectLayer(selector, path)}
            onContextMenu={(e) => handleContextMenu(e, 'layer', path)}
            onMouseEnter={() => onHoverLayer && onHoverLayer(path)}
            onMouseLeave={() => onHoverLayer && onHoverLayer(null)}
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setDragSource(path);
              e.dataTransfer.setData('text/plain', `layer:${path}`);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragSource !== path) {
                setDragOver(path);
                const rect = e.currentTarget.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                if (offsetY < rect.height * 0.25) {
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
              const pos = dragOverPosition || 'inside';
              setDragOver(null);
              setDragOverPosition(null);

              const templateHtml = e.dataTransfer.getData('application/x-template-html');
              const templateCss = e.dataTransfer.getData('application/x-template-css');

              if (templateHtml && onInsertBlock) {
                onInsertBlock(templateHtml, templateCss || undefined, path, pos);
                return;
              }

              if (dragSource && dragSource !== path) {
                onMoveElement(dragSource, path, pos);
              }
            }}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 cursor-grab shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
              
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

              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-sans text-xs text-white font-medium truncate">{name}</span>
                {node.id && (
                  <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0">
                    #{node.id}
                  </span>
                )}
                {cleanClass && !node.id && (
                  <span className="text-[10px] text-purple-400/90 font-mono truncate max-w-[100px] shrink-0">
                    .{cleanClass}
                  </span>
                )}
              </div>
            </div>

            <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity font-mono shrink-0">
              Menu
            </span>
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

  const defaultTemplates: CustomTemplate[] = [
    {
      id: 'hero-modern',
      title: 'Hero Banner Neon Glow',
      category: 'Cabeçalho',
      html: `
<section class="hero-section" style="padding: 80px 20px; text-align: center; background: radial-gradient(circle at center, rgba(168,85,247,0.15) 0%, rgba(13,7,20,0.9) 100%); border-bottom: 1px solid rgba(168,85,247,0.2);">
  <div style="max-width: 900px; margin: 0 auto;">
    <span style="display: inline-block; padding: 6px 16px; background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.4); border-radius: 99px; color: #d8b4fe; font-size: 13px; font-weight: 600; margin-bottom: 20px;">
      ✨ NOVIDADE EXCLUSIVA
    </span>
    <h1 style="font-size: 42px; font-weight: 800; color: var(--text-primary); line-height: 1.2; margin-bottom: 20px; text-shadow: 0 0 20px rgba(168,85,247,0.3);">
      Transforme Ideias em Realidade Digital
    </h1>
    <p style="font-size: 17px; color: #94a3b8; line-height: 1.6; max-width: 650px; margin: 0 auto 32px auto;">
      Construa interfaces extraordinárias, rápidas e responsivas para computadores e dispositivos móveis com total precisão.
    </p>
    <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
      <a href="#contato" style="padding: 14px 32px; background: var(--accent-primary); color: var(--text-primary); text-decoration: none; border-radius: 12px; font-weight: 700; box-shadow: 0 0 20px rgba(147,51,234,0.4); transition: transform 0.2s;">
        Começar Agora
      </a>
      <a href="#saiba-mais" style="padding: 14px 32px; background: rgba(var(--bg-app-rgb),0.05); color: var(--text-primary); text-decoration: none; border-radius: 12px; font-weight: 600; border: 1px solid rgba(var(--text-primary-rgb),0.1);">
        Saiba Mais
      </a>
    </div>
  </div>
</section>
      `,
      createdAt: 1
    },
    {
      id: 'features-grid',
      title: 'Grid de Benefícios 3 Colunas',
      category: 'Seções',
      html: `
<section style="padding: 80px 20px; background: var(--bg-app); border-bottom: 1px solid rgba(255,255,255,0.05);">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 50px;">
      <h2 style="font-size: 32px; font-weight: 800; color: var(--text-primary); margin-bottom: 12px;">Nossos Diferenciais Exclusivos</h2>
      <p style="color: #94a3b8; font-size: 15px;">Desenvolvido com tecnologia de ponta para alavancar seus resultados.</p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
      <div style="padding: 30px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">⚡ Velocidade Extrema</h3>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">Carregamento ultrarrápido com código otimizado e arquitetura moderna.</p>
      </div>
      <div style="padding: 30px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">📱 100% Responsivo</h3>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">Adaptação impecável para celulares, tablets e telas de computador.</p>
      </div>
      <div style="padding: 30px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">🛡️ Segurança Blindada</h3>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">Proteção e confiabilidade garantidas em todas as etapas da navegação.</p>
      </div>
    </div>
  </div>
</section>
      `,
      createdAt: 2
    },
    {
      id: 'cta-conversion',
      title: 'Chamada de Conversão / CTA WhatsApp',
      category: 'Conversão',
      html: `
<section style="padding: 60px 20px; background: linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%); text-align: center; border-radius: 24px; margin: 40px 20px;">
  <h2 style="font-size: 30px; font-weight: 800; color: var(--text-primary); margin-bottom: 16px;">Pronto para transformar o seu negócio?</h2>
  <p style="color: #cbd5e1; font-size: 16px; max-width: 600px; margin: 0 auto 28px auto;">Fale agora com nossa equipe de especialistas e receba uma proposta personalizada sem compromisso.</p>
  <a href="https://wa.me/5511999999999" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 14px 32px; background: var(--accent-primary); color: var(--text-primary); text-decoration: none; border-radius: 12px; font-weight: 700; box-shadow: 0 0 25px rgba(34,197,94,0.4);">
    <span>💬 Chamar no WhatsApp</span>
  </a>
</section>
      `,
      createdAt: 3
    }
  ];

  const allTemplates = [...customTemplates, ...defaultTemplates];
  const categories = ['ALL', ...Array.from(new Set(allTemplates.map(t => t.category)))];
  const filteredTemplates = allTemplates.filter(t => templateCategoryFilter === 'ALL' || t.category === templateCategoryFilter);

  return (
    <aside 
      className="w-80 border-l border-slate-900 bg-[var(--bg-app)] flex flex-col h-full shrink-0 select-none shadow-2xl z-20"
      onClick={closeContextMenu}
    >
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
                      className="p-0.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onSelectPage(page.id)}
                      className="flex items-center gap-2 truncate flex-1 text-left cursor-pointer"
                    >
                      {page.isHomepage ? (
                        <Home className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      ) : (
                        <Square className="w-3 h-3 text-slate-500 shrink-0" />
                      )}
                      <span className="truncate">{page.name}</span>
                    </button>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startRenamePage(page.id, page.name)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="Renomear Página"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDuplicatePage(page.id)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="Duplicar Página"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {!page.isHomepage && (
                        <button
                          onClick={() => onDeletePage(page.id)}
                          className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition-colors"
                          title="Excluir Página"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção de Templates Arrastáveis e Cadastro */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-2.5 border-b border-slate-900 bg-slate-950/40 space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => setShowNewTemplateModal(true)}
              className="flex-1 py-1.5 px-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-[11px] font-bold shadow transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Template</span>
            </button>
            <button
              type="button"
              onClick={loadTemplates}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
              title="Atualizar lista de templates"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            {selectedPath && onSaveSelectionAsTemplate && (
              <button
                type="button"
                onClick={() => {
                  const name = prompt('Nome do Template para o bloco selecionado:');
                  if (!name) return;
                  const cat = prompt('Categoria (ex: Cabeçalho, Seções, Conversão):', 'Personalizados') || 'Personalizados';
                  onSaveSelectionAsTemplate(name, cat);
                }}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-850 border border-purple-500/40 text-purple-300 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                title="Salvar o elemento selecionado no canvas como um novo template"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filtrar:</span>
            <select
              value={templateCategoryFilter}
              onChange={(e) => setTemplateCategoryFilter(e.target.value)}
              className="bg-[var(--bg-app)] border-b border-slate-850 text-[10px] font-bold text-slate-400 uppercase tracking-wider rounded-md px-1.5 py-1 focus:outline-none focus:border-purple-500 cursor-pointer flex-1"
            >
              <option value="ALL">Todas as Categorias ({allTemplates.length})</option>
              {categories.filter(c => c !== 'ALL').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block px-1">
            Biblioteca de Blocos & Templates:
          </span>
          {filteredTemplates.map((block) => (
            <div
              key={block.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', `template:${block.id}`);
                e.dataTransfer.setData('application/x-template-html', block.html);
                e.dataTransfer.setData('application/x-template-css', block.css || '');
                e.dataTransfer.effectAllowed = 'copyMove';
              }}
              onClick={() => onInsertBlock && onInsertBlock(block.html, block.css)}
              className="bg-[#110c1e] hover:bg-[#19122c] border border-slate-850 hover:border-purple-500/60 rounded-xl transition-all group cursor-grab active:cursor-grabbing shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] overflow-hidden"
            >
              {/* Preview Area */}
              <div className="h-20 bg-slate-900 border-b border-slate-800 p-2 overflow-hidden relative">
                 <div className="opacity-50 transform scale-[0.4] origin-top-left w-[250%] h-[250%] pointer-events-none" dangerouslySetInnerHTML={{ __html: block.html }} />
              </div>

              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 truncate">
                    <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 shrink-0" />
                    <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                      {block.title}
                    </span>
                  </div>
                  
                  {customTemplates.some(ct => ct.id === block.id) && (
                    <button
                      onClick={(e) => handleDeleteCustomTemplate(block.id, e)}
                      className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-slate-900 transition-colors"
                      title="Excluir Template"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="bg-purple-950/60 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-mono">
                    {block.category}
                  </span>
                  <span className="text-slate-500 group-hover:text-purple-400 transition-colors flex items-center gap-1 font-semibold">
                    <Plus className="w-3 h-3" />
                    Inserir
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNewTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-[var(--bg-app)] border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Component className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Cadastrar Novo Template / Bloco</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewTemplateModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomTemplate} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Nome do Template *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Tabela de Preços 3 Planos"
                    value={newTemplateForm.title}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Preços, Depoimentos, Hero"
                    value={newTemplateForm.category}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Código HTML do Bloco *
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder="<section class='minha-secao'> ... </section>"
                  value={newTemplateForm.html}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, html: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  CSS Customizado (Opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="/* CSS adicional exclusivo deste template */"
                  value={newTemplateForm.css}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, css: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-850 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNewTemplateModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 cursor-pointer"
                >
                  Salvar Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              {onSaveSelectionAsTemplate && (
                <button
                  onClick={() => {
                    const name = prompt('Nome do Template para este bloco:');
                    if (name) {
                      const cat = prompt('Categoria:', 'Personalizados') || 'Personalizados';
                      onSaveSelectionAsTemplate(name, cat);
                    }
                    closeContextMenu();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-purple-300 hover:bg-purple-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  Salvar como Template
                </button>
              )}
              <button
                onClick={() => {
                  onDeleteElement(contextMenu.idOrPath);
                  closeContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Elemento (Del)
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
};
