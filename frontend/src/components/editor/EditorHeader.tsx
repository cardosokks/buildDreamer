import React from 'react';
import {
  ArrowLeft,
  Sun,
  Moon,
  ChevronDown,
  Monitor,
  Tablet,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Code2,
  Download,
  Globe,
  Radio,
  Square,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  MessageSquare,
  Eye,
  Loader2
} from 'lucide-react';

interface EditorHeaderProps {
  projectName?: string;
  activePageName?: string;
  pages?: Array<{ id: string; name: string; isHomepage?: boolean }>;
  activePageId: string;
  onSelectPage: (id: string) => void;
  onBack: () => void;
  viewport: 'desktop' | 'tablet' | 'mobile';
  setViewport: (vp: 'desktop' | 'tablet' | 'mobile') => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  theme: string;
  toggleTheme: () => void;
  showSidebar: boolean;
  setShowSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  showStylesPanel: boolean;
  setShowStylesPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showChat: boolean;
  setShowChat: React.Dispatch<React.SetStateAction<boolean>>;
  showCodeModal: boolean;
  setShowCodeModal: (val: boolean) => void;
  showExportModal: boolean;
  setShowExportModal: (val: boolean) => void;
  showGlobalsModal: boolean;
  setShowGlobalsModal: (val: boolean) => void;
  aiGenerating: boolean;
  aiJobStatus: string | null;
  onOpenAiLogs: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  projectName,
  pages = [],
  activePageId,
  onSelectPage,
  onBack,
  viewport,
  setViewport,
  zoom,
  setZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  theme,
  toggleTheme,
  showSidebar,
  setShowSidebar,
  showStylesPanel,
  setShowStylesPanel,
  showChat,
  setShowChat,
  setShowCodeModal,
  setShowExportModal,
  setShowGlobalsModal,
  aiGenerating,
  aiJobStatus,
  onOpenAiLogs
}) => {
  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40 relative select-none">
      {/* Left section: Project title & Page Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Voltar ao Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="h-5 w-px bg-slate-800" />

        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-slate-100 text-sm max-w-[140px] truncate">
            {projectName || 'Projeto sem nome'}
          </span>

          {pages.length > 0 && (
            <div className="relative group">
              <select
                value={activePageId}
                onChange={(e) => onSelectPage(e.target.value)}
                className="appearance-none bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium rounded-lg pl-3 pr-7 py-1.5 cursor-pointer outline-none transition-colors"
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isHomepage ? '(Home)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Middle section: Device Viewports & Undo/Redo */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewport('desktop')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewport === 'desktop' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Desktop View"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewport === 'tablet' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tablet View"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewport === 'mobile' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mobile View"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="text-slate-400 hover:text-slate-200 p-0.5"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-medium text-slate-300 min-w-[36px] text-center">
            {zoom}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            className="text-slate-400 hover:text-slate-200 p-0.5"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right section: AI Logs, Code, Export, Modals, Theme & Panels */}
      <div className="flex items-center gap-2">
        {aiGenerating && (
          <button
            onClick={onOpenAiLogs}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded-xl text-xs font-medium animate-pulse transition-all"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>IA Trabalhando...</span>
          </button>
        )}

        <button
          onClick={() => setShowGlobalsModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
          title="Gerenciar Componentes Globais (Header & Footer)"
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>Globais</span>
        </button>

        <button
          onClick={() => setShowCodeModal(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Ver / Editar Código Limpo"
        >
          <Code2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          title="Exportar Código do Projeto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>

        <div className="h-5 w-px bg-slate-800" />

        {/* Panel Toggles */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
          <button
            onClick={() => setShowSidebar((s) => !s)}
            className={`p-1.5 rounded-lg transition-colors ${
              showSidebar ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Alternar Árvore DOM e Mídia (Esquerda)"
          >
            {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowStylesPanel((s) => !s)}
            className={`p-1.5 rounded-lg transition-colors ${
              showStylesPanel ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Alternar Painel de Propriedades e Estilos (Direita)"
          >
            {showStylesPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowChat((c) => !c)}
            className={`p-1.5 rounded-lg transition-colors ${
              showChat ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Alternar Copiloto IA (Chat)"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Alternar Modo Claro / Escuro"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
