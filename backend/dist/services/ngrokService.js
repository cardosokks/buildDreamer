"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemNgrokStatus = getSystemNgrokStatus;
exports.startSystemNgrokTunnelJob = startSystemNgrokTunnelJob;
exports.stopSystemNgrokTunnel = stopSystemNgrokTunnel;
const ngrok_1 = __importDefault(require("@ngrok/ngrok"));
let currentListener = null;
let currentTunnelUrl = null;
let tunnelStartedAt = null;
let currentTarget = 'http://frontend:80';
let tunnelStatus = 'idle';
let lastError = null;
/**
 * Retorna o status atual do túnel do sistema
 */
function getSystemNgrokStatus() {
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
async function startSystemNgrokTunnelJob(customAuthtoken, targetOverride) {
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
            let listener = null;
            let usedTarget = candidateTargets[0];
            for (const target of candidateTargets) {
                try {
                    console.log(`[Ngrok Service] Tentando iniciar túnel para o target: ${target}`);
                    listener = await ngrok_1.default.forward({
                        addr: target,
                        authtoken: authtoken
                    });
                    usedTarget = target;
                    break;
                }
                catch (targetErr) {
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
            }
            else if (listener.url) {
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
        }
        catch (err) {
            console.error('[Ngrok Service] ❌ Erro ao iniciar Ngrok:', err);
            tunnelStatus = 'error';
            lastError = err.message || 'Falha ao conectar no Ngrok';
            currentTunnelUrl = null;
            try {
                await ngrok_1.default.disconnect();
            }
            catch { }
        }
    })();
    return getSystemNgrokStatus();
}
/**
 * Encerra o túnel global do Ngrok
 */
async function stopSystemNgrokTunnel() {
    try {
        if (currentListener) {
            try {
                if (typeof currentListener.close === 'function')
                    await currentListener.close();
            }
            catch { }
            currentListener = null;
        }
        try {
            await ngrok_1.default.disconnect();
        }
        catch { }
    }
    catch (err) {
        console.warn('[Ngrok Service] Aviso ao desconectar:', err);
    }
    currentTunnelUrl = null;
    tunnelStartedAt = null;
    tunnelStatus = 'idle';
    lastError = null;
    console.log('[Ngrok Service] Túnel parado.');
    return true;
}
