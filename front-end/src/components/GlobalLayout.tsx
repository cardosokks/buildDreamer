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

      {/* Global Footer (Visible on Dashboard, Auth, Landing and main pages; streamlined on full workspaces) */}
      {!isFullWorkspace && (
        <footer 
          className="bg-slate-900/90 border-t border-slate-800/80 pt-12 pb-8 px-4 sm:px-6 lg:px-8 mt-auto text-slate-400 text-sm relative z-10 backdrop-blur-md"
          id="global-footer"
          aria-label="Rodapé do Sistema BuildDreamer"
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800/60">
            
            {/* Coluna 1: Branding & Status */}
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-purple-500/20">
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                  </div>
                </div>
                <span className="font-bold text-lg text-white tracking-tight">
                  Build<span className="text-purple-400">Dreamer</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plataforma de alta precisão para construção, remasterização e gestão inteligente de sites e funis com IA.
              </p>
              
              {/* Badge de Status do Sistema */}
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Sistemas Operacionais (v2.5)</span>
              </div>
            </div>

            {/* Coluna 2: Navegação Rápida */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Navegação</h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button 
                    onClick={() => onNavigate({ type: 'dashboard', tab: 'general' })}
                    className="hover:text-purple-400 transition-colors flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span>Início / Visão Geral</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => onNavigate({ type: 'dashboard', tab: 'projects' })}
                    className="hover:text-purple-400 transition-colors flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Meus Projetos</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => onNavigate({ type: 'dashboard', tab: 'crm' })}
                    className="hover:text-purple-400 transition-colors flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CRM & Vendas</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => onNavigate({ type: 'dashboard', tab: 'presets' })}
                    className="hover:text-purple-400 transition-colors flex items-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Modelos & Presets</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Coluna 3: Gestão & Equipe */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Gestão</h4>
              <ul className="space-y-2 text-xs">
                {user && (
                  <li>
                    <button 
                      onClick={() => onNavigate({ type: 'dashboard', tab: 'users' })}
                      className="hover:text-purple-400 transition-colors flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>Usuários & Equipe</span>
                    </button>
                  </li>
                )}
                <li>
                  <button 
                    onClick={() => onNavigate({ type: 'dashboard', tab: 'settings' })}
                    className="hover:text-purple-400 transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Configurações & Integrações</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setIsChatOpen(true)}
                    className="hover:text-purple-400 transition-colors flex items-center gap-1.5 text-purple-300 font-medium"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                    <span>Chat da Equipe / Suporte</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Coluna 4: Conformidade & Suporte */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Acessibilidade & Segurança</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Desenvolvido sob diretrizes WCAG 2.1 AA, garantindo acessibilidade, contraste adequado e navegação por teclado.
              </p>
              <div className="flex items-center space-x-3 pt-1">
                <button 
                  onClick={() => setIsWhatsappModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-all flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Suporte WhatsApp</span>
                </button>
              </div>
            </div>

          </div>

          {/* Sub-Rodapé Direitos Autorais */}
          <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <div className="flex items-center space-x-1">
              <span>© {new Date().getFullYear()} BuildDreamer. Todos os direitos reservados.</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="hover:text-slate-400 cursor-pointer transition-colors">Termos de Uso</span>
              <span className="hover:text-slate-400 cursor-pointer transition-colors">Privacidade</span>
              <span className="hover:text-slate-400 cursor-pointer transition-colors">WCAG 2.1 AA</span>
            </div>
          </div>
        </footer>
      )}

      {/* FLOATING UI ELEMENTS (Persistentes em toda a aplicação) */}
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

        {/* Botão de Chat Interno da Equipe Flutuante (Apenas para usuários autenticados fora da tela de login) */}
        {!isAuthPage && user && (
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
        )}

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
