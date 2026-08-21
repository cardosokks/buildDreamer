import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { Sidebar } from './Sidebar';
import type { ElementNode } from './Sidebar';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { CodeEditor } from './CodeEditor';
import { ChatPanel } from './ChatPanel';
import { 
  Sparkles, 
  Code2, 
  Eye, 
  ArrowLeft, 
  Download, 
  Smartphone, 
  Tablet, 
  Monitor,
  Undo2,
  Redo2,
  Sliders,
  History,
  RotateCcw,
  PanelLeftClose,
  PanelRightClose,
  MessageSquare,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';

interface Page {
  id: string;
  name: string;
  slug: string;
  html: string;
  css: string;
  js: string;
  seoTitle?: string;
  seoDescription?: string;
  isHomepage: boolean;
}

interface ProjectData {
  id: string;
  name: string;
  pages: Page[];
}

interface VisualBuilderProps {
  projectId: string;
  onBack: () => void;
}

interface HistoryState {
  html: string;
  css: string;
  js: string;
  timestamp: string;
  description: string;
}

export const VisualBuilder: React.FC<VisualBuilderProps> = ({ projectId, onBack }) => {
  const { token } = useAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [activePageId, setActivePageId] = useState<string>('');
  
  // Breakpoints & Viewports
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [zoom, setZoom] = useState<number>(100);

  // Selection & Tree State
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [hoverPath, setHoverPath] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<Record<string, string>>({});
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});

  // Layout Panels
  const [showSidebar, setShowSidebar] = useState(true);
  const [showStylesPanel, setShowStylesPanel] = useState(true);
  const [showChat, setShowChat] = useState(true);

  // Modais
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeExportTab, setActiveExportTab] = useState<'html' | 'css' | 'js'>('html');

  // History Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar projeto');
      const data = await res.json();
      setProject(data);
      if (data.pages && data.pages.length > 0 && !activePageId) {
        const home = data.pages.find((p: Page) => p.isHomepage) || data.pages[0];
        setActivePageId(home.id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const activePage = project?.pages.find(p => p.id === activePageId);

  // Push Snapshot to Undo Stack
  const pushHistorySnapshot = useCallback((description: string) => {
    if (!activePage) return;
    setUndoStack(prev => [
      ...prev.slice(-30),
      {
        html: activePage.html,
        css: activePage.css,
        js: activePage.js,
        timestamp: new Date().toLocaleTimeString(),
        description
      }
    ]);
    setRedoStack([]);
  }, [activePage]);

  // Handle Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !activePage) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [
      ...prev,
      {
        html: activePage.html,
        css: activePage.css,
        js: activePage.js,
        timestamp: new Date().toLocaleTimeString(),
        description: 'Undo State'
      }
    ]);

    setProject(prev => prev ? {
      ...prev,
      pages: prev.pages.map(p => p.id === activePage.id ? { ...p, html: last.html, css: last.css, js: last.js } : p)
    } : null);
  }, [undoStack, activePage]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !activePage) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [
      ...prev,
      {
        html: activePage.html,
        css: activePage.css,
        js: activePage.js,
        timestamp: new Date().toLocaleTimeString(),
        description: 'Redo State'
      }
    ]);

    setProject(prev => prev ? {
      ...prev,
      pages: prev.pages.map(p => p.id === activePage.id ? { ...p, html: next.html, css: next.css, js: next.js } : p)
    } : null);
  }, [redoStack, activePage]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Escape, Delete, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        setSelectedSelector(null);
        setSelectedPath(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput && selectedPath) {
        e.preventDefault();
        handleDeleteElement(selectedPath);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowExportModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedPath]);

  // Helpers to parse and serialize DOM trees safely
  const parseDocFromHtml = (htmlStr: string) => {
    const parser = new DOMParser();
    return parser.parseFromString(htmlStr || '', 'text/html');
  };

  const serializeBodyContent = (doc: Document) => {
    const canvasRoot = doc.getElementById('canvas-root');
    if (canvasRoot) return canvasRoot.innerHTML;
    return doc.body ? doc.body.innerHTML : '';
  };

  const getElementByPath = (root: Element, path: string): Element | null => {
    if (!path && path !== '0') return null;
    const parts = String(path).split('.').map(Number);
    let el: Element | null = root;
    for (const idx of parts) {
      if (!el || !el.children) return null;
      el = el.children.item(idx);
    }
    return el;
  };

  // Update Page Code with Database Sync
  const handleCodeChange = async (type: 'html' | 'css' | 'js', value: string) => {
    if (!activePage) return;
    pushHistorySnapshot(`Edição de ${type.toUpperCase()}`);

    const updatedPages = project?.pages.map(p => {
      if (p.id === activePage.id) return { ...p, [type]: value };
      return p;
    });
    setProject(prev => prev ? { ...prev, pages: updatedPages || [] } : null);

    try {
      await fetch(`${API_URL}/api/pages/${activePage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [type]: value })
      });
    } catch (e) {
      console.error("Erro ao sincronizar com banco:", e);
    }
  };

  // Inline content editable change handler
  const handleInlineTextChange = (path: string, newText: string) => {
    if (!activePage) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, path);
    if (el) {
      el.textContent = newText;
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  // Style change handler
  const handleStyleChange = (prop: string, value: string) => {
    if (!activePage || !selectedPath) return;
    setSelectedStyles(prev => ({ ...prev, [prop]: value }));

    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, selectedPath);
    if (el instanceof HTMLElement) {
      if (value) {
        el.style.setProperty(prop, value);
      } else {
        el.style.removeProperty(prop);
      }
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  // Attribute change handler
  const handleAttrChange = (attr: string, value: string) => {
    if (!activePage || !selectedPath) return;
    setSelectedAttrs(prev => ({ ...prev, [attr]: value }));

    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, selectedPath);
    if (el) {
      if (attr === '_tag') return;
      if (attr === '_textContent') {
        if (el.childElementCount <= 1) el.textContent = value;
      } else {
        el.setAttribute(attr, value);
      }
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  // Element Delete
  const handleDeleteElement = (path: string) => {
    if (!activePage) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, path);
    if (el && el.parentElement) {
      el.parentElement.removeChild(el);
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
      setSelectedPath(null);
      setSelectedSelector(null);
    }
  };

  // Element Duplicate
  const handleDuplicateElement = (path: string) => {
    if (!activePage) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, path);
    if (el && el.parentElement) {
      const clone = el.cloneNode(true) as Element;
      el.parentElement.insertBefore(clone, el.nextSibling);
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  // Element Reorder
  const handleMoveElement = (sourcePath: string, targetPath: string) => {
    if (!activePage || sourcePath === targetPath) return;
    if (targetPath.startsWith(sourcePath + '.')) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const srcEl = getElementByPath(root, sourcePath);
    const tgtEl = getElementByPath(root, targetPath);
    if (srcEl && tgtEl && srcEl.parentElement) {
      srcEl.parentElement.removeChild(srcEl);
      tgtEl.appendChild(srcEl);
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
      setSelectedPath(null);
      setSelectedSelector(null);
    }
  };

  // Insert ready block
  const handleInsertBlock = (htmlBlock: string, cssBlock?: string) => {
    if (!activePage) return;
    const currentHtml = activePage.html || '';
    const newHtml = currentHtml ? `${currentHtml}\n${htmlBlock}` : htmlBlock;
    const newCss = cssBlock ? `${activePage.css || ''}\n${cssBlock}` : activePage.css;
    handleCodeChange('html', newHtml);
    if (cssBlock) handleCodeChange('css', newCss);
  };

  // SEO updates
  const handlePageSeoChange = async (key: 'title' | 'description' | 'ogImage', value: string) => {
    if (!activePage) return;
    try {
      const updateData: any = {};
      if (key === 'title') updateData.seoTitle = value;
      if (key === 'description') updateData.seoDescription = value;

      await fetch(`${API_URL}/api/pages/${activePage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      setProject(prev => prev ? {
        ...prev,
        pages: prev.pages.map(p => p.id === activePage.id ? { ...p, [key === 'title' ? 'seoTitle' : 'seoDescription']: value } : p)
      } : null);
    } catch (e) {
      console.error("Erro ao salvar SEO:", e);
    }
  };

  // AI Copilot Change Application
  const handleApplyAIChanges = (newHtml: string, newCss: string, newJs: string) => {
    if (!activePage) return;
    pushHistorySnapshot("Alterações aplicadas pelo AI Copilot");
    setProject(prev => prev ? {
      ...prev,
      pages: prev.pages.map(p => p.id === activePage.id ? { ...p, html: newHtml, css: newCss, js: newJs } : p)
    } : null);

    fetch(`${API_URL}/api/pages/${activePage.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ html: newHtml, css: newCss, js: newJs })
    }).catch(console.error);
  };

  // Parse HTML into recursive DOM Layer tree
  const parseHtmlToLayers = (htmlString: string): ElementNode[] => {
    if (!htmlString) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      
      function nodeToElementNode(node: Element): ElementNode {
        const childNodes: ElementNode[] = [];
        for (let i = 0; i < node.children.length; i++) {
          childNodes.push(nodeToElementNode(node.children[i]));
        }
        
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || undefined,
          className: (typeof node.className === 'string' ? node.className : node.getAttribute('class')) || undefined,
          children: childNodes.length > 0 ? childNodes : undefined
        };
      }

      const canvasRoot = doc.getElementById('canvas-root');
      const rootElements = canvasRoot ? Array.from(canvasRoot.children) : Array.from(doc.body.children);
      return rootElements.map(nodeToElementNode);
    } catch (e) {
      console.error("Falha ao gerar árvore DOM:", e);
      return [];
    }
  };

  const layers = activePage ? parseHtmlToLayers(activePage.html) : [];

  const getFullHtmlDocument = () => {
    if (!activePage) return '';
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${activePage.seoTitle || activePage.name}</title>
  <meta name="description" content="${activePage.seoDescription || ''}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    h1,h2,h3,h4,h5,h6 { font-family: 'Outfit', sans-serif; }
    ${activePage.css || ''}
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${activePage.html || ''}
  <script>
    ${activePage.js || ''}
  </script>
</body>
</html>`;
  };

  const handleDownloadCode = () => {
    const content = getFullHtmlDocument();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePage?.slug || 'index'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen bg-[#07020d] flex flex-col font-sans text-slate-100 overflow-hidden select-none">
      
      {/* ─── Top Studio Navbar ─── */}
      <header className="h-14 border-b border-slate-900/80 bg-[#090410] flex items-center justify-between px-3 md:px-4 shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Voltar ao Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${showSidebar ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' : 'bg-slate-900 text-slate-500 hover:text-white'}`}
            title="Alternar Árvore DOM / Páginas"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-white tracking-wide text-xs sm:text-sm truncate">{project?.name || 'Studio'}</span>
            <span className="text-xs text-slate-600">/</span>
            <span className="text-xs text-purple-400 font-medium font-mono truncate">{activePage?.name}</span>
          </div>
        </div>

        {/* Viewports & Breakpoints Controller */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-900 rounded-xl">
            <button 
              onClick={() => setViewport('desktop')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewport === 'desktop' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Desktop
            </button>
            <button 
              onClick={() => setViewport('tablet')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewport === 'tablet' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <Tablet className="w-3.5 h-3.5" />
              Tablet
            </button>
            <button 
              onClick={() => setViewport('mobile')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${viewport === 'mobile' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Mobile (Android)
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-900 rounded-xl px-2 py-1">
            <button 
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-300 font-mono w-10 text-center">{zoom}%</span>
            <button 
              onClick={() => setZoom(z => Math.min(150, z + 10))}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Actions & Utilities */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950/80 border border-slate-900 rounded-xl p-1">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg cursor-pointer"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg cursor-pointer"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chat AI Toggle */}
          <button 
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${showChat ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            title="AI Copilot Studio"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Code View Modal */}
          <button 
            onClick={() => setShowCodeModal(true)}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Editor de Código"
          >
            <Code2 className="w-4 h-4" />
          </button>

          {/* Export Code Modal */}
          <button 
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>

          {/* Toggle Styles Panel */}
          <button 
            onClick={() => setShowStylesPanel(!showStylesPanel)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${showStylesPanel ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' : 'bg-slate-900 text-slate-500 hover:text-white'}`}
            title="Painel de Propriedades"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ─── Main Editor Workspace Layout ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar (Páginas + DOM Tree) */}
        {showSidebar && project && activePage && (
          <Sidebar
            pages={project.pages}
            activePageId={activePageId}
            onSelectPage={(id) => {
              setActivePageId(id);
              setSelectedSelector(null);
              setSelectedPath(null);
            }}
            onCreatePage={async () => {
              const name = prompt('Nome da nova página:');
              if (!name) return;
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              const res = await fetch(`${API_URL}/api/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, slug, projectId })
              });
              if (res.ok) {
                const newP = await res.json();
                setProject(prev => prev ? { ...prev, pages: [...prev.pages, newP] } : null);
                setActivePageId(newP.id);
              }
            }}
            onDuplicatePage={async (id) => {
              const pToDup = project.pages.find(p => p.id === id);
              if (!pToDup) return;
              const res = await fetch(`${API_URL}/api/pages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  name: `${pToDup.name} (Cópia)`,
                  slug: `${pToDup.slug}-copia`,
                  html: pToDup.html,
                  css: pToDup.css,
                  js: pToDup.js,
                  projectId
                })
              });
              if (res.ok) {
                const dup = await res.json();
                setProject(prev => prev ? { ...prev, pages: [...prev.pages, dup] } : null);
                setActivePageId(dup.id);
              }
            }}
            onDeletePage={async (id) => {
              if (!confirm('Deseja excluir esta página permanentemente?')) return;
              await fetch(`${API_URL}/api/pages/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              setProject(prev => prev ? { ...prev, pages: prev.pages.filter(p => p.id !== id) } : null);
              if (activePageId === id) {
                const remaining = project.pages.filter(p => p.id !== id);
                if (remaining.length > 0) setActivePageId(remaining[0].id);
              }
            }}
            layers={layers}
            onSelectLayer={(selector, path) => {
              setSelectedSelector(selector);
              setSelectedPath(path);
            }}
            onHoverLayer={(path) => setHoverPath(path)}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onMoveElement={handleMoveElement}
            onInsertBlock={handleInsertBlock}
            selectedPath={selectedPath}
          />
        )}

        {/* Central Interactive Sandbox Canvas */}
        <main className="flex-1 flex justify-center items-center overflow-auto bg-[#07020d] p-3 md:p-6 min-w-0">
          <div 
            className="transition-all duration-200 h-full flex items-center justify-center relative"
            style={{
              width: viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%',
              height: '100%'
            }}
          >
            {activePage && (
              <Canvas
                key={activePage.id}
                html={activePage.html}
                css={activePage.css}
                js={activePage.js}
                highlightPath={selectedPath}
                hoverPath={hoverPath}
                zoom={zoom}
                onElementSelect={(selector, styles, attrs, path) => {
                  setSelectedSelector(selector);
                  setSelectedStyles(styles);
                  setSelectedAttrs(attrs);
                  setSelectedPath(path);
                }}
                onInlineContentChange={handleInlineTextChange}
              />
            )}
          </div>
        </main>

        {/* Right Inspector & Properties Panel */}
        {showStylesPanel && (
          <PropertiesPanel
            selectedSelector={selectedSelector}
            selectedPath={selectedPath}
            selectedStyles={selectedStyles}
            selectedAttrs={selectedAttrs}
            onStyleChange={handleStyleChange}
            onAttrChange={handleAttrChange}
            pageSeo={{
              title: activePage?.seoTitle || activePage?.name || '',
              description: activePage?.seoDescription || '',
              ogImage: ''
            }}
            onPageSeoChange={handlePageSeoChange}
          />
        )}

        {/* AI Copilot Panel */}
        {showChat && activePage && (
          <ChatPanel
            pageId={activePage.id}
            onApplyChanges={handleApplyAIChanges}
            onUndo={handleUndo}
            canUndo={undoStack.length > 0}
          />
        )}
      </div>

      {/* ─── Modal de Código Fonte Completo ─── */}
      {showCodeModal && activePage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl h-[80vh] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-[#090410] border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm text-white">Editor de Código - {activePage.name}</span>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <CodeEditor
                key={activePage.id}
                html={activePage.html}
                css={activePage.css}
                js={activePage.js}
                onChange={handleCodeChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de Exportação & Download ─── */}
      {showExportModal && activePage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-[#090410] border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm text-white">Exportação de Código de Produção</span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex gap-2 border-b border-slate-900 pb-2">
                <button
                  onClick={() => setActiveExportTab('html')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeExportTab === 'html' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  HTML Completo
                </button>
                <button
                  onClick={() => setActiveExportTab('css')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeExportTab === 'css' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  CSS Customizado
                </button>
                <button
                  onClick={() => setActiveExportTab('js')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeExportTab === 'js' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  JavaScript
                </button>
              </div>

              <textarea
                readOnly
                rows={10}
                value={
                  activeExportTab === 'html' ? getFullHtmlDocument() :
                  activeExportTab === 'css' ? (activePage.css || '/* Nenhum CSS customizado */') :
                  (activePage.js || '// Nenhum script interativo')
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-300 focus:outline-none resize-none"
              />

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    const text = activeExportTab === 'html' ? getFullHtmlDocument() : activeExportTab === 'css' ? activePage.css : activePage.js;
                    navigator.clipboard.writeText(text);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                  {copiedCode ? 'Copiado!' : 'Copiar Código'}
                </button>

                <button
                  onClick={handleDownloadCode}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar index.html
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
