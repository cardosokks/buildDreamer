import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

interface NotificationContextProps {
  notify: (message: string, type?: NotificationType, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: NotificationType = 'info', title?: string, duration = 3500) => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newItem: NotificationItem = { id, type, title, message, duration };

      setNotifications((prev) => [...prev, newItem]);

      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  const success = useCallback(
    (message: string, title = 'Sucesso', duration = 3500) => notify(message, 'success', title, duration),
    [notify]
  );

  const error = useCallback(
    (message: string, title = 'Erro', duration = 4500) => notify(message, 'error', title, duration),
    [notify]
  );

  const info = useCallback(
    (message: string, title = 'Informação', duration = 3500) => notify(message, 'info', title, duration),
    [notify]
  );

  const warning = useCallback(
    (message: string, title = 'Atenção', duration = 4000) => notify(message, 'warning', title, duration),
    [notify]
  );

  return (
    <NotificationContext.Provider value={{ notify, success, error, info, warning, removeNotification }}>
      {children}

      {/* Floating Notifications Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {notifications.map((item) => {
          const isSuccess = item.type === 'success';
          const isError = item.type === 'error';
          const isWarning = item.type === 'warning';

          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in ${
                isSuccess
                  ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                  : isError
                  ? 'bg-red-950/90 border-red-500/40 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                  : isWarning
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : 'bg-slate-900/90 border-purple-500/40 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {isSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isError ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Info className="w-4 h-4 text-purple-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {item.title && (
                    <h4 className="text-xs font-bold leading-tight mb-0.5 truncate">{item.title}</h4>
                  )}
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
  if (!context) {
    throw new Error('useNotification deve ser usado dentro de um NotificationProvider');
  }
  return context;
};
