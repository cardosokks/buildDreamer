import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  activeNgrokTunnels, 
  startNgrokPreview, 
  stopNgrokPreview 
} from '../services/ngrokService';

const router = Router();

/**
 * Listar todos os túneis Ngrok ativos no momento
 */
router.get('/tunnels', (req: AuthenticatedRequest, res: any) => {
  const tunnels = Object.values(activeNgrokTunnels).map(t => ({
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
router.get('/status/:projectId', (req: AuthenticatedRequest, res: any) => {
  const projectId = req.params.projectId as string;
  const tunnel = activeNgrokTunnels[projectId];

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
router.post('/start/:projectId', async (req: AuthenticatedRequest, res: any) => {
  try {
    const projectId = req.params.projectId as string;
    const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']) as string;

    const url = await startNgrokPreview(projectId, clientAuthtoken);
    return res.json({ success: true, url });
  } catch (err: any) {
    console.error('Erro ao iniciar preview Ngrok:', err);
    return res.status(500).json({ error: err.message || 'Falha ao iniciar túnel Ngrok' });
  }
});

/**
 * Parar preview via Ngrok
 */
router.post('/stop/:projectId', async (req: AuthenticatedRequest, res: any) => {
  try {
    const projectId = req.params.projectId as string;
    const stopped = await stopNgrokPreview(projectId);
    return res.json({ success: true, stopped });
  } catch (err: any) {
    console.error('Erro ao parar preview Ngrok:', err);
    return res.status(500).json({ error: err.message });
  }
});

export const ngrokRouter = router;
