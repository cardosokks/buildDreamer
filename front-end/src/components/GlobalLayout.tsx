import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  MessageCircle, 
  ChevronUp, 
  CheckCircle2, 
  ShieldCheck, 
  Globe, 
  Heart,
  Layers,
  Zap,
  Users,
  FolderPlus,
  Sliders,
  HelpCircle,
  X,
  Phone
} from 'lucide-react';
import { TeamChatPanel } from './TeamChatPanel';
import { useAuth } from '../context/AuthContext';

export interface GlobalLayoutProps {
  children: React.ReactNode;
  currentRoute: {
    type: string;
    tab?: string;
    projectId?: string;
  };
  onNavigate: (route: { type: any; tab?: any; projectId?: string }) => void;
}

export const GlobalLayout: React.FC<GlobalLayoutProps> = ({
  children,
  currentRoute,
  onNavigate
}) => {
  const { user } = useAuth();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);

  // Monitor scroll for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check if current view is a full-bleed workspace (like Visual Builder or AI Improver)
  const isFullWorkspace = currentRoute.type === 'builder' || currentRoute.type === 'ai-improver';
  const isAuthPage = currentRoute.type === 'auth' || !user;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative selection:bg-purple-500/30 selection:text-purple-200">
      
      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col ${isFullWorkspace ? 'h-screen overflow-hidden' : ''}`}>
        {children}
      </main>

      {/* FLOATING UI ELEMENTS (Persistentes para usuários autenticados no Dashboard) */}
      {!isAuthPage && user && (
        <div 
          className="fixed bottom-5 right-5 z-50 flex flex-col items-end space-y-3 pointer-events-none"
          id="floating-ui-container"
        >
          {/* Botão de WhatsApp Flutuante */}
          <button
            onClick={() => setIsWhatsappModalOpen(true)}
            className="pointer-events-auto p-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-200 group relative flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
            title="Atendimento e Suporte via WhatsApp"
            aria-label="Abrir suporte via WhatsApp"
          >
            <MessageCircle className="w-6 h-6 fill-slate-950" />
            <span className="absolute right-full mr-3 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none">
              Suporte WhatsApp
            </span>
          </button>

          {/* Botão de Chat Interno da Equipe Flutuante */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="pointer-events-auto p-3.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-105 transition-all duration-200 group relative flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-400"
            title="Chat da Equipe & Suporte"
            aria-label="Abrir Chat da Equipe"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-950 animate-pulse" />
            <span className="absolute right-full mr-3 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none">
              Chat da Equipe
            </span>
          </button>

          {/* Botão de Voltar ao Topo */}
          {showScrollTop && !isFullWorkspace && (
            <button
              onClick={scrollToTop}
              className="pointer-events-auto p-3 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 shadow-md hover:scale-105 transition-all duration-200 group relative focus:outline-none focus:ring-2 focus:ring-slate-400"
              title="Voltar ao topo"
              aria-label="Voltar ao topo da página"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Modal / Panel de Chat da Equipe (Exibido apenas quando o usuário está autenticado) */}
      {!isAuthPage && user && (
        <TeamChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      )}

      {/* Modal Flutuante de WhatsApp / Contato Direto */}
      {isWhatsappModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="whatsapp-modal-title"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <button 
              onClick={() => setIsWhatsappModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 id="whatsapp-modal-title" className="text-base font-bold text-white">Suporte & Atendimento</h3>
                <p className="text-xs text-slate-400">Fale diretamente com nosso time especializado</p>
              </div>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
              <div className="flex items-start space-x-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Atendimento humanizado para tirar dúvidas sobre projetos e publicação.</span>
              </div>
              <div className="flex items-start space-x-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Suporte técnico para integração de domínios e MinIO storage.</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <a
                href="https://wa.me/5511999999999?text=Olá!%20Preciso%20de%20suporte%20no%20BuildDreamer."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Phone className="w-4 h-4" />
                <span>Iniciar Conversa no WhatsApp</span>
              </a>
              <button
                onClick={() => setIsWhatsappModalOpen(false)}
                className="w-full py-2.5 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
