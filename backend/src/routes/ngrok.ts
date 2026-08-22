import { Router } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  getSystemNgrokStatus, 
  startSystemNgrokTunnelJob, 
  stopSystemNgrokTunnel 
} from '../services/ngrokService';

const router = Router();

/**
 * Consulta o status em tempo real do job e do túnel Ngrok global do sistema
 */
router.get('/status', (req: AuthenticatedRequest, res: any) => {
  const status = getSystemNgrokStatus();
  return res.json(status);
});

/**
 * Inicia o job de conexão do Ngrok em background
 */
router.post('/start', async (req: AuthenticatedRequest, res: any) => {
  try {
    const clientAuthtoken = (req.headers['x-ngrok-token'] || req.headers['X-Ngrok-Token']) as string;
    const { target } = req.body || {};
    const status = await startSystemNgrokTunnelJob(clientAuthtoken, target);
    return res.json(status);
  } catch (err: any) {
    console.error('Erro ao disparar job do Ngrok:', err);
    return res.status(500).json({ error: err.message || 'Falha ao iniciar job do Ngrok' });
  }
});

/**
 * Para o túnel Ngrok do sistema
 */
router.post('/stop', async (req: AuthenticatedRequest, res: any) => {
  try {
    await stopSystemNgrokTunnel();
    return res.json({ success: true, active: false, status: 'idle' });
  } catch (err: any) {
    console.error('Erro ao parar Ngrok:', err);
    return res.status(500).json({ error: err.message });
  }
});

export const ngrokRouter = router;
