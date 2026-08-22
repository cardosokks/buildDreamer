"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ngrokRouter = void 0;
const express_1 = require("express");
const ngrokService_1 = require("../services/ngrokService");
const router = (0, express_1.Router)();
/**
 * Consulta o status do túnel Ngrok global do sistema
 */
router.get('/status', (req, res) => {
    const status = (0, ngrokService_1.getSystemNgrokStatus)();
    return res.json(status);
});
/**
 * Inicia o túnel Ngrok do sistema
 */
router.post('/start', async (req, res) => {
    try {
        const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']);
        const { target } = req.body || {};
        const url = await (0, ngrokService_1.startSystemNgrokTunnel)(clientAuthtoken, target);
        return res.json({ success: true, url, active: true });
    }
    catch (err) {
        console.error('Erro ao iniciar Ngrok no sistema:', err);
        return res.status(500).json({ error: err.message || 'Falha ao iniciar Ngrok' });
    }
});
/**
 * Para o túnel Ngrok do sistema
 */
router.post('/stop', async (req, res) => {
    try {
        await (0, ngrokService_1.stopSystemNgrokTunnel)();
        return res.json({ success: true, active: false });
    }
    catch (err) {
        console.error('Erro ao parar Ngrok:', err);
        return res.status(500).json({ error: err.message });
    }
});
exports.ngrokRouter = router;
