import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { Sidebar } from './Sidebar';
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
  Undo,
  Redo,
  Play,
  MessageSquare,
  ExternalLink,
  PanelLeftClose,
  PanelRightClose,
  Maximize2,
  Sliders,
  History,
  RotateCcw
} from 'lucide-react';

interface Page {
  id: string;
  name: string;
  slug: string;
  html: string;
  css: string;
  js: string;
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

export const VisualBuilder: React.FC<VisualBuilderProps> = ({ projectId, onBack }) => {
  const { token } = useAuth();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [activePageId, setActivePageId] = useState<string>('');
  
  // Viewport breakpoint state
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Element Selection State
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<Record<string, string>>({});
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});

  // Monaco Editor View Toggle
  const [viewMode, setViewMode] = useState<'split' | 'visual' | 'code'>('visual');

  // Chat panel toggle
  const [showChat, setShowChat] = useState(true);

  // Sidebar toggle state
  const [showSidebar, setShowSidebar] = useState(true);

  // Styles Panel toggle state
  const [showStylesPanel, setShowStylesPanel] = useState(true);

  // Code editor modal state
  const [showCodeModal, setShowCodeModal] = useState(false);

  // Navbar size switcher state ('compact' | 'normal' | 'large')
  const [navbarSize, setNavbarSize] = useState<'compact' | 'normal' | 'large'>('normal');

  // Background AI Job Status Polling
  const [jobStatus, setJobStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('completed');
  const [jobError, setJobError] = useState<string | null>(null);

  // History version state
  interface VersionSnapshot {
    timestamp: string;
    description: string;
    html: string;
    css: string;
    js: string;
  }
  const [versionHistory, setVersionHistory] = useState<Record<string, VersionSnapshot[]>>(() => {
    try {
      const stored = localStorage.getItem(`version_history_${projectId}`);
      const parsed = stored ? JSON.parse(stored) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    if (Object.keys(versionHistory).length > 0) {
      localStorage.setItem(`version_history_${projectId}`, JSON.stringify(versionHistory));
    }
  }, [versionHistory, projectId]);

  // Detect screen size on load/resize to automatically collapse sidebars on smaller resolutions
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowSidebar(false);
        setShowStylesPanel(false);
        setShowChat(false);
      }
    };
    handleResize(); // run initially
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    pages: true,
    css: true,
    js: true,
    docker: true,
    readme: true
  });

  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao buscar detalhes do projeto');
      const data = await res.json();
      setProject(data);
      if (data.pages && data.pages.length > 0) {
        const home = data.pages.find((p: Page) => p.isHomepage) || data.pages[0];
        setActivePageId(home.id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Poll status of AI Generation background job for this project
  useEffect(() => {
    let interval: any;
    const checkJobStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/projects/jobs/${projectId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data.status);
          if (data.status === 'completed') {
            clearInterval(interval);
            fetchProjectDetails(); // refresh details to load generated page code
          } else if (data.status === 'failed') {
            setJobError(data.error || 'Erro na geração de mockup da IA');
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to fetch job queue status:', err);
      }
    };

    checkJobStatus(); // run immediately
    interval = setInterval(checkJobStatus, 3000); // check status every 3 seconds

    return () => clearInterval(interval);
  }, [projectId, token]);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId, token]);

  const activePage = project?.pages.find(p => p.id === activePageId);

  // Initialize page version history snapshot if empty
  useEffect(() => {
    if (activePage && !versionHistory[activePage.id]) {
      const initialSnapshot: VersionSnapshot = {
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        description: 'Versão Inicial / Carga do Projeto',
        html: activePage.html,
        css: activePage.css,
        js: activePage.js
      };
      setVersionHistory(prev => ({
        ...prev,
        [activePage.id]: [initialSnapshot]
      }));
    }
  }, [activePageId, activePage]);

  const savePageCode = async (pageId: string, updates: Partial<Page>) => {
    try {
      const res = await fetch(`${API_URL}/api/pages/${pageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Erro ao salvar página no servidor');
      const updatedPage = await res.json();
      
      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          pages: prev.pages.map(p => p.id === pageId ? updatedPage : p)
        };
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Debounced API save implementation to prevent API overload on typing/sliders
  const [saveTimeout, setSaveTimeout] = useState<any>(null);

  const handleCodeChange = (type: 'html' | 'css' | 'js', value: string) => {
    if (!activePage) return;
    
    // 1. Instantly update local state to render in canvas
    setProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p => p.id === activePage.id ? { ...p, [type]: value } : p)
      };
    });

    // 2. Debounce persisting in database (1000ms delay)
    if (saveTimeout) clearTimeout(saveTimeout);
    const timeout = setTimeout(() => {
      savePageCode(activePage.id, { [type]: value });
    }, 1000);
    setSaveTimeout(timeout);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) clearTimeout(saveTimeout);
    };
  }, [saveTimeout]);

  const handleApplyAIChanges = (html: string, css: string, js: string, targetPageId?: string) => {
    const pageIdToUpdate = targetPageId || activePage?.id;
    if (!pageIdToUpdate) return;

    // Direct replacement of whole page code contexts (prevents buggy AST selectors parsing)
    setProject(prev => {
      if (!prev) return null;
      return {
        ...prev,
        pages: prev.pages.map(p => p.id === pageIdToUpdate ? { ...p, html, css, js } : p)
      };
    });

    // Record snapshot version in history log
    const newSnapshot: VersionSnapshot = {
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      description: 'Alteração gerada por IA / Chat',
      html,
      css,
      js
    };
    setVersionHistory(prev => {
      const pageHistory = prev[pageIdToUpdate] || [];
      return {
        ...prev,
        [pageIdToUpdate]: [newSnapshot, ...pageHistory]
      };
    });

    savePageCode(pageIdToUpdate, { html, css, js });
  };

  // Helper: get element by path index e.g. "0.1.2" in body children
  const getElementByPath = (root: Element, path: string): Element | null => {
    const parts = path.split('.').map(Number);
    let current: Element | null = root;
    for (const idx of parts) {
      if (!current) return null;
      const childNodes: Element[] = Array.from(current.children);
      current = childNodes[idx] ?? null;
    }
    return current;
  };

  const parseDocFromHtml = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc;
  };

  const serializeBodyContent = (doc: Document): string => {
    return doc.body.innerHTML;
  };

  const handleStyleChange = (property: string, value: string) => {
    if (!activePage || !selectedPath) return;

    // Update local state immediately
    setSelectedStyles(prev => ({ ...prev, [property]: value }));

    // Apply style to the real HTML via DOMParser
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, selectedPath);
    if (el && el instanceof HTMLElement) {
      const cssProp = property.replace(/-([a-z])/g, (_, l) => l.toUpperCase()) as any;
      el.style[cssProp] = value;
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  const handleAttrChange = (attr: string, value: string) => {
    if (!activePage || !selectedPath) return;
    setSelectedAttrs(prev => ({ ...prev, [attr]: value }));

    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, selectedPath);
    if (el) {
      if (attr === '_tag') return; // internal meta
      if (attr === '_textContent') {
        // Only update text content when element has no child elements
        if (el.childElementCount === 0) {
          el.textContent = value;
        }
      } else if (attr === '_hasChildren') {
        return; // read-only meta
      } else {
        el.setAttribute(attr, value);
      }
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  // Delete element by path
  const handleDeleteElement = (path: string) => {
    if (!activePage) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, path);
    if (el) {
      el.parentElement?.removeChild(el);
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
      if (selectedPath === path) { setSelectedSelector(null); setSelectedPath(null); }
    }
  };

  // Duplicate element by path
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

  // Move element: drag sourcePath into targetPath container
  const handleMoveElement = (sourcePath: string, targetPath: string) => {
    if (!activePage || sourcePath === targetPath) return;
    // Prevent moving into own descendant
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
      setSelectedPath(null); setSelectedSelector(null);
    }
  };

  // Wrap element in a new <div>
  const handleWrapElement = (path: string) => {
    if (!activePage) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, path);
    if (el && el.parentElement) {
      const wrapper = doc.createElement('div');
      el.parentElement.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  // Add child element to a tag in canvas root
  const handleAddChildElement = (parentPath: string, tag: string, text?: string) => {
    if (!activePage) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const parentEl = getElementByPath(root, parentPath);
    if (parentEl) {
      const newEl = doc.createElement(tag);
      if (text) {
        newEl.textContent = text;
      }
      // Apply some basic styling for visual visibility
      if (tag === 'div') {
        newEl.style.minHeight = '50px';
        newEl.style.padding = '10px';
        newEl.style.border = '1px dashed #4b5563'; // gray-600
      }
      parentEl.appendChild(newEl);
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  const handleCreatePage = async () => {
    const name = prompt('Nome da página:');
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, slug, title: name })
      });
      if (!res.ok) throw new Error('Erro ao criar página');
      const newPage = await res.json();
      setProject(prev => prev ? { ...prev, pages: [...prev.pages, newPage] } : null);
      setActivePageId(newPage.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDuplicatePage = (id: string) => {
    alert('Duplicação de páginas em breve!');
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm('Excluir esta página?')) return;
    try {
      const res = await fetch(`${API_URL}/api/pages/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Erro ao deletar página');
      setProject(prev => prev ? { ...prev, pages: prev.pages.filter(p => p.id !== id) } : null);
      if (activePageId === id) {
        const home = project?.pages.find(p => p.isHomepage);
        if (home) setActivePageId(home.id);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Dynamic HTML parsing function to generate the layer tree structure
  const parseHtmlToLayers = (htmlString: string): any[] => {
    if (!htmlString) return [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      
      const nodeToElementNode = (node: Element): any => {
        const children: any[] = [];
        Array.from(node.children).forEach(child => {
          children.push(nodeToElementNode(child));
        });
        
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || undefined,
          className: (typeof node.className === 'string' ? node.className : node.getAttribute('class')) || undefined,
          children: children.length > 0 ? children : undefined
        };
      };

      // Traverse all children inside body or canvas root
      const rootNode = doc.getElementById('canvas-root') || doc.body;
      const elements = Array.from(rootNode.children);
      
      // If rootNode is body and has canvas-root inside, traverse canvas-root children directly
      const canvasRoot = doc.getElementById('canvas-root');
      const targetElements = canvasRoot ? Array.from(canvasRoot.children) : elements;

      return targetElements.map(nodeToElementNode);
    } catch (e) {
      console.error("Failed to parse HTML to Layers tree:", e);
      return [];
    }
  };

  const layers = activePage ? parseHtmlToLayers(activePage.html) : [];

  return (
    <div className="h-full w-full bg-slate-950 flex flex-col font-sans text-slate-100 overflow-hidden relative">
      
      {/* Background AI mockup generation progress overlay status screen */}
      {(jobStatus === 'pending' || jobStatus === 'processing') && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/10 border-t-purple-500 animate-spin shadow-[0_0_15px_var(--neon-purple-glow)]" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent tracking-widest uppercase">
            Real Premise AI
          </h2>
          <p className="text-sm text-slate-400 mt-2 font-medium animate-pulse">
            {jobStatus === 'pending' ? 'Entrando na fila de geração...' : 'Escrevendo códigos (HTML/CSS) com Gemini...'}
          </p>
          <span className="text-[10px] text-slate-600 font-mono mt-8 border border-slate-900 rounded px-2.5 py-1 bg-slate-950/50">
            Esta etapa pode demorar de 10 a 20 segundos
          </span>
        </div>
      )}

      {jobStatus === 'failed' && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="p-4 bg-red-950/40 border border-red-500/30 text-red-400 rounded-full mb-6">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Erro de Geração</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            {jobError || 'Não foi possível completar a geração do site. Verifique sua chave do Gemini e tente novamente.'}
          </p>
          <div className="flex gap-4">
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-xs font-semibold text-slate-350 border border-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Voltar ao Dashboard
            </button>
            <button
              onClick={() => { setJobStatus('completed'); setJobError(null); fetchProjectDetails(); }}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-650 text-xs font-semibold text-white rounded-xl transition-all cursor-pointer"
            >
              Forçar Acesso ao Editor
            </button>
          </div>
        </div>
      )}
      
      {/* Top Navbar */}
      <header className={`border-b border-slate-900 bg-slate-950 flex items-center justify-between px-4 z-20 shrink-0 transition-all duration-200 ${
        navbarSize === 'compact' ? 'h-10 text-xs' : navbarSize === 'large' ? 'h-18' : 'h-14'
      }`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Voltar ao Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${showSidebar ? 'bg-purple-650 text-purple-400 hover:bg-slate-900' : 'bg-slate-900 text-slate-550 hover:text-white'}`}
            title="Alternar Painel Lateral"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>

          <span className="font-bold text-white tracking-wide">{project?.name || 'Carregando...'}</span>
          <span className="text-xs text-slate-500">/</span>
          <span className="text-xs text-slate-400 font-medium">{activePage?.name}</span>
        </div>

        {/* Navbar Size and Viewport Control wrapper */}
        <div className="flex items-center gap-4">
          {/* Navbar Size Control */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tamanho Barra:</span>
            <select
              value={navbarSize}
              onChange={(e) => setNavbarSize(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-350 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono cursor-pointer"
            >
              <option value="compact">Compacto</option>
              <option value="normal">Normal</option>
              <option value="large">Grande</option>
            </select>
          </div>

          {/* Viewport size switcher */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-850 rounded-xl">
          <button 
            onClick={() => setViewport('desktop')}
            className={`p-2 rounded-lg transition-all cursor-pointer ${viewport === 'desktop' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewport('tablet')}
            className={`p-2 rounded-lg transition-all cursor-pointer ${viewport === 'tablet' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewport('mobile')}
            className={`p-2 rounded-lg transition-all cursor-pointer ${viewport === 'mobile' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action controls */}
      <div className="flex items-center gap-2">
          {/* View Modes */}
          <button 
            onClick={() => {
              setViewMode('visual');
              setShowCodeModal(true);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-slate-900 text-slate-400 hover:text-white border border-slate-800`}
            title="Abrir Editor de Código em Modal Flutuante"
          >
            <Code2 className="w-3.5 h-3.5" />
            Código (Modal)
          </button>

          <button 
            onClick={() => setShowStylesPanel(!showStylesPanel)}
            className={`p-2 rounded-xl transition-all cursor-pointer mr-1 ${showStylesPanel ? 'bg-purple-650 text-purple-400 hover:bg-slate-900' : 'bg-slate-900 text-slate-550 hover:text-white'}`}
            title="Alternar Painel de Estilos"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setShowHistoryModal(true)}
            className={`p-2 rounded-xl transition-all cursor-pointer mr-1 bg-slate-900 text-slate-450 hover:text-white hover:bg-slate-850`}
            title="Histórico de Versões do Site"
          >
            <History className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-xl transition-all cursor-pointer mr-2 ${showChat ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            title="Chat com IA"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button 
            onClick={() => {
              if (!activePage) return;
              const fullHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>${activePage.name} - Preview</title>
                  <script src="https://cdn.tailwindcss.com"></script>
                  <style>${activePage.css}</style>
                </head>
                <body class="bg-slate-950 text-slate-100 min-h-screen">
                  ${activePage.html}
                  <script>${activePage.js}</script>
                </body>
                </html>
              `;
              const blob = new Blob([fullHtml], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white font-semibold text-xs text-slate-300 rounded-xl transition-all cursor-pointer mr-1"
            title="Visualizar em Nova Aba"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Visualizar
          </button>

          <button 
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 font-semibold text-xs text-white rounded-xl transition-all cursor-pointer"
            onClick={() => setShowExportModal(true)}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar
          </button>
        </div>
      </header>

      {/* Editor Body Area */}
      <div className="flex-1 flex overflow-hidden">
        {project && activePage ? (
          <>
            {/* Sidebar (Pages & Layers) */}
            {showSidebar && (
              <Sidebar
                pages={project.pages}
                activePageId={activePageId}
                onSelectPage={(id) => {
                  setActivePageId(id);
                  setSelectedSelector(null);
                  setSelectedPath(null);
                }}
                onCreatePage={handleCreatePage}
                onDuplicatePage={handleDuplicatePage}
                onDeletePage={handleDeletePage}
                layers={layers}
                onSelectLayer={(selector, path) => {
                  setSelectedSelector(selector);
                  setSelectedPath(path);
                  
                  // Extract element attributes and styles to populate PropertiesPanel
                  const doc = parseDocFromHtml(activePage.html);
                  const root = doc.getElementById('canvas-root') || doc.body;
                  const el = getElementByPath(root, path);
                  if (el) {
                    const attrs: Record<string, string> = {
                      _tag: el.tagName.toLowerCase(),
                      _textContent: el.childElementCount === 0 ? (el.textContent || '') : '',
                      _hasChildren: el.childElementCount > 0 ? 'true' : 'false'
                    };
                    for (let i = 0; i < el.attributes.length; i++) {
                      const attr = el.attributes[i];
                      attrs[attr.name] = attr.value;
                    }
                    setSelectedAttrs(attrs);

                    const styles: Record<string, string> = {};
                    if (el instanceof HTMLElement) {
                      for (let i = 0; i < el.style.length; i++) {
                        const styleName = el.style[i];
                        styles[styleName] = el.style.getPropertyValue(styleName);
                      }
                    }
                    setSelectedStyles(styles);
                  } else {
                    setSelectedAttrs({});
                    setSelectedStyles({});
                  }
                }}
                onDeleteElement={handleDeleteElement}
                onDuplicateElement={handleDuplicateElement}
                onMoveElement={handleMoveElement}
                onWrapElement={handleWrapElement}
                onAddChildElement={handleAddChildElement}
                selectedPath={selectedPath}
              />
            )}

            {/* Main Interactive Canvas Area */}
            <main className="flex-1 p-2 md:p-6 flex justify-center items-center overflow-auto bg-slate-950/20">
              <div 
                className="transition-all duration-300 max-w-full h-full flex items-center justify-center"
                style={{
                  width: viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%',
                  height: '100%'
                }}
              >
                <Canvas
                  key={activePage.id}
                  html={activePage.html}
                  css={activePage.css}
                  js={activePage.js}
                  highlightPath={selectedPath}
                  onElementSelect={(selector, styles, attrs, elementPath) => {
                    setSelectedSelector(selector);
                    setSelectedStyles(styles);
                    setSelectedAttrs(attrs || {});
                    // Use index-based path from canvas click
                    setSelectedPath(elementPath || null);
                  }}
                />
              </div>
            </main>

            {/* Properties Control Panel (Condicional) */}
            {showStylesPanel && (
              <PropertiesPanel
                selectedSelector={selectedSelector}
                selectedPath={selectedPath}
                selectedStyles={selectedStyles}
                selectedAttrs={selectedAttrs}
                onStyleChange={handleStyleChange}
                onAttrChange={handleAttrChange}
              />
            )}

            {/* Chat Panel AI */}
            {showChat && (
              <ChatPanel
                pageId={activePage.id}
                onApplyChanges={handleApplyAIChanges}
              />
            )}

            {/* Modal de Código Flutuante */}
            {showCodeModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
                <div className="w-full max-w-4xl h-[80vh] bg-slate-900 border border-slate-850 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-sm text-white">Editor de Código Manual - {activePage.name}</span>
                    </div>
                    <button
                      onClick={() => setShowCodeModal(false)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer font-medium"
                    >
                      Fechar
                    </button>
                  </div>

                  {/* Modal Editor Body */}
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
            {/* Modal de Histórico de Alterações */}
            {showHistoryModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
                <div className="w-full max-w-2xl h-[70vh] bg-slate-900 border border-slate-850 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Header */}
                  <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-sm text-white">Histórico de Alterações - {activePage.name}</span>
                    </div>
                    <button
                      onClick={() => setShowHistoryModal(false)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer font-medium"
                    >
                      Fechar
                    </button>
                  </div>

                  {/* Versions List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {(!versionHistory[activePage.id] || versionHistory[activePage.id].length === 0) ? (
                      <p className="text-xs text-slate-500 italic text-center py-10">Nenhum snapshot de alteração gravado ainda.</p>
                    ) : (
                      versionHistory[activePage.id].map((ver, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 bg-slate-950/60 border border-slate-850 hover:border-slate-800 rounded-xl flex items-center justify-between gap-4 transition-all"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded font-mono">{ver.timestamp}</span>
                              <span className="text-xs font-semibold text-white truncate">{ver.description}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 truncate">
                              HTML: {ver.html.slice(0, 45)}... | CSS: {ver.css.slice(0, 30)}...
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              if (confirm('Deseja reverter a página para esta versão anterior? As mudanças atuais serão substituídas.')) {
                                handleApplyAIChanges(ver.html, ver.css, ver.js, activePage.id);
                                setShowHistoryModal(false);
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs transition-colors cursor-pointer font-semibold shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Exportação Seletiva */}
            {showExportModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-sm text-white">Opções de Exportação</span>
                    </div>
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="text-slate-400 hover:text-white text-lg font-bold"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-400">Selecione quais diretórios e arquivos deseja incluir na sua exportação:</p>
                    
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-850 rounded-xl hover:border-slate-850 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.pages}
                          onChange={(e) => setExportOptions({ ...exportOptions, pages: e.target.checked })}
                          className="w-4 h-4 text-purple-600 bg-slate-900 border-slate-800 rounded focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-white">pages/</div>
                          <div className="text-[10px] text-slate-500">Arquivos HTML estruturados com conteúdo das páginas</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-850 rounded-xl hover:border-slate-850 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.css}
                          onChange={(e) => setExportOptions({ ...exportOptions, css: e.target.checked })}
                          className="w-4 h-4 text-purple-600 bg-slate-900 border-slate-800 rounded focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-white">css/</div>
                          <div className="text-[10px] text-slate-500">Folhas de estilo correspondentes para cada página</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-850 rounded-xl hover:border-slate-850 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.js}
                          onChange={(e) => setExportOptions({ ...exportOptions, js: e.target.checked })}
                          className="w-4 h-4 text-purple-600 bg-slate-900 border-slate-800 rounded focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-white">js/</div>
                          <div className="text-[10px] text-slate-500">Arquivos JavaScript com interatividades programadas</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-850 rounded-xl hover:border-slate-850 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.docker}
                          onChange={(e) => setExportOptions({ ...exportOptions, docker: e.target.checked })}
                          className="w-4 h-4 text-purple-600 bg-slate-900 border-slate-800 rounded focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-white">Dockerfile & docker-compose.yml</div>
                          <div className="text-[10px] text-slate-500">Configuração de container pronta para rodar em produção</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-850 rounded-xl hover:border-slate-850 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={exportOptions.readme}
                          onChange={(e) => setExportOptions({ ...exportOptions, readme: e.target.checked })}
                          className="w-4 h-4 text-purple-600 bg-slate-900 border-slate-800 rounded focus:ring-purple-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-white">README.md</div>
                          <div className="text-[10px] text-slate-500">Guia de introdução rápida do projeto</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-850 flex justify-end gap-3">
                    <button
                      onClick={() => setShowExportModal(false)}
                      className="px-4 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-850 hover:text-white rounded-xl text-xs font-semibold text-slate-350 cursor-pointer transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const queryParams = new URLSearchParams({
                            pages: exportOptions.pages.toString(),
                            css: exportOptions.css.toString(),
                            js: exportOptions.js.toString(),
                            docker: exportOptions.docker.toString(),
                            readme: exportOptions.readme.toString()
                          }).toString();

                          const response = await fetch(`${API_URL}/api/export/${projectId}?${queryParams}`, {
                            headers: {
                              'Authorization': `Bearer ${token}`
                            }
                          });
                          if (!response.ok) throw new Error('Falha ao exportar ZIP');
                          
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `projeto-${project?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'site'}.zip`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          setShowExportModal(false);
                        } catch (err: any) {
                          alert(err.message);
                        }
                      }}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all"
                    >
                      Baixar ZIP
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex justify-center items-center text-slate-500">
            Carregando editor...
          </div>
        )}
      </div>

    </div>
  );
};
