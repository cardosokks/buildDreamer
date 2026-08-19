import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
  const [selectedStyles, setSelectedStyles] = useState<Record<string, string>>({});

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

  // History version state
  interface VersionSnapshot {
    timestamp: string;
    description: string;
    html: string;
    css: string;
    js: string;
  }
  const [versionHistory, setVersionHistory] = useState<Record<string, VersionSnapshot[]>>({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/projects/${projectId}`, {
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
      const res = await fetch(`http://localhost:5000/api/pages/${pageId}`, {
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

    // 2. Persist in database
    savePageCode(activePage.id, { [type]: value });
  };

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

  const handleStyleChange = (property: string, value: string) => {
    if (!activePage || !selectedSelector) return;
    
    // Trigger local update visually (in production we will patch the HTML/CSS and sync to state)
    setSelectedStyles(prev => ({ ...prev, [property]: value }));

    // Real update logic will follow in Phase 4 / Phase 16 (CSS parser integration)
    console.log(`Applying style change: ${property} = ${value} to ${selectedSelector}`);
  };

  const handleCreatePage = async () => {
    const name = prompt('Nome da página:');
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      const res = await fetch(`http://localhost:5000/api/projects/${projectId}/pages`, {
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
      const res = await fetch(`http://localhost:5000/api/pages/${id}`, {
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
          className: node.className || undefined,
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
    <div className="h-full w-full bg-slate-950 flex flex-col font-sans text-slate-100 overflow-hidden">
      
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
            onClick={async () => {
              try {
                const response = await fetch(`http://localhost:5000/api/export/${projectId}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                if (!response.ok) throw new Error('Falha ao exportar ZIP');
                
                // Trigger download
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `projeto-${project?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'site'}.zip`;
                document.body.appendChild(a);
                a.click();
                a.remove();
              } catch (err: any) {
                alert(err.message);
              }
            }}
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
                }}
                onCreatePage={handleCreatePage}
                onDuplicatePage={handleDuplicatePage}
                onDeletePage={handleDeletePage}
                layers={layers}
                onSelectLayer={(selector) => setSelectedSelector(selector)}
              />
            )}

            {/* Main Interactive Canvas Area */}
            <main className="flex-1 p-6 flex justify-center items-center overflow-auto bg-slate-950/20">
              <div 
                className="transition-all duration-300"
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
                  onElementSelect={(selector, styles) => {
                    setSelectedSelector(selector);
                    setSelectedStyles(styles);
                  }}
                />
              </div>
            </main>

            {/* Properties Control Panel (Condicional) */}
            {showStylesPanel && (
              <PropertiesPanel
                selectedSelector={selectedSelector}
                selectedStyles={selectedStyles}
                onStyleChange={handleStyleChange}
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
