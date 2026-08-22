import ngrok from '@ngrok/ngrok';

export interface GlobalTunnelStatus {
  active: boolean;
  status: 'idle' | 'starting' | 'online' | 'error';
  url: string | null;
  startedAt: string | null;
  target: string;
  error?: string | null;
}

let globalNgrokSession: any = null;
let globalNgrokListener: any = null;
let currentTunnelUrl: string | null = null;
let tunnelStartedAt: string | null = null;
let currentTarget: string = 'http://frontend:80';
let tunnelStatus: 'idle' | 'starting' | 'online' | 'error' = 'idle';
let lastError: string | null = null;

/**
 * Retorna o status atual do túnel do sistema
 */
export function getSystemNgrokStatus(): GlobalTunnelStatus {
  return {
    active: !!currentTunnelUrl && tunnelStatus === 'online',
    status: tunnelStatus,
    url: currentTunnelUrl,
    startedAt: tunnelStartedAt,
    target: currentTarget,
    error: lastError
  };
}

/**
 * Inicia o túnel global no Ngrok assincronamente em formato de background job
 */
export function startSystemNgrokTunnelJob(customAuthtoken?: string, targetOverride?: string): Promise<GlobalTunnelStatus> {
  // Se já estiver online, retorna o status imediatamente
  if (currentTunnelUrl && tunnelStatus === 'online') {
    return Promise.resolve(getSystemNgrokStatus());
  }

  tunnelStatus = 'starting';
  lastError = null;

  const authtoken = customAuthtoken || process.env.NGROK_AUTHTOKEN;
  if (!authtoken) {
    tunnelStatus = 'error';
    lastError = 'Token do Ngrok não configurado. Adicione seu Ngrok Authtoken nas Configurações.';
    return Promise.reject(new Error(lastError));
  }

  let target = targetOverride || process.env.NGROK_TARGET || 'http://frontend:80';

  // Execução do job de conexão em background
  (async () => {
    try {
      console.log('[Ngrok Job] Iniciando conexão com Ngrok...');
      
      if (globalNgrokSession) {
        try { await globalNgrokSession.close(); } catch {}
        globalNgrokSession = null;
      }
      try { await ngrok.disconnect(); } catch {}

      globalNgrokSession = await new ngrok.SessionBuilder()
        .authtoken(authtoken)
        .connect();

      globalNgrokListener = await globalNgrokSession.httpEndpoint().listen();

      try {
        await globalNgrokListener.forward(target);
      } catch (fwdErr) {
        console.warn(`[Ngrok Job] Falha ao encaminhar para ${target}. Tentando portas locais alternativas...`);
        try {
          target = 'http://127.0.0.1:80';
          await globalNgrokListener.forward(target);
        } catch {
          try {
            target = 'http://127.0.0.1:5000';
            await globalNgrokListener.forward(target);
          } catch {
            target = 'http://localhost:5000';
            await globalNgrokListener.forward(target);
          }
        }
      }

      let detectedUrl = '';
      try {
        if (typeof globalNgrokListener.url === 'function') {
          detectedUrl = globalNgrokListener.url();
        } else if (globalNgrokListener.url) {
          detectedUrl = globalNgrokListener.url;
        }
      } catch {}

      if (!detectedUrl && globalNgrokSession) {
        try {
          const endpoints = await globalNgrokSession.endpoints?.();
          if (endpoints && endpoints.length > 0) {
            detectedUrl = typeof endpoints[0].url === 'function' ? endpoints[0].url() : endpoints[0].url;
          }
        } catch {}
      }

      currentTunnelUrl = detectedUrl || 'https://builddreamer.ngrok-free.app';
      tunnelStartedAt = new Date().toISOString();
      currentTarget = target;
      tunnelStatus = 'online';
      lastError = null;

      console.log(`[Ngrok Job] Túnel conectado com sucesso! URL pública: ${currentTunnelUrl} -> ${currentTarget}`);
    } catch (err: any) {
      console.error('[Ngrok Job] Erro na execução do job do Ngrok:', err);
      tunnelStatus = 'error';
      lastError = err.message || 'Falha ao conectar sessão Ngrok';
      currentTunnelUrl = null;
      await stopSystemNgrokTunnel();
    }
  })();

  return Promise.resolve(getSystemNgrokStatus());
}

/**
 * Encerra o túnel global do Ngrok
 */
export async function stopSystemNgrokTunnel(): Promise<boolean> {
  if (globalNgrokListener) {
    try {
      if (globalNgrokListener.close) await globalNgrokListener.close();
    } catch {}
    globalNgrokListener = null;
  }

  if (globalNgrokSession) {
    try {
      if (globalNgrokSession.close) await globalNgrokSession.close();
    } catch {}
    globalNgrokSession = null;
  }

  try {
    await ngrok.disconnect();
  } catch {}

  currentTunnelUrl = null;
  tunnelStartedAt = null;
  tunnelStatus = 'idle';
  lastError = null;
  console.log('[Ngrok Job] Túnel desconectado.');
  return true;
}
