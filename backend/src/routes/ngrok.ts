import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  getSystemNgrokStatus, 
  startSystemNgrokTunnel, 
  stopSystemNgrokTunnel 
} from '../services/ngrokService';

const router = Router();

/**
 * Consulta o status do túnel Ngrok global do sistema
 */
router.get('/status', (req: AuthenticatedRequest, res: any) => {
  const status = getSystemNgrokStatus();
  return res.json(status);
});

/**
 * Inicia o túnel Ngrok do sistema
 */
router.post('/start', async (req: AuthenticatedRequest, res: any) => {
  try {
    const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']) as string;
    const { target } = req.body || {};
    const url = await startSystemNgrokTunnel(clientAuthtoken, target);
    return res.json({ success: true, url, active: true });
  } catch (err: any) {
    console.error('Erro ao iniciar Ngrok no sistema:', err);
    return res.status(500).json({ error: err.message || 'Falha ao iniciar Ngrok' });
  }
});

/**
 * Para o túnel Ngrok do sistema
 */
router.post('/stop', async (req: AuthenticatedRequest, res: any) => {
  try {
    await stopSystemNgrokTunnel();
    return res.json({ success: true, active: false });
  } catch (err: any) {
    console.error('Erro ao parar Ngrok:', err);
    return res.status(500).json({ error: err.message });
  }
});

export const ngrokRouter = router;
