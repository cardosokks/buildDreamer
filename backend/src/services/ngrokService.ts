import ngrok from '@ngrok/ngrok';

export interface GlobalTunnelStatus {
  active: boolean;
  url: string | null;
  startedAt: string | null;
  target: string;
}

let globalNgrokSession: any = null;
let globalNgrokListener: any = null;
let currentTunnelUrl: string | null = null;
let tunnelStartedAt: string | null = null;
let currentTarget: string = 'http://frontend:80';

/**
 * Retorna o status atual do túnel do sistema
 */
export function getSystemNgrokStatus(): GlobalTunnelStatus {
  return {
    active: !!currentTunnelUrl,
    url: currentTunnelUrl,
    startedAt: tunnelStartedAt,
    target: currentTarget
  };
}

/**
 * Inicia o túnel global no Ngrok expondo a aplicação inteira (Frontend + Backend + Previews)
 */
export async function startSystemNgrokTunnel(customAuthtoken?: string, targetOverride?: string): Promise<string> {
  if (currentTunnelUrl) {
    return currentTunnelUrl;
  }

  const authtoken = customAuthtoken || process.env.NGROK_AUTHTOKEN;
  if (!authtoken) {
    throw new Error('Token do Ngrok não configurado. Por favor, adicione seu Ngrok Authtoken nas Configurações.');
  }

  // Define o alvo do túnel:
  // Em produção Docker, o Nginx do frontend roda em 'http://frontend:80' (ou 'http://127.0.0.1:80')
  // No backend local ou fallback, conecta na porta 80 ou na porta do backend
  let target = targetOverride || process.env.NGROK_TARGET || 'http://frontend:80';

  // Se estiver rodando fora do docker ou falhar frontend hostname, testa porta 80 ou 5000
  try {
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
      // Fallback para localhost caso container frontend não esteja no mesmo host
      console.warn(`[Ngrok] Não foi possível encaminhar para ${target}. Tentando portas locais...`);
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
        // Tenta obter endpoint url direto da sessão
        const endpoints = await globalNgrokSession.endpoints?.();
        if (endpoints && endpoints.length > 0) {
          detectedUrl = endpoints[0].url();
        }
      } catch {}
    }

    currentTunnelUrl = detectedUrl || 'https://builddreamer.ngrok-free.app';
    tunnelStartedAt = new Date().toISOString();
    currentTarget = target;

    console.log(`[Ngrok System Gateway] Túnel online com sucesso: ${currentTunnelUrl} -> ${currentTarget}`);
    return currentTunnelUrl;
  } catch (err: any) {
    console.error('[Ngrok System Gateway] Erro ao iniciar túnel:', err);
    await stopSystemNgrokTunnel();
    throw new Error(err.message || 'Falha ao conectar sessão Ngrok');
  }
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
  console.log('[Ngrok System Gateway] Túnel desconectado com sucesso.');
  return true;
}
