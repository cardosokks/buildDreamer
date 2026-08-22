import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, Mail, User, ShieldAlert, Sun, Moon } from 'lucide-react';
import { API_URL } from '../config';

interface AuthPageProps {
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = isLogin 
      ? `${API_URL}/api/auth/login`
      : `${API_URL}/api/auth/signup`;

    const body = isLogin 
      ? { email, password } 
      : { email, password, name };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Algo deu errado');
      }

      login(data.token, data.user);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center px-4 font-sans relative transition-colors duration-200 ${
      theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0c10] text-slate-100'
    }`}>
      {/* Botão de Tema no Canto Superior */}
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
            : 'bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800'
        }`}
        title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
      </button>

      <div className={`w-full max-w-md border rounded-2xl p-8 shadow-2xl backdrop-blur-md transition-colors duration-200 ${
        theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0f1117] border-slate-800'
      }`}>
        
        {/* Header / Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-amber-500/50 p-1 mb-4 shadow-[0_0_20px_rgba(229,185,95,0.4)] bg-black/40 flex items-center justify-center">
            <img src="/logo.png" alt="Real Premise" className="w-full h-full object-cover rounded-full" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-widest bg-gradient-to-r from-amber-300 via-rose-300 to-amber-400 bg-clip-text text-transparent">
            REAL PREMISE
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            {isLogin 
              ? 'Entre para acessar seu estúdio e gerenciar seus clientes.' 
              : 'Comece a construir sites de alta performance em minutos.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-200 text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm text-white placeholder-slate-600"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="email"
                required
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm text-white placeholder-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm text-white placeholder-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 disabled:bg-purple-900/50 text-white font-semibold rounded-xl transition-all flex items-center justify-center text-sm shadow-[0_0_15px_rgba(168,85,247,0.35)] hover:shadow-[0_0_20px_rgba(168,85,247,0.55)] cursor-pointer"
          >
            {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-8 pt-6 border-t border-slate-800/60 text-sm text-slate-400">
          {isLogin ? 'Novo por aqui?' : 'Já possui uma conta?'} {' '}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-purple-400 hover:text-purple-300 font-semibold focus:outline-none transition-colors cursor-pointer"
          >
            {isLogin ? 'Crie uma conta' : 'Acesse sua conta'}
          </button>
        </div>

      </div>
    </div>
  );
};
