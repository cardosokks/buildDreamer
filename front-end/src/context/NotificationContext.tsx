import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

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

  useEffect(() => {
    saveBell(bellNotifications);
  }, [bellNotifications]);

  const unreadBellCount = bellNotifications.filter(n => !n.read).length;

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  }, []);

  const notify = useCallback((message: string, type: NotificationType = 'info', title?: string, duration = 3500) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    setNotifications(prev => [...prev, { id, type, title, message, duration }]);
    if (duration > 0) {
      setTimeout(() => removeNotification(id), duration);
    }
  }, [removeNotification]);

  const success = useCallback((m: string, t = 'Sucesso', d = 3500) => notify(m, 'success', t, d), [notify]);
  const error = useCallback((m: string, t = 'Erro', d = 4500) => notify(m, 'error', t, d), [notify]);
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
              className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in ${
                isS
                  ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : isE
                  ? 'bg-red-950/90 border-red-500/40 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                  : isW
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : 'bg-slate-900/90 border-purple-500/40 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
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
                  <p className="text-[11px] opacity-90 leading-snug break-words">{item.message}</p>
                </div>
              </div>
              <button
                onClick={() => removeNotification(item.id)}
                className="p-1 -mr-1 -mt-1 opacity-60 hover:opacity-100 transition-opacity rounded-lg hover:bg-white/10 cursor-pointer"
                title="Fechar notificação"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextProps => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification deve ser usado dentro de um NotificationProvider');
  return context;
};
