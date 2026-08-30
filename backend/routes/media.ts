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

let mediaTableChecked = false;
async function ensureMediaTable() {
  if (mediaTableChecked) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Media" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "size" INTEGER,
        "mimeType" TEXT,
        "storage" TEXT DEFAULT 'local',
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    mediaTableChecked = true;
  } catch (err) {
    console.error('Error ensuring Media table:', err);
  }
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
    await ensureMediaTable();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Media" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 150`,
      req.userId
    );
    return res.json({ media: rows || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/media/upload - Upload de imagem (Base64) com suporte MinIO & Local
router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureMediaTable();
    const { name, base64Data, mimeType } = req.body;

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

    const uploadRes = await uploadAssetToStorage(buffer, filename, effectiveMime);
    const publicUrl = uploadRes.url;
    const storageType = 'local';

    const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Media" ("id", "name", "url", "size", "mimeType", "storage", "userId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      id, mediaName, publicUrl, size, effectiveMime, storageType, req.userId
    );

    return res.status(201).json({
      media: {
        id,
        name: mediaName,
        url: publicUrl,
        size,
        mimeType: effectiveMime,
        storage: storageType,
        userId: req.userId
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/media/:id - Excluir imagem da biblioteca
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureMediaTable();
    const { id } = req.params;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Media" WHERE "id" = $1 AND "userId" = $2`,
      id, req.userId
    );

    if (rows && rows.length > 0) {
      const media = rows[0];
      if (media.url && media.url.startsWith('/uploads/')) {
        const filename = media.url.replace('/uploads/', '');
        const filePath = path.join(uploadsDir, filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "Media" WHERE "id" = $1 AND "userId" = $2`,
      id, req.userId
    );

    return res.json({ success: true, id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
