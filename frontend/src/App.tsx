import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { VisualBuilder } from './components/VisualBuilder';

export interface AppRoute {
  type: 'dashboard' | 'builder' | 'auth';
  tab?: 'general' | 'projects' | 'leads' | 'saved-leads' | 'presets' | 'tunnels';
  projectId?: string;
}

// Parse current window URL into state
const parseUrlToRoute = (): AppRoute => {
  const path = window.location.pathname;
  
  if (path.startsWith('/builder/')) {
    const projectId = path.replace('/builder/', '').split('/')[0];
    if (projectId) return { type: 'builder', projectId };
  }
  
  if (path === '/projects') return { type: 'dashboard', tab: 'projects' };
  if (path === '/leads') return { type: 'dashboard', tab: 'leads' };
  if (path === '/saved-leads') return { type: 'dashboard', tab: 'saved-leads' };
  if (path === '/presets') return { type: 'dashboard', tab: 'presets' };
  if (path === '/tunnels') return { type: 'dashboard', tab: 'tunnels' };
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

  // Update browser URL
  const navigate = (newRoute: AppRoute) => {
    let url = '/';
    if (newRoute.type === 'builder' && newRoute.projectId) {
      url = `/builder/${newRoute.projectId}`;
    } else if (newRoute.type === 'dashboard') {
      if (newRoute.tab === 'projects') url = '/projects';
      else if (newRoute.tab === 'leads') url = '/leads';
      else if (newRoute.tab === 'saved-leads') url = '/saved-leads';
      else if (newRoute.tab === 'presets') url = '/presets';
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
      <div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400 font-mono text-xs">
        Carregando sessão...
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
        />
      </div>
    );
  }

  return (
    <Dashboard 
      initialTab={route.tab || 'general'}
      onTabChange={(tab) => navigate({ type: 'dashboard', tab })}
      onSelectProject={(id) => navigate({ type: 'builder', projectId: id })} 
    />
  );
};

import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
