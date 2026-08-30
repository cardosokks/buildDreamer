import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { uploadAssetToStorage } from '../services/storageService';

const router = Router();

// GET /api/media/status - Verificar status do MinIO
router.get('/status', async (req, res) => {
  return res.json({
    storageType: 'minio',
    minioConfigured: !!(process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY),
    bucket: process.env.MINIO_BUCKET
  });
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
        storage: 'minio',
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

export default router;
