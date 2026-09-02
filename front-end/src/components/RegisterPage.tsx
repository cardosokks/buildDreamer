import React, { useState, useEffect } from 'react';
import { API_URL, safeJson } from '../config';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, ArrowRight, ShieldCheck, AlertCircle, Loader2, Flower } from 'lucide-react';

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate floating flowers/petals for creative background animation
  const [petals, setPetals] = useState<Array<{ id: number; x: number; size: number; duration: number; delay: number; rotate: number }>>([]);

  useEffect(() => {
    const items = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.floor(Math.random() * 24) + 16,
      duration: Math.random() * 12 + 8,
      delay: Math.random() * 5,
      rotate: Math.random() * 360,
    }));
    setPetals(items);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Erro ao realizar cadastro');

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#05080e] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      
      {/* Animated Botanical / Flower Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft radial glowing gradients */}
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '8s' }} />

        {/* Floating animated botanical flower particles */}
        {petals.map((p) => (
          <div
            key={p.id}
            className="absolute text-pink-400/20 animate-float"
            style={{
              left: `${p.x}%`,
              bottom: '-10%',
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
              transform: `rotate(${p.rotate}deg)`,
            }}
          >
            <Flower style={{ width: p.size, height: p.size }} />
          </div>
        ))}
      </div>

      {/* Fullscreen No-Card Layout */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-3xl overflow-hidden border border-pink-500/30 bg-slate-900/80 shadow-2xl shadow-pink-500/20 flex items-center justify-center mb-3 ring-4 ring-pink-500/10 backdrop-blur-md">
            <img src="/logo.png" alt="Real Premise" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black tracking-wider text-white">REAL PREMISE</h1>
          <p className="text-xs text-pink-300/80 mt-1 font-mono tracking-widest uppercase">AI Botanical Studio</p>
        </div>

        <div className="w-full mb-5 text-center">
          <h2 className="text-xl font-bold text-white tracking-tight">Criar sua conta</h2>
          <p className="text-xs text-slate-400 mt-1">Preencha os dados abaixo para começar</p>
        </div>

        {error && (
          <div className="w-full mb-5 p-3.5 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-300 text-xs shadow-lg backdrop-blur-md">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Completo</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Seu Nome"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all backdrop-blur-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Profissional</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all backdrop-blur-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Senha (mín. 6 caracteres)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all backdrop-blur-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Confirmar Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all backdrop-blur-md"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-pink-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Criando conta...</span>
              </>
            ) : (
              <>
                <span>Criar Conta no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="w-full mt-6 pt-5 border-t border-slate-900/80 text-center flex flex-col items-center gap-3">
          <p className="text-xs text-slate-400">
            Já possui uma conta?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-pink-400 hover:text-pink-300 font-bold hover:underline cursor-pointer"
            >
              Fazer login
            </button>
          </p>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ambiente seguro e criptografado</span>
          </div>
        </div>

      </div>

      {/* Inline styles for custom floating animation */}
      <style>{`
        @keyframes float {
          0% {
            transform: translateY(0px) rotate(0deg) scale(0.8);
            opacity: 0;
          }
          20% {
            opacity: 0.6;
          }
          80% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-110vh) rotate(360deg) scale(1.2);
            opacity: 0;
          }
        }
        .animate-float {
          animation-name: float;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
};
