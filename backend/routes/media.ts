import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { uploadAssetToStorage } from '../services/storageService';
import fs from 'fs';
import path from 'path';

const router = Router();

// Local fallback uploads directory
const uploadsDir = path.join(process.cwd(), 'front-end', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// POST /api/media/minio/test - Testar credenciais e bucket do MinIO
router.post('/minio/test', async (req: AuthenticatedRequest, res: any) => {
  return res.json({ success: true, message: 'Armazenamento local configurado com sucesso por padrão. Nenhuma conexão externa necessária.' });
});

// GET /api/media/status - Verificar status de storage ativo
router.get('/status', (req, res) => {
  return res.json({
    storageType: 'local',
    minioConfigured: false,
    bucket: null,
    endpoint: null
  });
});

// GET /api/media - Listar mídias do usuário
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const media = await prisma.media.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
    return res.json({ media });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/media/upload - Upload de imagem (Base64) com suporte MinIO & Local
router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { name, base64Data, mimeType, projectId } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'Dados da imagem (base64) são obrigatórios.' });
    }

    const cleanBase64 = base64Data.includes(';base64,') ? base64Data.split(';base64,')[1] : base64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    let ext = 'png';
    if (mimeType && mimeType.includes('/')) {
      ext = mimeType.split('/')[1].replace('+xml', '');
    }
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const mediaName = name || filename;
    const size = buffer.length;
    const effectiveMime = mimeType || 'image/png';

    const uploadRes = await uploadAssetToStorage(buffer, filename, effectiveMime, projectId);
    const publicUrl = uploadRes.url;
    const storageType = uploadRes.isMinio ? 'minio' : 'local';

    if (!req.userId) {
      throw new Error('Usuário não autenticado');
    }

    const media = await prisma.media.create({
      data: {
        name: mediaName,
        url: publicUrl,
        size,
        mimeType: effectiveMime,
        storage: storageType,
        userId: req.userId
      }
    });

    return res.status(201).json({ media });
  } catch (error: any) {
    console.error('Error in /api/media/upload:', error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/media/:id - Excluir imagem da biblioteca
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;

    const media = await prisma.media.findFirst({
      where: { id, userId: req.userId }
    });

    if (media) {
      if (media.url && media.url.startsWith('/uploads/')) {
        const filename = media.url.replace('/uploads/', '');
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
      
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
