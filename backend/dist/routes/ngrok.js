"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ngrokRouter = void 0;
const express_1 = require("express");
const ngrokService_1 = require("../services/ngrokService");
const router = (0, express_1.Router)();
/**
 * Retorna o status do túnel Ngrok global do sistema
 */
router.get('/status', (req, res) => {
    const globalTunnel = ngrokService_1.activeNgrokTunnels['global-app'] || Object.values(ngrokService_1.activeNgrokTunnels)[0];
    if (!globalTunnel) {
        return res.json({ active: false });
    }
    return res.json({
        active: true,
        url: globalTunnel.url,
        startedAt: globalTunnel.startedAt
    });
});
/**
 * Iniciar túnel Ngrok global do sistema
 */
router.post('/start', async (req, res) => {
    try {
        const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']);
        const url = await (0, ngrokService_1.startGlobalNgrokTunnel)(clientAuthtoken);
        return res.json({ success: true, url });
    }
    catch (err) {
        console.error('Erro ao iniciar túnel Ngrok:', err);
        return res.status(500).json({ error: err.message || 'Falha ao iniciar túnel Ngrok' });
    }
});
/**
 * Parar túnel Ngrok global do sistema
 */
router.post('/stop', async (req, res) => {
    try {
        await (0, ngrokService_1.stopAllNgrokPreviews)();
        return res.json({ success: true, stopped: true });
    }
    catch (err) {
        console.error('Erro ao parar túnel Ngrok:', err);
        return res.status(500).json({ error: err.message });
    }
});
/**
 * Compatibilidade com rotas legadas /status/:projectId, /start/:projectId e /stop/:projectId
 */
router.get('/status/:projectId', (req, res) => {
    const projectId = req.params.projectId;
    const globalTunnel = ngrokService_1.activeNgrokTunnels['global-app'] || ngrokService_1.activeNgrokTunnels[projectId];
    if (!globalTunnel) {
        return res.json({ active: false });
    }
    const projectPreviewUrl = `${globalTunnel.url}/preview/${projectId}`;
    return res.json({
        active: true,
        url: projectPreviewUrl,
        globalUrl: globalTunnel.url,
        startedAt: globalTunnel.startedAt
    });
});
router.post('/start/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']);
        const globalUrl = await (0, ngrokService_1.startGlobalNgrokTunnel)(clientAuthtoken);
        const projectPreviewUrl = `${globalUrl}/preview/${projectId}`;
        return res.json({ success: true, url: projectPreviewUrl, globalUrl });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post('/stop/:projectId', async (req, res) => {
    try {
        await (0, ngrokService_1.stopAllNgrokPreviews)();
        return res.json({ success: true, stopped: true });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.ngrokRouter = router;
