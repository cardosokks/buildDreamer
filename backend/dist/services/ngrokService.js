"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeNgrokTunnels = void 0;
exports.startNgrokPreview = startNgrokPreview;
exports.stopNgrokPreview = stopNgrokPreview;
exports.stopAllNgrokPreviews = stopAllNgrokPreviews;
const ngrok_1 = __importDefault(require("@ngrok/ngrok"));
const db_1 = require("../db");
const http_1 = __importDefault(require("http"));
// In-memory active tunnels registry
exports.activeNgrokTunnels = {};
// In-flight tunnel lock to prevent race conditions on double-click
const tunnelLocks = {};
// Instância única global de Session do Ngrok reutilizada para evitar erro de limite de conexões simultâneas
let globalNgrokSession = null;
let currentSessionToken = '';
/**
 * Monta o documento HTML completo de uma página para ser renderizado pelo Ngrok
 */
function buildFullHtml(page) {
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
async function getOrCreateSession(authtoken) {
    if (globalNgrokSession && currentSessionToken === authtoken) {
        return globalNgrokSession;
    }
    if (globalNgrokSession) {
        try {
            await globalNgrokSession.close();
        }
        catch { }
        globalNgrokSession = null;
    }
    try {
        await ngrok_1.default.disconnect();
    }
    catch { }
    globalNgrokSession = await new ngrok_1.default.SessionBuilder()
        .authtoken(authtoken)
        .connect();
    currentSessionToken = authtoken;
    return globalNgrokSession;
}
/**
 * Inicia um túnel Ngrok para um projeto específico servindo o site completo
 */
async function startNgrokPreview(projectId, customAuthtoken) {
    // Se já houver um túnel ativo para este projeto, retorna a URL imediatamente
    if (exports.activeNgrokTunnels[projectId]?.url) {
        return exports.activeNgrokTunnels[projectId].url;
    }
    // Prevenção de concorrência / duplo clique rápido
    if (tunnelLocks[projectId]) {
        for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (exports.activeNgrokTunnels[projectId]?.url) {
                return exports.activeNgrokTunnels[projectId].url;
            }
        }
    }
    tunnelLocks[projectId] = true;
    try {
        const project = await db_1.prisma.project.findUnique({
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
        // 1. Cria servidor HTTP local dedicado
        const localServer = http_1.default.createServer(async (req, res) => {
            try {
                const freshProject = await db_1.prisma.project.findUnique({
                    where: { id: projectId },
                    include: { pages: true }
                });
                const pages = freshProject?.pages || project.pages;
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
            }
            catch {
                res.writeHead(500);
                res.end('Erro interno');
            }
        });
        await new Promise((resolve) => {
            localServer.listen(0, '127.0.0.1', () => resolve());
        });
        const addressInfo = localServer.address();
        const localPort = addressInfo.port;
        // 2. Conecta ao Ngrok reutilizando a sessão única (evita limite de sessões simultâneas)
        let listener = null;
        let url = '';
        try {
            const session = await getOrCreateSession(authtoken);
            listener = await session.httpEndpoint().listen();
            await listener.forward(`http://127.0.0.1:${localPort}`);
            url = listener.url() || '';
        }
        catch (ngErr) {
            console.warn('[Ngrok Engine] Falha na primeira tentativa, limpando sessões residuais...', ngErr.message);
            // Se houver limite de túneis ou sessão presa, força limpeza e recria
            try {
                await stopAllNgrokPreviews();
            }
            catch { }
            const session = await getOrCreateSession(authtoken);
            listener = await session.httpEndpoint().listen();
            await listener.forward(`http://127.0.0.1:${localPort}`);
            url = listener.url() || '';
        }
        exports.activeNgrokTunnels[projectId] = {
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
    finally {
        delete tunnelLocks[projectId];
    }
}
/**
 * Encerra o túnel Ngrok de um projeto
 */
async function stopNgrokPreview(projectId) {
    const tunnel = exports.activeNgrokTunnels[projectId];
    if (tunnel) {
        try {
            if (tunnel.listener && typeof tunnel.listener.close === 'function') {
                await tunnel.listener.close();
            }
        }
        catch (err) {
            console.warn(`[Ngrok Engine] Erro ao fechar listener:`, err);
        }
        try {
            if (tunnel.localServer) {
                tunnel.localServer.close();
            }
        }
        catch (err) {
            console.warn(`[Ngrok Engine] Erro ao fechar localServer:`, err);
        }
        delete exports.activeNgrokTunnels[projectId];
    }
    // Se não houver mais nenhum túnel ativo, encerra a sessão global do Ngrok
    if (Object.keys(exports.activeNgrokTunnels).length === 0) {
        if (globalNgrokSession) {
            try {
                await globalNgrokSession.close();
            }
            catch { }
            globalNgrokSession = null;
        }
        try {
            await ngrok_1.default.disconnect();
        }
        catch { }
    }
    console.log(`[Ngrok Engine] Túnel do projeto ${projectId} finalizado.`);
    return true;
}
/**
 * Encerra todos os túneis ativos e fecha qualquer sessão presa
 */
async function stopAllNgrokPreviews() {
    for (const projectId of Object.keys(exports.activeNgrokTunnels)) {
        const tunnel = exports.activeNgrokTunnels[projectId];
        try {
            if (tunnel.listener?.close)
                await tunnel.listener.close();
        }
        catch { }
        try {
            if (tunnel.localServer)
                tunnel.localServer.close();
        }
        catch { }
        delete exports.activeNgrokTunnels[projectId];
    }
    if (globalNgrokSession) {
        try {
            await globalNgrokSession.close();
        }
        catch { }
        globalNgrokSession = null;
    }
    try {
        await ngrok_1.default.disconnect();
    }
    catch { }
    console.log(`[Ngrok Engine] Todos os túneis e sessões do Ngrok foram encerrados.`);
}
