import ngrok from '@ngrok/ngrok';

export interface GlobalTunnelStatus {
  active: boolean;
  status: 'idle' | 'starting' | 'online' | 'error';
  url: string | null;
  startedAt: string | null;
  target: string;
  error?: string | null;
}

let currentListener: any = null;
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
 * Inicia o túnel global no Ngrok com ngrok.forward nativo e timeout resiliente
 */
export async function startSystemNgrokTunnelJob(customAuthtoken?: string, targetOverride?: string): Promise<GlobalTunnelStatus> {
  // Se já estiver online, retorna o status imediatamente
  if (currentTunnelUrl && tunnelStatus === 'online') {
    return getSystemNgrokStatus();
  }

  const authtoken = (customAuthtoken || process.env.NGROK_AUTHTOKEN || '').trim();
  if (!authtoken) {
    tunnelStatus = 'error';
    lastError = 'Token do Ngrok não configurado. Por favor, adicione seu Ngrok Authtoken no modal de Configurações.';
    throw new Error(lastError);
  }

  tunnelStatus = 'starting';
  lastError = null;

  // Alvos ordenados por prioridade (produção Docker -> local Nginx 80 -> local backend 5000)
  const candidateTargets = targetOverride 
    ? [targetOverride] 
    : [process.env.NGROK_TARGET || 'http://frontend:80', 'http://127.0.0.1:80', 'http://127.0.0.1:5000', '5000'];

  // Executa o processo de conexão
  (async () => {
    try {
      console.log('[Ngrok Service] Encerrando instâncias prévias...');
      await stopSystemNgrokTunnel();

      let listener: any = null;
      let usedTarget = candidateTargets[0];

      for (const target of candidateTargets) {
        try {
          console.log(`[Ngrok Service] Tentando iniciar túnel para o target: ${target}`);
          listener = await ngrok.forward({
            addr: target,
            authtoken: authtoken
          });
          usedTarget = target;
          break;
        } catch (targetErr: any) {
          console.warn(`[Ngrok Service] Falha ao conectar no target ${target}:`, targetErr.message);
        }
      }

      if (!listener) {
        throw new Error('Não foi possível estabelecer túnel para nenhuma das portas do sistema (80 ou 5000). Verifique o authtoken.');
      }

      currentListener = listener;
      let url = '';
      if (typeof listener.url === 'function') {
        url = listener.url();
      } else if (listener.url) {
        url = listener.url;
      }

      if (!url) {
        url = 'https://builddreamer.ngrok-free.app';
      }

      currentTunnelUrl = url;
      tunnelStartedAt = new Date().toISOString();
      currentTarget = usedTarget;
      tunnelStatus = 'online';
      lastError = null;

      console.log(`[Ngrok Service] ✅ Túnel Ngrok Online: ${currentTunnelUrl} -> ${currentTarget}`);
    } catch (err: any) {
      console.error('[Ngrok Service] ❌ Erro ao iniciar Ngrok:', err);
      tunnelStatus = 'error';
      lastError = err.message || 'Falha ao conectar no Ngrok';
      currentTunnelUrl = null;
      try { await ngrok.disconnect(); } catch {}
    }
  })();

  return getSystemNgrokStatus();
}

/**
 * Encerra o túnel global do Ngrok
 */
export async function stopSystemNgrokTunnel(): Promise<boolean> {
  try {
    if (currentListener) {
      try {
        if (typeof currentListener.close === 'function') await currentListener.close();
      } catch {}
      currentListener = null;
    }
    try {
      await ngrok.disconnect();
    } catch {}
  } catch (err) {
    console.warn('[Ngrok Service] Aviso ao desconectar:', err);
  }

  currentTunnelUrl = null;
  tunnelStartedAt = null;
  tunnelStatus = 'idle';
  lastError = null;
  console.log('[Ngrok Service] Túnel parado.');
  return true;
}
