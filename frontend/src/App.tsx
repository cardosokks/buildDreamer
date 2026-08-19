import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { VisualBuilder } from './components/VisualBuilder';

const MainApp: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400">
        Carregando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onSuccess={() => {}} />;
  }

  if (selectedProjectId) {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <VisualBuilder 
          projectId={selectedProjectId} 
          onBack={() => setSelectedProjectId(null)} 
        />
      </div>
    );
  }

  return <Dashboard onSelectProject={(id) => setSelectedProjectId(id)} />;
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
