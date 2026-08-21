import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  activeNgrokTunnels, 
  startGlobalNgrokTunnel, 
  stopNgrokPreview,
  stopAllNgrokPreviews
} from '../services/ngrokService';

const router = Router();

/**
 * Retorna o status do túnel Ngrok global do sistema
 */
router.get('/status', (req: AuthenticatedRequest, res: any) => {
  const globalTunnel = activeNgrokTunnels['global-app'] || Object.values(activeNgrokTunnels)[0];

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
router.post('/start', async (req: AuthenticatedRequest, res: any) => {
  try {
    const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']) as string;
    const url = await startGlobalNgrokTunnel(clientAuthtoken);
    return res.json({ success: true, url });
  } catch (err: any) {
    console.error('Erro ao iniciar túnel Ngrok:', err);
    return res.status(500).json({ error: err.message || 'Falha ao iniciar túnel Ngrok' });
  }
});

/**
 * Parar túnel Ngrok global do sistema
 */
router.post('/stop', async (req: AuthenticatedRequest, res: any) => {
  try {
    await stopAllNgrokPreviews();
    return res.json({ success: true, stopped: true });
  } catch (err: any) {
    console.error('Erro ao parar túnel Ngrok:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Compatibilidade com rotas legadas /status/:projectId, /start/:projectId e /stop/:projectId
 */
router.get('/status/:projectId', (req: AuthenticatedRequest, res: any) => {
  const projectId = req.params.projectId as string;
  const globalTunnel = activeNgrokTunnels['global-app'] || activeNgrokTunnels[projectId];

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

router.post('/start/:projectId', async (req: AuthenticatedRequest, res: any) => {
  try {
    const projectId = req.params.projectId as string;
    const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']) as string;
    const globalUrl = await startGlobalNgrokTunnel(clientAuthtoken);
    const projectPreviewUrl = `${globalUrl}/preview/${projectId}`;
    return res.json({ success: true, url: projectPreviewUrl, globalUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/stop/:projectId', async (req: AuthenticatedRequest, res: any) => {
  try {
    await stopAllNgrokPreviews();
    return res.json({ success: true, stopped: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export const ngrokRouter = router;
