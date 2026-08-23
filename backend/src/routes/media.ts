import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

// Garantir que a pasta de uploads exista localmente
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
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
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    mediaTableChecked = true;
  } catch (err) {
    console.error('Error ensuring Media table:', err);
  }
}

// GET /api/media - Listar mídias do usuário / admin
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureMediaTable();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Media" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
      req.userId
    );
    return res.json({ media: rows || [] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/media/upload - Upload de imagem (Base64)
router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureMediaTable();
    const { name, base64Data, mimeType } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'Dados da imagem (base64) são obrigatórios.' });
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    const ext = (mimeType || 'image/png').split('/')[1] || 'png';
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;
    const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const size = buffer.length;
    const mediaName = name || filename;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Media" ("id", "name", "url", "size", "mimeType", "userId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      id, mediaName, publicUrl, size, mimeType || 'image/png', req.userId
    );

    return res.status(201).json({
      media: {
        id,
        name: mediaName,
        url: publicUrl,
        size,
        mimeType: mimeType || 'image/png',
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
      `SELECT * FROM "Media" WHERE "id" = $1 AND "userId" = $2 LIMIT 1`,
      id, req.userId
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Imagem não encontrada ou sem permissão.' });
    }

    const item = rows[0];
    if (item.url && item.url.startsWith('/uploads/')) {
      const localFile = path.join(uploadsDir, path.basename(item.url));
      if (fs.existsSync(localFile)) {
        try { fs.unlinkSync(localFile); } catch {}
      }
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "Media" WHERE "id" = $1`, id);
    return res.json({ message: 'Imagem excluída com sucesso.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
