import ngrok from '@ngrok/ngrok';
import { prisma } from '../db';
import http from 'http';

export interface ActiveTunnel {
  projectId: string; // 'global-app' ou ID do projeto
  projectName: string;
  url: string;
  localServer?: http.Server;
  listener?: any;
  startedAt: string;
}

// In-memory active tunnels registry
export const activeNgrokTunnels: Record<string, ActiveTunnel> = {};

// Instância única global de Session do Ngrok reutilizada para evitar erro de limite de conexões simultâneas
let globalNgrokSession: any = null;
let currentSessionToken: string = '';

/**
 * Monta o documento HTML completo de uma página para ser renderizado pelo Ngrok
 */
export function buildFullHtml(page: { name: string; html: string; css: string; js: string; title?: string | null }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title || page.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }
    h1,h2,h3,h4,h5,h6 { font-family: 'Outfit', sans-serif; }
    ${page.css || ''}
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${page.html || ''}
  <script>
    ${page.js || ''}
  </script>
</body>
</html>`;
}

/**
 * Retorna ou cria a sessão global única do Ngrok
 */
async function getOrCreateSession(authtoken: string) {
  if (globalNgrokSession && currentSessionToken === authtoken) {
    return globalNgrokSession;
  }

  if (globalNgrokSession) {
    try {
      await globalNgrokSession.close();
    } catch {}
    globalNgrokSession = null;
  }

  try {
    await ngrok.disconnect();
  } catch {}

  globalNgrokSession = await new ngrok.SessionBuilder()
    .authtoken(authtoken)
    .connect();
  currentSessionToken = authtoken;

  return globalNgrokSession;
}

/**
 * Inicia túnel global do Ngrok para todo o sistema (Dashboard / Prévia Global de todos os projetos)
 * Roteia automaticamente:
 * - / -> Tela de status ou redirecionamento
 * - /preview/:projectId -> Renderiza a Home do projeto
 * - /preview/:projectId/:slug -> Renderiza uma subpágina específica do projeto
 */
export async function startGlobalNgrokTunnel(customAuthtoken?: string): Promise<string> {
  if (activeNgrokTunnels['global-app']?.url) {
    return activeNgrokTunnels['global-app'].url;
  }

  const authtoken = customAuthtoken || process.env.NGROK_AUTHTOKEN;
  if (!authtoken) {
    throw new Error('Token do Ngrok não configurado. Adicione seu NGROK_AUTHTOKEN nas configurações ou no backend.');
  }

  // 1. Cria servidor HTTP local para servir qualquer projeto do sistema
  const localServer = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
      const parts = urlObj.pathname.split('/').filter(Boolean);

      // Ex: /preview/:projectId ou /preview/:projectId/:slug
      if (parts[0] === 'preview' && parts[1]) {
        const projectId = parts[1];
        const pageSlug = (parts[2] || '').replace(/\.html$/i, '');

        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: { pages: true }
        });

        if (!project || !project.pages.length) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(`
            <body style="background:#090410;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
              <h2>Projeto não encontrado</h2>
              <p>O projeto ID ${projectId} não possui páginas cadastradas.</p>
            </body>
          `);
        }

        let targetPage = project.pages.find(p => p.slug === pageSlug);
        if (!targetPage) {
          targetPage = project.pages.find(p => p.isHomepage) || project.pages[0];
        }

        let responseBody = buildFullHtml(targetPage);

        // Reescreve links relativos para manter o preview dentro do túnel Ngrok
        responseBody = responseBody.replace(/href=["']([a-zA-Z0-9-_]+)\.html["']/gi, `href="/preview/${projectId}/$1"`);
        responseBody = responseBody.replace(/href=["']index\.html["']/gi, `href="/preview/${projectId}"`);

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(responseBody, 'utf-8')
        });
        return res.end(responseBody);
      }

      // Root Landing Preview
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <title>buildDreamer Ngrok Live Gateway</title>
        </head>
        <body class="bg-[#090410] text-slate-100 flex items-center justify-center min-h-screen p-6 font-sans">
          <div class="max-w-md w-full bg-slate-900 border border-purple-500/30 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div class="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mx-auto text-xl font-bold">
              ✨
            </div>
            <h1 class="text-xl font-bold text-white">buildDreamer Live Gateway</h1>
            <p class="text-xs text-slate-400">O gateway global do Ngrok está ativo e servindo os previews de todos os seus sites em tempo real.</p>
            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-purple-300 font-mono">
              Status: 🟢 Online
            </div>
          </div>
        </body>
        </html>
      `);
    } catch (e) {
      res.writeHead(500);
      res.end('Erro interno no Gateway Ngrok');
    }
  });

  await new Promise<void>((resolve) => {
    localServer.listen(0, '127.0.0.1', () => resolve());
  });

  const addressInfo = localServer.address() as any;
  const localPort = addressInfo.port;

  // 2. Conecta ao Ngrok
  const session = await getOrCreateSession(authtoken);
  const listener = await session.httpEndpoint().listen();
  await listener.forward(`http://127.0.0.1:${localPort}`);
  const url = listener.url() || '';

  activeNgrokTunnels['global-app'] = {
    projectId: 'global-app',
    projectName: 'Sistema Global',
    url,
    localServer,
    listener,
    startedAt: new Date().toISOString()
  };

  console.log(`[Ngrok Gateway] Túnel global ativo: ${url}`);
  return url;
}

/**
 * Encerra o túnel global ou de um projeto
 */
export async function stopNgrokPreview(projectId: string = 'global-app'): Promise<boolean> {
  const tunnel = activeNgrokTunnels[projectId];
  
  if (tunnel) {
    try {
      if (tunnel.listener?.close) await tunnel.listener.close();
    } catch {}

    try {
      if (tunnel.localServer) tunnel.localServer.close();
    } catch {}

    delete activeNgrokTunnels[projectId];
  }

  if (Object.keys(activeNgrokTunnels).length === 0) {
    if (globalNgrokSession) {
      try {
        await globalNgrokSession.close();
      } catch {}
      globalNgrokSession = null;
    }
    try {
      await ngrok.disconnect();
    } catch {}
  }

  console.log(`[Ngrok Engine] Túnel ${projectId} finalizado.`);
  return true;
}

/**
 * Encerra todos os túneis ativos
 */
export async function stopAllNgrokPreviews(): Promise<void> {
  for (const pid of Object.keys(activeNgrokTunnels)) {
    const tunnel = activeNgrokTunnels[pid];
    try {
      if (tunnel.listener?.close) await tunnel.listener.close();
    } catch {}
    try {
      if (tunnel.localServer) tunnel.localServer.close();
    } catch {}
    delete activeNgrokTunnels[pid];
  }

  if (globalNgrokSession) {
    try {
      await globalNgrokSession.close();
    } catch {}
    globalNgrokSession = null;
  }

  try {
    await ngrok.disconnect();
  } catch {}
}
