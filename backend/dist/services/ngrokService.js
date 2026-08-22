"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemNgrokStatus = getSystemNgrokStatus;
exports.startSystemNgrokTunnel = startSystemNgrokTunnel;
exports.stopSystemNgrokTunnel = stopSystemNgrokTunnel;
const ngrok_1 = __importDefault(require("@ngrok/ngrok"));
let globalNgrokSession = null;
let globalNgrokListener = null;
let currentTunnelUrl = null;
let tunnelStartedAt = null;
let currentTarget = 'http://frontend:80';
/**
 * Retorna o status atual do túnel do sistema
 */
function getSystemNgrokStatus() {
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
async function startSystemNgrokTunnel(customAuthtoken, targetOverride) {
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
        globalNgrokListener = await globalNgrokSession.httpEndpoint().listen();
        try {
            await globalNgrokListener.forward(target);
        }
        catch (fwdErr) {
            // Fallback para localhost caso container frontend não esteja no mesmo host
            console.warn(`[Ngrok] Não foi possível encaminhar para ${target}. Tentando portas locais...`);
            try {
                target = 'http://127.0.0.1:80';
                await globalNgrokListener.forward(target);
            }
            catch {
                try {
                    target = 'http://127.0.0.1:5000';
                    await globalNgrokListener.forward(target);
                }
                catch {
                    target = 'http://localhost:5000';
                    await globalNgrokListener.forward(target);
                }
            }
        }
        let detectedUrl = '';
        try {
            if (typeof globalNgrokListener.url === 'function') {
                detectedUrl = globalNgrokListener.url();
            }
            else if (globalNgrokListener.url) {
                detectedUrl = globalNgrokListener.url;
            }
        }
        catch { }
        if (!detectedUrl && globalNgrokSession) {
            try {
                // Tenta obter endpoint url direto da sessão
                const endpoints = await globalNgrokSession.endpoints?.();
                if (endpoints && endpoints.length > 0) {
                    detectedUrl = endpoints[0].url();
                }
            }
            catch { }
        }
        currentTunnelUrl = detectedUrl || 'https://builddreamer.ngrok-free.app';
        tunnelStartedAt = new Date().toISOString();
        currentTarget = target;
        console.log(`[Ngrok System Gateway] Túnel online com sucesso: ${currentTunnelUrl} -> ${currentTarget}`);
        return currentTunnelUrl;
    }
    catch (err) {
        console.error('[Ngrok System Gateway] Erro ao iniciar túnel:', err);
        await stopSystemNgrokTunnel();
        throw new Error(err.message || 'Falha ao conectar sessão Ngrok');
    }
}
/**
 * Encerra o túnel global do Ngrok
 */
async function stopSystemNgrokTunnel() {
    if (globalNgrokListener) {
        try {
            if (globalNgrokListener.close)
                await globalNgrokListener.close();
        }
        catch { }
        globalNgrokListener = null;
    }
    if (globalNgrokSession) {
        try {
            if (globalNgrokSession.close)
                await globalNgrokSession.close();
        }
        catch { }
        globalNgrokSession = null;
    }
    try {
        await ngrok_1.default.disconnect();
    }
    catch { }
    currentTunnelUrl = null;
    tunnelStartedAt = null;
    console.log('[Ngrok System Gateway] Túnel desconectado com sucesso.');
    return true;
}
