"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
 * Parar preview via Ngrok de um projeto específico
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
/**
 * Parar e liberar todos os túneis Ngrok presos
 */
router.post('/stop-all', async (req, res) => {
    try {
        const { stopAllNgrokPreviews } = await Promise.resolve().then(() => __importStar(require('../services/ngrokService')));
        await stopAllNgrokPreviews();
        return res.json({ success: true, message: 'Todos os túneis foram liberados com sucesso!' });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.ngrokRouter = router;
