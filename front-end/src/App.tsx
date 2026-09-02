import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { VisualBuilder } from './components/VisualBuilder';
import { AIImprover } from './components/AIImprover';

export interface AppRoute {
  type: 'dashboard' | 'builder' | 'ai-improver' | 'auth';
  tab?: 'general' | 'projects' | 'crm' | 'leads' | 'saved-leads' | 'presets' | 'settings' | 'users';
  projectId?: string;
}

// Parse current window URL into state
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
  
  if (path === '/projects') return { type: 'dashboard', tab: 'projects' };
  if (path === '/crm') return { type: 'dashboard', tab: 'crm' };
  if (path === '/leads') return { type: 'dashboard', tab: 'leads' };
  if (path === '/saved-leads') return { type: 'dashboard', tab: 'saved-leads' };
  if (path === '/presets') return { type: 'dashboard', tab: 'presets' };
  if (path === '/settings') return { type: 'dashboard', tab: 'settings' };
  if (path === '/users') return { type: 'dashboard', tab: 'users' };
  if (path === '/auth') return { type: 'auth' };

  return { type: 'dashboard', tab: 'general' };
};

const MainApp: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [route, setRoute] = useState<AppRoute>(parseUrlToRoute);

  // Sync route on browser navigation (Back/Forward buttons)
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

  // Update browser URL
  const navigate = (newRoute: AppRoute) => {
    let url = '/';
    if (newRoute.type === 'builder' && newRoute.projectId) {
      url = `/builder/${newRoute.projectId}`;
    } else if (newRoute.type === 'ai-improver' && newRoute.projectId) {
      url = `/ai-improver/${newRoute.projectId}`;
    } else if (newRoute.type === 'dashboard') {
      if (newRoute.tab === 'projects') url = '/projects';
      else if (newRoute.tab === 'crm') url = '/crm';
      else if (newRoute.tab === 'leads') url = '/leads';
      else if (newRoute.tab === 'saved-leads') url = '/saved-leads';
      else if (newRoute.tab === 'presets') url = '/presets';
      else if (newRoute.tab === 'settings') url = '/settings';
      else if (newRoute.tab === 'users') url = '/users';
      else url = '/';
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

  if (!isAuthenticated) {
    return (
      <AuthPage
        onSuccess={() => {
          navigate({ type: 'dashboard', tab: 'general' });
        }}
      />
    );
  }

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

import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';

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
