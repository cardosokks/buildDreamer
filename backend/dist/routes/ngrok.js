"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ngrokRouter = void 0;
const express_1 = require("express");
const ngrokService_1 = require("../services/ngrokService");
const router = (0, express_1.Router)();
/**
 * Listar todos os túneis Ngrok ativos no momento
 */
router.get('/tunnels', (req, res) => {
    const tunnels = Object.values(ngrokService_1.activeNgrokTunnels).map(t => ({
        projectId: t.projectId,
        projectName: t.projectName,
        url: t.url,
        startedAt: t.startedAt
    }));
    return res.json({ tunnels });
});
/**
 * Consultar status do túnel Ngrok de um projeto específico
 */
router.get('/status/:projectId', (req, res) => {
    const projectId = req.params.projectId;
    const tunnel = ngrokService_1.activeNgrokTunnels[projectId];
    if (!tunnel) {
        return res.json({ active: false });
    }
    return res.json({
        active: true,
        url: tunnel.url,
        projectName: tunnel.projectName,
        startedAt: tunnel.startedAt
    });
});
/**
 * Iniciar preview via Ngrok
 */
router.post('/start/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']);
        const url = await (0, ngrokService_1.startNgrokPreview)(projectId, clientAuthtoken);
        return res.json({ success: true, url });
    }
    catch (err) {
        console.error('Erro ao iniciar preview Ngrok:', err);
        return res.status(500).json({ error: err.message || 'Falha ao iniciar túnel Ngrok' });
    }
});
/**
 * Parar preview via Ngrok
 */
router.post('/stop/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const stopped = await (0, ngrokService_1.stopNgrokPreview)(projectId);
        return res.json({ success: true, stopped });
    }
    catch (err) {
        console.error('Erro ao parar preview Ngrok:', err);
        return res.status(500).json({ error: err.message });
    }
});
exports.ngrokRouter = router;
