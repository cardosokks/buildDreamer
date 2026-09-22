import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthPage } from './pages/auth/AuthPage';
import { Dashboard } from './pages/dashboard/Dashboard';
import { VisualBuilder } from './pages/builder/VisualBuilder';
import { AIImprover } from './pages/ai-improver/AIImprover';
import { GlobalLayout } from './components/GlobalLayout';

export interface AppRoute {
  type: 'dashboard' | 'builder' | 'ai-improver' | 'auth';
  tab?: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings' | 'users';
  projectId?: string;
}

export interface RouteDefinition {
  path: string;
  type: AppRoute['type'];
  tab?: AppRoute['tab'];
  title: string;
  requiresAuth: boolean;
}

// Configuração estruturada de Rotas do Sistema
export const ROUTE_DEFINITIONS: RouteDefinition[] = [
  { path: '/', type: 'dashboard', tab: 'general', title: 'Dashboard', requiresAuth: true },
  { path: '/projects', type: 'dashboard', tab: 'projects', title: 'Meus Projetos', requiresAuth: true },
  { path: '/crm', type: 'dashboard', tab: 'crm', title: 'CRM & Vendas', requiresAuth: true },
  { path: '/leads', type: 'dashboard', tab: 'leads', title: 'Leads Encontrados', requiresAuth: true },
  { path: '/saved-leads', type: 'dashboard', tab: 'saved-leads', title: 'Leads Salvos', requiresAuth: true },
  { path: '/presets', type: 'dashboard', tab: 'presets', title: 'Modelos & Presets', requiresAuth: true },
  { path: '/settings', type: 'dashboard', tab: 'settings', title: 'Configurações', requiresAuth: true },
  { path: '/users', type: 'dashboard', tab: 'users', title: 'Usuários & Equipe', requiresAuth: true },
  { path: '/builder/:projectId', type: 'builder', title: 'Editor Visual', requiresAuth: true },
  { path: '/ai-improver/:projectId', type: 'ai-improver', title: 'Remasterizador IA', requiresAuth: true },
  { path: '/auth', type: 'auth', title: 'Autenticação', requiresAuth: false },
];

// Mapeador de URL atual para o estado de rota
const parseUrlToRoute = (): AppRoute => {
  const path = window.location.pathname;
  
  if (path.startsWith('/builder/')) {
    const projectId = path.replace('/builder/', '').split('/')[0];
    if (projectId) return { type: 'builder', projectId };
  }
  
  if (path.startsWith('/ai-improver/')) {
    const projectId = path.replace('/ai-improver/', '').split('/')[0];
    if (projectId) return { type: 'ai-improver', projectId };
  }
  
  const matchedRoute = ROUTE_DEFINITIONS.find(r => r.path === path && r.type === 'dashboard');
  if (matchedRoute && matchedRoute.tab) {
    return { type: 'dashboard', tab: matchedRoute.tab };
  }
  
  if (path === '/auth') return { type: 'auth' };

  return { type: 'dashboard', tab: 'general' };
};

const MainApp: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [route, setRoute] = useState<AppRoute>(parseUrlToRoute);

  // Sincroniza navegação pelos botões de Voltar/Avançar do navegador
  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseUrlToRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.title = 'BuildDreamer';
  }, []);

  // Atualiza URL do navegador mantendo integridade das rotas
  const navigate = (newRoute: AppRoute) => {
    let url = '/';
    if (newRoute.type === 'builder' && newRoute.projectId) {
      url = `/builder/${newRoute.projectId}`;
    } else if (newRoute.type === 'ai-improver' && newRoute.projectId) {
      url = `/ai-improver/${newRoute.projectId}`;
    } else if (newRoute.type === 'dashboard') {
      const def = ROUTE_DEFINITIONS.find(r => r.type === 'dashboard' && r.tab === newRoute.tab);
      url = def ? def.path : '/';
    } else if (newRoute.type === 'auth') {
      url = '/auth';
    }

    if (window.location.pathname !== url) {
      window.history.pushState(null, '', url);
    }
    setRoute(newRoute);
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen bg-slate-950 flex flex-col justify-center items-center text-slate-300 font-sans p-6 select-none animate-fade-in"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex items-center justify-center mb-5">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
          <div className="absolute w-6 h-6 rounded-full bg-purple-500/20 blur-md" />
        </div>
        <div className="text-base font-bold tracking-tight text-white mb-1">BuildDreamer</div>
        <div className="text-xs text-slate-400 font-medium">Verificando autenticação e sessão de usuário...</div>
      </div>
    );
  }

  // Se não autenticado, injeta o GlobalLayout na tela de login/cadastro
  if (!isAuthenticated) {
    return (
      <GlobalLayout currentRoute={{ type: 'auth' }} onNavigate={navigate}>
        <AuthPage
          onSuccess={() => {
            navigate({ type: 'dashboard', tab: 'general' });
          }}
        />
      </GlobalLayout>
    );
  }

  // Renderização estruturada de visões envolvendo automaticamente o GlobalLayout
  const renderCurrentView = () => {
    if (route.type === 'builder' && route.projectId) {
      return (
        <div className="h-screen w-screen overflow-hidden">
          <VisualBuilder 
            projectId={route.projectId} 
            onBack={() => navigate({ type: 'dashboard', tab: 'projects' })} 
            onOpenAIImprover={() => navigate({ type: 'ai-improver', projectId: route.projectId })}
          />
        </div>
      );
    }

    if (route.type === 'ai-improver' && route.projectId) {
      return (
        <div className="h-screen w-screen overflow-hidden">
          <AIImprover 
            projectId={route.projectId} 
            onBack={() => navigate({ type: 'dashboard', tab: 'projects' })} 
            onOpenEditor={() => navigate({ type: 'builder', projectId: route.projectId })}
          />
        </div>
      );
    }

    return (
      <Dashboard 
        initialTab={route.tab || 'general'}
        onTabChange={(tab) => navigate({ type: 'dashboard', tab })}
        onSelectProject={(id) => navigate({ type: 'builder', projectId: id })} 
        onSelectProjectAI={(id) => navigate({ type: 'ai-improver', projectId: id })} 
      />
    );
  };

  return (
    <GlobalLayout currentRoute={route} onNavigate={navigate}>
      {renderCurrentView()}
    </GlobalLayout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
