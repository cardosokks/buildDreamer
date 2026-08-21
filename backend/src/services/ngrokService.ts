import ngrok from '@ngrok/ngrok';
import { prisma } from '../db';
import http from 'http';

export interface ActiveTunnel {
  projectId: string;
  projectName: string;
  url: string;
  localServer: http.Server;
  listener: any;
  startedAt: string;
}

// In-memory active tunnels registry
export const activeNgrokTunnels: Record<string, ActiveTunnel> = {};

/**
 * Monta o documento HTML completo de uma página para ser renderizado pelo Ngrok
 */
function buildFullHtml(page: { name: string; html: string; css: string; js: string; title?: string | null }) {
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
 * Inicia um túnel Ngrok para um projeto específico servindo o site completo
 */
export async function startNgrokPreview(projectId: string, customAuthtoken?: string): Promise<string> {
  // Se já houver um túnel ativo para este projeto, encerra o anterior antes
  if (activeNgrokTunnels[projectId]) {
    await stopNgrokPreview(projectId);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { pages: true }
  });

  if (!project) {
    throw new Error('Projeto não encontrado');
  }

  const authtoken = customAuthtoken || process.env.NGROK_AUTHTOKEN;
  if (!authtoken) {
    throw new Error('Token do Ngrok não configurado. Adicione seu NGROK_AUTHTOKEN nas configurações ou no backend.');
  }

  // 1. Cria um mini servidor HTTP local dedicado para servir as páginas do projeto em tempo real
  const localServer = http.createServer(async (req, res) => {
    try {
      const freshProject = await prisma.project.findUnique({
        where: { id: projectId },
        include: { pages: true }
      });

      const pages = freshProject?.pages || project.pages;
      
      // Determina a página solicitada pela rota (ex: /servicos -> slug: 'servicos')
      const reqPath = (req.url || '/').replace(/^\//, '').split('?')[0];
      let targetPage = pages.find(p => p.slug === reqPath);
      if (!targetPage) {
        targetPage = pages.find(p => p.isHomepage) || pages[0];
      }

      const responseBody = buildFullHtml(targetPage);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(responseBody, 'utf-8')
      });
      res.end(responseBody);
    } catch {
      res.writeHead(500);
      res.end('Erro interno no servidor de preview');
    }
  });

  // Inicia o servidor local em uma porta dinâmica livre
  await new Promise<void>((resolve) => {
    localServer.listen(0, '127.0.0.1', () => resolve());
  });

  const addressInfo = localServer.address() as any;
  const localPort = addressInfo.port;

  // 2. Conecta o Ngrok apontando para a porta do servidor local
  const session = await new ngrok.SessionBuilder()
    .authtoken(authtoken)
    .connect();

  const listener = await session.httpEndpoint().listen();
  await listener.forward(`http://127.0.0.1:${localPort}`);
  const url = listener.url() || '';

  activeNgrokTunnels[projectId] = {
    projectId,
    projectName: project.name,
    url,
    localServer,
    listener,
    startedAt: new Date().toISOString()
  };

  console.log(`[Ngrok Engine] Preview online para "${project.name}": ${url}`);
  return url;
}

/**
 * Encerra o túnel Ngrok de um projeto
 */
export async function stopNgrokPreview(projectId: string): Promise<boolean> {
  const tunnel = activeNgrokTunnels[projectId];
  if (!tunnel) return false;

  try {
    if (tunnel.listener && typeof tunnel.listener.close === 'function') {
      await tunnel.listener.close();
    }
  } catch (err) {
    console.error(`[Ngrok Engine] Erro ao fechar listener do projeto ${projectId}:`, err);
  }

  try {
    if (tunnel.localServer) {
      tunnel.localServer.close();
    }
  } catch (err) {
    console.error(`[Ngrok Engine] Erro ao fechar servidor local do projeto ${projectId}:`, err);
  }

  delete activeNgrokTunnels[projectId];
  console.log(`[Ngrok Engine] Túnel do projeto ${projectId} finalizado.`);
  return true;
}

/**
 * Encerra todos os túneis ativos
 */
export async function stopAllNgrokPreviews(): Promise<void> {
  for (const projectId of Object.keys(activeNgrokTunnels)) {
    await stopNgrokPreview(projectId);
  }
}
