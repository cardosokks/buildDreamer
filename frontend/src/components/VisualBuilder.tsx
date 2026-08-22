import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ArrowLeft,
  Eye,
  Download,
  Code2,
  Undo2,
  Redo2,
  Check,
  PanelLeftClose,
  PanelRightClose,
  MessageSquare,
  Sparkles,
  Smartphone,
  Tablet,
  Monitor,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Copy,
  Sun,
  Moon,
  Globe,
  Radio,
  Square,
  ChevronDown,
  Loader2,
  Upload
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import type { ElementNode } from './Sidebar';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { CodeEditor } from './CodeEditor';
import { ChatPanel } from './ChatPanel';
import { API_URL } from '../config';

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
  const { theme, toggleTheme } = useTheme();
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

  // Layout Panels (Persistência no LocalStorage)
  const [showSidebar, setShowSidebar] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('vb_show_sidebar');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const [showStylesPanel, setShowStylesPanel] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('vb_show_styles_panel');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const [showChat, setShowChat] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('vb_show_chat');
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vb_show_sidebar', JSON.stringify(showSidebar));
    } catch {}
  }, [showSidebar]);

  useEffect(() => {
    try {
      localStorage.setItem('vb_show_styles_panel', JSON.stringify(showStylesPanel));
    } catch {}
  }, [showStylesPanel]);

  useEffect(() => {
    try {
      localStorage.setItem('vb_show_chat', JSON.stringify(showChat));
    } catch {}
  }, [showChat]);

  // Modais & Menus
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showProjectMenuDropdown, setShowProjectMenuDropdown] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeExportTab, setActiveExportTab] = useState<'html' | 'css' | 'js'>('html');

  // History Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiJobStatus, setAiJobStatus] = useState<string | null>(null);

  const fetchProjectDetails = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar projeto');
      const data = await res.json();
      setProject(data);
      if (data.name) {
        document.title = `${data.name} | Editor Visual BuildDreamer`;
      }
      if (data.pages && data.pages.length > 0 && !activePageId) {
        const home = data.pages.find((p: Page) => p.isHomepage) || data.pages[0];
        setActivePageId(home.id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Monitorar se há uma geração com IA em andamento no projeto
  useEffect(() => {
    let interval: any = null;

    const checkJob = async () => {
      try {
        const res = await fetch(`${API_URL}/api/projects/jobs/${projectId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const job = await res.json();
        
        if (job.status === 'processing' || job.status === 'pending') {
          setAiGenerating(true);
          if (job.currentModel) {
            setAiJobStatus(`Criando site com ${job.currentModel} (tentativa ${job.attempt}/${job.total})...`);
          } else {
            setAiJobStatus('A IA está construindo a estrutura e o design do site...');
          }
        } else if (job.status === 'completed') {
          if (aiGenerating) {
            setAiGenerating(false);
            setAiJobStatus(null);
            fetchProjectDetails();
          }
          if (interval) clearInterval(interval);
        } else if (job.status === 'failed') {
          setAiGenerating(false);
          setAiJobStatus(null);
          if (interval) clearInterval(interval);
        }
      } catch {}
    };

    checkJob();
    interval = setInterval(checkJob, 2000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [projectId, token, aiGenerating]);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !isInput && selectedPath) {
        e.preventDefault();
        handleDuplicateElement(selectedPath);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedPath, activePage]);

  // Helpers to parse and serialize DOM trees safely
  const parseDocFromHtml = (htmlStr: string) => {
    const parser = new DOMParser();
    const cleanStr = String(htmlStr || '').trim();
    // Se o HTML não tiver wrapper <div id="canvas-root">, envolve para manter a árvore normalizada
    if (cleanStr.includes('id="canvas-root"')) {
      return parser.parseFromString(cleanStr, 'text/html');
    } else {
      return parser.parseFromString(`<div id="canvas-root">${cleanStr}</div>`, 'text/html');
    }
  };

  const serializeBodyContent = (doc: Document) => {
    const canvasRoot = doc.getElementById('canvas-root');
    if (canvasRoot) return canvasRoot.innerHTML;
    return doc.body ? doc.body.innerHTML : '';
  };

  const getElementByPath = (root: Element, path: string): Element | null => {
    if (path === undefined || path === null || path === '') return null;
    const parts = String(path).split('.').map(p => parseInt(p, 10)).filter(n => !isNaN(n));
    if (parts.length === 0) return null;

    let current: Element | null = root;
    for (const idx of parts) {
      if (!current) return null;
      const validChildren: Element[] = Array.from(current.children).filter(
        (c: Element) => !c.id.startsWith('studio-') && !c.classList.contains('studio-tool-btn')
      );
      if (idx < 0 || idx >= validChildren.length) return null;
      current = validChildren[idx];
    }
    return current;
  };

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Update Page Code with Database & FTP Sync
  const handleCodeChange = async (type: 'html' | 'css' | 'js', value: string) => {
    if (!activePage) return;
    pushHistorySnapshot(`Edição de ${type.toUpperCase()}`);
    setSaveStatus('saving');

    const updatedPages = project?.pages.map(p => {
      if (p.id === activePage.id) return { ...p, [type]: value };
      return p;
    });
    setProject(prev => prev ? { ...prev, pages: updatedPages || [] } : null);

    try {
      const res = await fetch(`${API_URL}/api/pages/${activePage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [type]: value })
      });
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error("Erro ao sincronizar com banco e FTP:", e);
      setSaveStatus('error');
    }
  };

  // Explicit Save Trigger
  const handleManualSave = async () => {
    if (!activePage) return;
    setSaveStatus('saving');
    try {
      const res = await fetch(`${API_URL}/api/pages/${activePage.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          html: activePage.html,
          css: activePage.css,
          js: activePage.js,
          seoTitle: activePage.seoTitle,
          seoDescription: activePage.seoDescription
        })
      });
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error("Erro ao salvar:", e);
      setSaveStatus('error');
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
        el.innerHTML = value;
      } else {
        el.setAttribute(attr, value);
      }
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
    }
  };

  // Move element up or down among siblings
  const handleMoveElementDirection = (path: string, direction: 'up' | 'down') => {
    if (!activePage || !path) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, path);
    if (!el || !el.parentElement) return;

    const parent = el.parentElement;
    const siblings = Array.from(parent.children);
    const currentIndex = siblings.indexOf(el);

    if (direction === 'up' && currentIndex > 0) {
      parent.insertBefore(el, siblings[currentIndex - 1]);
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      parent.insertBefore(el, siblings[currentIndex + 1].nextSibling);
    } else {
      return;
    }

    const newHtml = serializeBodyContent(doc);
    handleCodeChange('html', newHtml);
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

  // Element Reorder (before, after or inside)
  const handleMoveElement = (sourcePath: string, targetPath: string, position: 'before' | 'after' | 'inside' = 'inside') => {
    if (!activePage || sourcePath === targetPath) return;
    if (targetPath.startsWith(sourcePath + '.')) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const srcEl = getElementByPath(root, sourcePath);
    const tgtEl = getElementByPath(root, targetPath);
    if (srcEl && tgtEl && srcEl.parentElement) {
      srcEl.parentElement.removeChild(srcEl);
      if (position === 'before' && tgtEl.parentElement) {
        tgtEl.parentElement.insertBefore(srcEl, tgtEl);
      } else if (position === 'after' && tgtEl.parentElement) {
        tgtEl.parentElement.insertBefore(srcEl, tgtEl.nextSibling);
      } else {
        tgtEl.appendChild(srcEl);
      }
      const newHtml = serializeBodyContent(doc);
      handleCodeChange('html', newHtml);
      setSelectedPath(null);
      setSelectedSelector(null);
    }
  };

  // Insert template block at exact dropped position or append
  const handleInsertBlock = (
    htmlBlock: string, 
    cssBlock?: string, 
    targetPath?: string, 
    position: 'before' | 'after' | 'inside' | 'append' = 'append'
  ) => {
    if (!activePage) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;

    // Criar nós a partir do bloco HTML
    const tempContainer = doc.createElement('div');
    tempContainer.innerHTML = htmlBlock.trim();
    const newElements = Array.from(tempContainer.children);

    if (newElements.length === 0) return;

    if (targetPath && position !== 'append') {
      const tgtEl = getElementByPath(root, targetPath);
      if (tgtEl) {
        if (position === 'before' && tgtEl.parentElement) {
          newElements.forEach(el => tgtEl.parentElement!.insertBefore(el, tgtEl));
        } else if (position === 'after' && tgtEl.parentElement) {
          newElements.forEach(el => tgtEl.parentElement!.insertBefore(el, tgtEl.nextSibling));
        } else {
          newElements.forEach(el => tgtEl.appendChild(el));
        }
      } else {
        newElements.forEach(el => root.appendChild(el));
      }
    } else {
      newElements.forEach(el => root.appendChild(el));
    }

    const newHtml = serializeBodyContent(doc);
    const newCss = cssBlock ? `${activePage.css || ''}\n${cssBlock}` : activePage.css;
    handleCodeChange('html', newHtml);
    if (cssBlock) handleCodeChange('css', newCss);
  };

  // Save selected element as a custom template
  const handleSaveSelectionAsTemplate = (title: string, category: string) => {
    if (!activePage || !selectedPath) return;
    const doc = parseDocFromHtml(activePage.html);
    const root = doc.getElementById('canvas-root') || doc.body;
    const el = getElementByPath(root, selectedPath);
    if (!el) {
      alert('Elemento selecionado não foi encontrado no documento.');
      return;
    }

    const templateHtml = el.outerHTML;
    const newTemplate = {
      id: `tmpl-${Date.now()}`,
      title: title.trim() || 'Template Personalizado',
      category: category.trim() || 'Personalizados',
      html: templateHtml,
      createdAt: Date.now()
    };

    try {
      const stored = localStorage.getItem('studio_custom_templates');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newTemplate);
      localStorage.setItem('studio_custom_templates', JSON.stringify(list));
      alert(`Template "${newTemplate.title}" salvo com sucesso na biblioteca!`);
    } catch {
      alert('Erro ao salvar template localmente.');
    }
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
      const cleanStr = String(htmlString || '').trim();
      const doc = cleanStr.includes('id="canvas-root"') 
        ? parser.parseFromString(cleanStr, 'text/html')
        : parser.parseFromString(`<div id="canvas-root">${cleanStr}</div>`, 'text/html');
      
      function nodeToElementNode(node: Element): ElementNode | null {
        // Ignora overlays de seleção internos se existirem no snapshot
        if (node.id && node.id.startsWith('studio-')) return null;
        if (node.classList && node.classList.contains('studio-tool-btn')) return null;

        const childNodes: ElementNode[] = [];
        for (let i = 0; i < node.children.length; i++) {
          const parsedChild = nodeToElementNode(node.children[i]);
          if (parsedChild) childNodes.push(parsedChild);
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
      return rootElements
        .map(nodeToElementNode)
        .filter((n): n is ElementNode => n !== null);
    } catch (e) {
      console.error("Falha ao gerar árvore DOM:", e);
      return [];
    }
  };

  const layers = activePage ? parseHtmlToLayers(activePage.html) : [];

  // Download Project as complete ZIP package (including Dockerfile, docker-compose, pages, css, js)
  const [exportOptions, setExportOptions] = useState({
    pages: true,
    css: true,
    js: true,
    docker: true,
    readme: true
  });
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownloadZip = async () => {
    if (!project) return;
    setDownloadingZip(true);
    try {
      const queryParams = new URLSearchParams({
        pages: String(exportOptions.pages),
        css: String(exportOptions.css),
        js: String(exportOptions.js),
        docker: String(exportOptions.docker),
        readme: String(exportOptions.readme)
      }).toString();

      const res = await fetch(`${API_URL}/api/export/${project.id}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Falha ao exportar pacote ZIP');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projeto-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar pacote de exportação ZIP.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const [importingZip, setImportingZip] = useState(false);
  const zipFileInputRef = useRef<HTMLInputElement>(null);

  const handleImportZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    if (!file.name.endsWith('.zip')) {
      alert('Selecione um arquivo .zip válido.');
      return;
    }

    setImportingZip(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch(`${API_URL}/api/projects/import-zip`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            targetProjectId: project.id,
            zipBase64: base64
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Falha ao importar arquivo ZIP.');
        }

        alert('Arquivo ZIP importado com sucesso para este projeto!');
        fetchProjectDetails();
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar o arquivo ZIP.');
    } finally {
      setImportingZip(false);
      if (zipFileInputRef.current) zipFileInputRef.current.value = '';
    }
  };

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
  <script>
    // Interceptor de navegação para Preview local multi-páginas
    window.__PROJECT_PAGES__ = ${JSON.stringify((project?.pages || []).map(p => ({
      name: p.name,
      slug: p.slug,
      isHomepage: p.isHomepage,
      html: p.html,
      css: p.css,
      js: p.js,
      title: p.seoTitle || p.name
    })))};

    document.addEventListener('click', function(e) {
      var target = e.target.closest('a');
      if (!target) return;
      var href = target.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;

      e.preventDefault();
      var cleanSlug = href.replace(/^\\//, '').replace(/\\.html$/, '') || 'index';
      var page = window.__PROJECT_PAGES__.find(function(p) {
        return p.slug === cleanSlug || (cleanSlug === 'index' && p.isHomepage);
      });

      if (page) {
        document.title = page.title || page.name;
        document.body.innerHTML = page.html || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (page.js) {
          try { eval(page.js); } catch(err) { console.error(err); }
        }
      }
    });
  </script>
</body>
</html>`;
  };

  const handleDownloadSingleHtml = () => {
    const content = getFullHtmlDocument();
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePage?.slug || 'index'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [ngrokActive, setNgrokActive] = useState(false);
  const [ngrokUrl, setNgrokUrl] = useState<string | null>(null);
  const [showPreviewMenu, setShowPreviewMenu] = useState(false);

  // Consulta se o sistema está online no Ngrok
  const checkSystemNgrokStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/ngrok/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.active && data.url) {
          setNgrokActive(true);
          setNgrokUrl(data.url);
        } else {
          setNgrokActive(false);
          setNgrokUrl(null);
        }
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    checkSystemNgrokStatus();
    const interval = setInterval(checkSystemNgrokStatus, 4000);
    return () => clearInterval(interval);
  }, [checkSystemNgrokStatus]);

  const handleOpenLivePreview = () => {
    const content = getFullHtmlDocument();
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setShowPreviewMenu(false);
  };

  const handleOpenNgrokPreview = () => {
    if (!ngrokUrl) return;
    const pageRoute = activePage ? `/builder/${projectId}` : '';
    window.open(`${ngrokUrl}${pageRoute}`, '_blank');
    setShowPreviewMenu(false);
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
        </div>

        {/* Actions & Utilities */}
        <div className="flex items-center gap-2">
          {/* Status de Salvamento / Sincronização FTP */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-900 text-[11px] font-mono">
            {saveStatus === 'saving' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                <span className="text-yellow-400">Sincronizando FTP...</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400">Erro ao Salvar</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-emerald-400">Salvo & FTP OK</span>
              </>
            )}
          </div>

          {/* Botão Salvar Manual */}
          <button
            onClick={handleManualSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Salvar Alterações (Ctrl+S)"
          >
            <Check className="w-3.5 h-3.5 text-purple-400" />
            Salvar
          </button>

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

          {/* Botão Unificado de Preview (Local + Ngrok) */}
          <div className="relative">
            {ngrokActive && ngrokUrl ? (
              <div className="flex items-center">
                <button
                  onClick={handleOpenLivePreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/50 rounded-l-xl text-xs font-semibold text-cyan-300 transition-all cursor-pointer shadow-sm"
                  title="Abrir Preview Local em Nova Aba"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Preview</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Ngrok Online" />
                </button>

                <button
                  onClick={() => setShowPreviewMenu(!showPreviewMenu)}
                  className="p-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-l-0 border-cyan-500/50 rounded-r-xl text-cyan-300 transition-all cursor-pointer"
                  title="Mais Opções de Preview (Local / Link Ngrok)"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenLivePreview}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                title="Abrir Preview Local em Nova Aba"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            )}

            {/* Menu Dropdown de Preview quando Ngrok estiver ativo */}
            {showPreviewMenu && ngrokActive && ngrokUrl && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={handleOpenLivePreview}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white rounded-lg transition-colors cursor-pointer text-left"
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="block font-bold">Preview Local</span>
                    <span className="text-[10px] text-slate-400">Em tempo real nesta máquina</span>
                  </div>
                </button>

                <button
                  onClick={handleOpenNgrokPreview}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="block font-bold flex items-center gap-1.5">
                      Link Público Ngrok
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </span>
                    <span className="text-[10px] text-emerald-400/80 font-mono truncate block max-w-[170px]">
                      {ngrokUrl.replace('https://', '')}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Hidden ZIP File Input */}
          <input 
            type="file" 
            ref={zipFileInputRef} 
            onChange={handleImportZipFile} 
            accept=".zip" 
            className="hidden" 
          />

          {/* Menu Dropdown de Projeto (Importar / Exportar Código / Exportar ZIP) */}
          <div className="relative">
            <button 
              onClick={() => setShowProjectMenuDropdown(!showProjectMenuDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs text-white rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.25)] cursor-pointer"
              title="Opções de Importação e Exportação do Projeto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Projeto</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {showProjectMenuDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 space-y-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setShowProjectMenuDropdown(false);
                    setShowExportModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-purple-600 hover:text-white rounded-lg transition-colors cursor-pointer text-left group"
                >
                  <Download className="w-4 h-4 text-purple-400 group-hover:text-white shrink-0" />
                  <div>
                    <span className="block">Exportar Site / Pacote ZIP</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-purple-100 font-normal">Baixar HTML, CSS, JS e Docker</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowProjectMenuDropdown(false);
                    zipFileInputRef.current?.click();
                  }}
                  disabled={importingZip}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors cursor-pointer text-left group"
                >
                  {importingZip ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                  ) : (
                    <Upload className="w-4 h-4 text-cyan-400 group-hover:text-white shrink-0" />
                  )}
                  <div>
                    <span className="block">{importingZip ? 'Importando...' : 'Importar Arquivo .ZIP'}</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-indigo-100 font-normal">Carregar páginas de um ZIP</span>
                  </div>
                </button>

                <div className="border-t border-slate-800 my-1" />

                <button
                  onClick={() => {
                    setShowProjectMenuDropdown(false);
                    setShowCodeModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white rounded-lg transition-colors cursor-pointer text-left"
                >
                  <Code2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="block">Inspecionar Código</span>
                    <span className="text-[10px] text-slate-400 font-normal">Ver e copiar HTML/CSS/JS</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Botão de Alternar Modo Escuro / Modo Claro */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-amber-300 shadow-sm'
            }`}
            title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
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
            onRenamePage={async (id, newName) => {
              if (!newName) return;
              const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              try {
                const res = await fetch(`${API_URL}/api/pages/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ name: newName, slug: newSlug })
                });
                if (res.ok) {
                  setProject(prev => prev ? {
                    ...prev,
                    pages: prev.pages.map(p => p.id === id ? { ...p, name: newName, slug: newSlug } : p)
                  } : null);
                }
              } catch (e) {
                console.error('Erro ao renomear página:', e);
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
            onSetHomepage={async (id) => {
              const res = await fetch(`${API_URL}/api/pages/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ isHomepage: true })
              });
              if (res.ok) {
                setProject(prev => prev ? {
                  ...prev,
                  pages: prev.pages.map(p => ({ ...p, isHomepage: p.id === id }))
                } : null);
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
            onMoveElementDirection={handleMoveElementDirection}
            onInsertBlock={handleInsertBlock}
            onSaveSelectionAsTemplate={handleSaveSelectionAsTemplate}
            selectedPath={selectedPath}
          />
        )}

        {/* Central Interactive Sandbox Canvas */}
        <main 
          className="flex-1 flex justify-center items-center overflow-auto bg-[#07020d] p-3 md:p-6 min-w-0"
          onWheel={(e) => {
            if (e.altKey) {
              e.preventDefault();
              if (e.deltaY < 0) {
                setZoom(z => Math.min(150, z + 5));
              } else {
                setZoom(z => Math.max(50, z - 5));
              }
            }
          }}
        >
          <div 
            className="transition-all duration-200 h-full flex items-center justify-center relative"
            style={{
              width: viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%',
              height: '100%'
            }}
          >
            {/* Overlay de carregamento com IA */}
            {aiGenerating && (
              <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-2xl border border-amber-500/30">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500/50 p-1 mb-4 animate-spin shadow-[0_0_25px_rgba(229,185,95,0.5)] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 tracking-wide">Construindo Site com Inteligência Artificial</h3>
                <p className="text-xs text-amber-300/80 max-w-md font-mono mb-4 animate-pulse">
                  {aiJobStatus || 'Gerando estrutura de alta conversão, paleta e seções sob medida...'}
                </p>
                <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-amber-400 via-rose-400 to-amber-500 animate-pulse" />
                </div>
              </div>
            )}

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
                onDeleteElement={handleDeleteElement}
                onDuplicateElement={handleDuplicateElement}
                onMoveElementDirection={handleMoveElementDirection}
                onHtmlChange={(newHtml) => handleCodeChange('html', newHtml)}
                onInsertBlock={handleInsertBlock}
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
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onMoveElement={handleMoveElement}
            onMoveElementDirection={handleMoveElementDirection}
            layers={layers}
            onSelectLayer={(selector, path) => {
              setSelectedSelector(selector);
              setSelectedPath(path);
            }}
            onHoverLayer={(path) => setHoverPath(path)}
            onSaveSelectionAsTemplate={handleSaveSelectionAsTemplate}
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
            projectId={projectId}
            pages={project?.pages || [activePage]}
            onApplyChanges={handleApplyAIChanges}
            onUndo={handleUndo}
            canUndo={undoStack.length > 0}
            onReloadAllPages={async () => {
              try {
                const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                  const data = await res.json();
                  setProject(data);
                }
              } catch {}
            }}
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

      {/* ─── Modal de Exportação & Download Completo (ZIP + Docker) ─── */}
      {showExportModal && activePage && project && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
            <div className="px-5 py-4 bg-[#090410] border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-sm text-white">Exportação do Projeto - {project.name}</span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Pacote ZIP Completo com Docker e Estrutura */}
              <div className="p-4 bg-purple-950/20 border border-purple-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-purple-400" />
                      Pacote Completo do Projeto (.ZIP)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Gera o arquivo ZIP com todas as páginas, folhas de estilo CSS, JS, Dockerfile e docker-compose.yml pronto para deploy em qualquer VPS ou Easypanel.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadZip}
                    disabled={downloadingZip}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingZip ? 'Gerando ZIP...' : 'Baixar Pacote ZIP'}
                  </button>
                </div>

                {/* Seletores de Arquivos do ZIP */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-purple-500/20 text-[11px]">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.pages}
                      onChange={e => setExportOptions({ ...exportOptions, pages: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    Páginas HTML (pages/)
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.css}
                      onChange={e => setExportOptions({ ...exportOptions, css: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    Estilos (css/)
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.js}
                      onChange={e => setExportOptions({ ...exportOptions, js: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    Scripts (js/)
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.docker}
                      onChange={e => setExportOptions({ ...exportOptions, docker: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    Dockerfile & Compose
                  </label>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportOptions.readme}
                      onChange={e => setExportOptions({ ...exportOptions, readme: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    README.md
                  </label>
                </div>
              </div>

              {/* Prévia e Cópia Rápida de Código */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-2">Prévia de Código da Página Atual ({activePage.name}):</span>
                <div className="flex gap-2 border-b border-slate-900 pb-2 mb-2">
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
                  rows={7}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-800"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                    {copiedCode ? 'Copiado!' : 'Copiar Código da Aba'}
                  </button>

                  <button
                    onClick={handleDownloadSingleHtml}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar apenas {activePage.slug}.html
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

