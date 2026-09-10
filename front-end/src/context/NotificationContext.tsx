import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Copy, Check } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

export interface BellNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  emoji: string;
  read: boolean;
  createdAt: string;
}

const BELL_KEY = 'bd_bell_notifications';
const MAX_BELL = 40;

function loadBell(): BellNotification[] {
  try {
    const r = localStorage.getItem(BELL_KEY);
    return r ? JSON.parse(r) : [];
  } catch {
    return [];
  }
}

function saveBell(items: BellNotification[]) {
  try {
    localStorage.setItem(BELL_KEY, JSON.stringify(items.slice(0, MAX_BELL)));
  } catch {}
}

interface NotificationContextProps {
  notify: (message: string, type?: NotificationType, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  showErrorDetail: (title: string, message: string) => void;
  removeNotification: (id: string) => void;
  addBellNotification: (n: Omit<BellNotification, 'id' | 'read' | 'createdAt'>) => void;
  markBellRead: (id: string) => void;
  markAllBellRead: () => void;
  removeBellNotification: (id: string) => void;
  clearBell: () => void;
  bellNotifications: BellNotification[];
  unreadBellCount: number;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [bellNotifications, setBellNotifications] = useState<BellNotification[]>(loadBell);
  const [activeErrorDetail, setActiveErrorDetail] = useState<{ title: string; message: string } | null>(null);
  const [copiedError, setCopiedError] = useState(false);

  useEffect(() => {
    saveBell(bellNotifications);
  }, [bellNotifications]);

  const unreadBellCount = bellNotifications.filter(n => !n.read).length;

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  }, []);

  const showErrorDetail = useCallback((title: string, message: string) => {
    setActiveErrorDetail({ title: title || 'Detalhes Completos do Erro', message });
    setCopiedError(false);
  }, []);

  const notify = useCallback((message: string, type: NotificationType = 'info', title?: string, duration = 4500) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setNotifications(prev => [...prev, { id, type, title, message, duration }]);

    if (type === 'error') {
      setBellNotifications(prev => [
        {
          id: `bell_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          type: 'error' as NotificationType,
          title: title || 'Erro no Sistema',
          message: message,
          emoji: '❌',
          read: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ].slice(0, MAX_BELL));
    }

    if (duration > 0) {
      setTimeout(() => removeNotification(id), duration);
    }
  }, [removeNotification]);

  const success = useCallback((m: string, t = 'Sucesso', d = 3500) => notify(m, 'success', t, d), [notify]);
  const error = useCallback((m: string, t = 'Erro', d = 6000) => notify(m, 'error', t, d), [notify]);
  const info = useCallback((m: string, t = 'Informação', d = 3500) => notify(m, 'info', t, d), [notify]);
  const warning = useCallback((m: string, t = 'Atenção', d = 4000) => notify(m, 'warning', t, d), [notify]);

  const addBellNotification = useCallback((notification: Omit<BellNotification, 'id' | 'read' | 'createdAt'>) => {
    const newItem: BellNotification = {
      ...notification,
      id: `bell_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString()
    };
    setBellNotifications(prev => [newItem, ...prev].slice(0, MAX_BELL));
  }, []);

  const markBellRead = useCallback((id: string) => {
    setBellNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllBellRead = useCallback(() => {
    setBellNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const removeBellNotification = useCallback((id: string) => {
    setBellNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearBell = useCallback(() => setBellNotifications([]), []);

  return (
    <NotificationContext.Provider
      value={{
        notify,
        success,
        error,
        info,
        warning,
        showErrorDetail,
        removeNotification,
        addBellNotification,
        markBellRead,
        markAllBellRead,
        removeBellNotification,
        clearBell,
        bellNotifications,
        unreadBellCount
      }}
    >
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {notifications.map((item) => {
          const isS = item.type === 'success';
          const isE = item.type === 'error';
          const isW = item.type === 'warning';
          return (
            <div
              key={item.id}
              onClick={() => {
                if (isE || item.message.length > 80) {
                  showErrorDetail(item.title || 'Detalhes da Notificação', item.message);
                }
              }}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in group cursor-pointer ${
                isS
                  ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:border-emerald-400'
                  : isE
                  ? 'bg-red-950/90 border-red-500/40 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:border-red-400'
                  : isW
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:border-amber-400'
                  : 'bg-slate-900/90 border-purple-500/40 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:border-purple-400'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="mt-0.5 shrink-0">
                  {isS ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isE ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : isW ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Info className="w-4 h-4 text-purple-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {item.title && <h4 className="text-xs font-bold leading-tight mb-0.5 truncate">{item.title}</h4>}
                  <p className="text-[11px] opacity-90 leading-snug break-words line-clamp-3">{item.message}</p>
                  {isE && (
                    <span className="text-[10px] text-red-300/80 font-semibold mt-1 flex items-center gap-1 group-hover:text-red-200">
                      <Copy className="w-3 h-3" /> Clique para ver e copiar o erro completo
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeNotification(item.id);
                }}
                className="p-1 -mr-1 -mt-1 opacity-60 hover:opacity-100 transition-opacity rounded-lg hover:bg-white/10 cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal de Erro Completo para Leitura e Cópia */}
      {activeErrorDetail && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#0f0b1e] border border-red-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950/90 to-slate-900 border-b border-red-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {activeErrorDetail.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Copie a mensagem de erro detalhada abaixo para colar no chat.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveErrorDetail(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
              <div className="relative">
                <textarea
                  readOnly
                  value={activeErrorDetail.message}
                  rows={12}
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs text-red-300 focus:outline-none focus:border-red-500/50 resize-y leading-relaxed select-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 font-mono">
                {activeErrorDetail.message.length} caracteres
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeErrorDetail.message);
                    setCopiedError(true);
                    setTimeout(() => setCopiedError(false), 2000);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {copiedError ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      Copiado com Sucesso!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Erro Completo
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveErrorDetail(null)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextProps => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification deve ser usado dentro de um NotificationProvider');
  return context;
};
