import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { uploadAssetToStorage, getAssetStream, isMinioAvailable, saveMinioConfig, testMinioConnection, loadConfig } from '../services/storageService';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET /api/media/files/* - Route to fetch a file from MinIO locally and stream to the browser
router.get('/files/*', async (req, res) => {
  try {
    const objectName = req.params[0];
    if (!objectName) {
      return res.status(400).send('Bad Request: Object name is required');
    }
    
    // Configura os headers baseados na extensão do arquivo
    const ext = objectName.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'svg') contentType = 'image/svg+xml';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'mp4') contentType = 'video/mp4';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // cache for 1 year
    
    const stream = await getAssetStream(objectName);
    stream.pipe(res);
  } catch (error: any) {
    console.error(`[MinIO Proxy Error] Falha ao buscar arquivo ${req.params[0]}:`, error.message);
    res.status(404).send('Not Found');
  }
});

// GET /api/media/status - Verificar status do MinIO
router.get('/status', async (req, res) => {
  const minioActive = isMinioAvailable();
  const config = loadConfig();
  const configPath = path.join(process.cwd(), 'backend', 'data', 'minio_config.json');
  let hasConfig = false;
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      hasConfig = !!cfg.endpoint;
    } catch {}
  }
  return res.json({
    storageType: minioActive ? 'minio' : 'local',
    minioConfigured: hasConfig || !!(process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY),
    minioAvailable: minioActive,
    bucket: config.bucket
  });
});

// GET /api/media/config - Obter configurações do MinIO
router.get('/config', authenticateToken, async (req, res) => {
  const configPath = path.join(process.cwd(), 'backend', 'data', 'minio_config.json');
  let config = {
    endpoint: process.env.MINIO_ENDPOINT || '',
    port: process.env.MINIO_PORT || '9000',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
    bucket: process.env.MINIO_BUCKET || 'builddreamer-assets',
    publicUrl: process.env.MINIO_PUBLIC_URL || ''
  };

  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = { ...config, ...fileConfig };
    } catch {}
  }

  return res.json({ config, isAvailable: isMinioAvailable() });
});

// POST /api/media/config - Salvar configurações do MinIO
router.post('/config', authenticateToken, async (req, res) => {
  try {
    const { endpoint, port, useSSL, accessKey, secretKey, bucket, publicUrl } = req.body;
    const configToSave = {
      endpoint: endpoint || '',
      port: port || '9000',
      useSSL: !!useSSL,
      accessKey: accessKey || '',
      secretKey: secretKey || '',
      bucket: bucket || 'builddreamer-assets',
      publicUrl: publicUrl || ''
    };
    saveMinioConfig(configToSave);
    return res.json({ message: 'Configurações do MinIO salvas com sucesso!', isAvailable: isMinioAvailable() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/media/test-connection - Testar conexão com MinIO
router.post('/test-connection', authenticateToken, async (req, res) => {
  try {
    const result = await testMinioConnection(req.body);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/media - Listar mídias do usuário (com filtro opcional por projeto)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { projectId } = req.query;
    const media = await prisma.media.findMany({
      where: { 
        userId: req.userId,
        // Se projectId for passado, filtra por ele (isso requer que a tabela Media tenha um campo projectId, mas o schema atual não tem. Vou ignorar o filtro de banco de dados se não existir a coluna).
        // Vou assumir que por enquanto vamos apenas listar tudo.
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
    return res.json({ media });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/media/upload - Upload de imagem (Base64) para MinIO
router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { name, base64Data, mimeType, projectId } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'Dados da imagem (base64) são obrigatórios.' });
    }

    const cleanBase64 = base64Data.includes(';base64,') ? base64Data.split(';base64,')[1] : base64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Usa o nome original ou gera um padrão baseado no timestamp para evitar colisões totais no upload
    const originalName = name || `upload_${Date.now()}`;
    const size = buffer.length;
    const effectiveMime = mimeType || 'image/png';

    const uploadRes = await uploadAssetToStorage(buffer, originalName, effectiveMime, projectId);
    
    if (!req.userId) {
      throw new Error('Usuário não autenticado');
    }

    const media = await prisma.media.create({
      data: {
        name: originalName,
        url: uploadRes.url,
        size,
        mimeType: effectiveMime,
        storage: uploadRes.isMinio ? 'minio' : 'local',
        userId: req.userId
      }
    });

    return res.status(201).json({ media });
  } catch (error: any) {
    console.error('Error in /api/media/upload:', error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/media/:id - Excluir imagem
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findFirst({
      where: { id, userId: req.userId }
    });

    if (media) {
      await prisma.media.delete({
        where: { id }
      });
    }

    return res.json({ success: true, id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/media/batch-delete - Excluir múltiplas mídias
router.post('/batch-delete', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Lista de IDs inválida.' });
    }
    await prisma.media.deleteMany({
      where: {
        id: { in: ids },
        userId: req.userId
      }
    });
    return res.json({ success: true, count: ids.length });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/media/files/* - Servir arquivos (Proxy para MinIO ou Local)
router.get('/files/*', async (req, res) => {
  try {
    const objectName = req.params[0];
    const stream = await getAssetStream(objectName);
    
    // Tenta inferir o content-type pela extensão
    const ext = path.extname(objectName).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.pdf': 'application/pdf'
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
    
    // Cache de 1 dia para mídias
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    (stream as any).pipe(res);
  } catch (error: any) {
    console.error(`[Media Proxy] Erro ao servir ${req.params[0]}:`, error.message);
    res.status(404).send('Arquivo não encontrado');
  }
});

export default router;
