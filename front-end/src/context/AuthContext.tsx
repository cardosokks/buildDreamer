import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'ADMIN' | 'USER' | 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER' | 'SUPPORT';

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: UserRole;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let interceptorInitialized = false;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  // Escuta evento global de desautenticação
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  // Tenta registrar o interceptor global se o ambiente permitir alteração do window.fetch
  useEffect(() => {
    if (interceptorInitialized) return;

    try {
      const originalFetch = window.fetch;
      const wrappedFetch = async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
        
        // Se for uma requisição interna da API e não for login/signup/health
        if (
          (response.status === 401 || response.status === 403) &&
          url.includes('/api/') &&
          !url.includes('/api/auth/login') &&
          !url.includes('/api/auth/signup')
        ) {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        return response;
      };

      const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
      if (!descriptor || descriptor.writable || descriptor.configurable) {
        try {
          (window as any).fetch = wrappedFetch;
          interceptorInitialized = true;
        } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (!storedToken) {
      setLoading(false);
      return;
    }

    if (storedUser) {
      try { setUser(JSON.parse(storedUser)); } catch {}
    }

    // Validar se o token e o usuário ainda existem no banco de dados
    const API_URL = import.meta.env.VITE_API_URL || '';
    fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${storedToken}` }
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setToken(storedToken);
            setUser(data.user);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
          } else {
            logout();
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          // Token expirou ou usuário foi deletado do banco de dados
          logout();
        }
      })
      .catch(() => {
        // Se houver erro de rede, mantém o token armazenado se existia
        setToken(storedToken);
      })
      .finally(() => setLoading(false));
  }, [logout]);

  const refreshToken = async () => {
    if (!token) return;
    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          setToken(data.token);
        }
      } else if (res.status === 401 || res.status === 403) {
        logout();
      }
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(refreshToken, 1000 * 60 * 30); // refresh a cada 30 minutos
    return () => clearInterval(interval);
  }, [token]);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
