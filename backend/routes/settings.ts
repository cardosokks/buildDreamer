import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const CONFIG_PATH = path.join(process.cwd(), 'backend', 'data', 'minio_config.json');

router.get('/minio', authenticateToken, (req, res) => {
  if (fs.existsSync(CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    res.json(config);
  } else {
    res.json({});
  }
});

router.post('/minio', authenticateToken, (req, res) => {
  const newConfig = req.body;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  // Em um caso real, precisaríamos avisar o storageService para recarregar o cliente
  res.json({ success: true });
});

export default router;
