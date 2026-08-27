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
        "projectId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
    `).catch(() => {});
    mediaTableChecked = true;
  } catch (err) {
    console.error('Error ensuring Media table:', err);
  }
}

// GET /api/media - Listar mídias do usuário / admin
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureMediaTable();
    const projectId = req.query.projectId as string;
    let rows: any[];
    
    if (projectId) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "Media" WHERE "userId" = $1 AND "projectId" = $2 ORDER BY "createdAt" DESC LIMIT 100`,
        req.userId, projectId
      );
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "Media" WHERE "userId" = $1 AND ("projectId" IS NULL OR "projectId" = '') ORDER BY "createdAt" DESC LIMIT 100`,
        req.userId
      );
    }

    const formattedRows = (rows || []).map(item => ({
      ...item,
      url: item.url
    }));
    return res.json({ media: formattedRows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/media/upload - Upload de imagem (Base64)
router.post('/upload', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureMediaTable();
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

    const projectSubdir = projectId ? path.join('projects', projectId) : '';
    const targetDir = path.join(uploadsDir, projectSubdir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = projectId ? `/uploads/projects/${projectId}/${filename}` : `/uploads/${filename}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const absoluteUrl = `${baseUrl}${publicUrl}`;
    const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const size = buffer.length;
    const mediaName = name || filename;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Media" ("id", "name", "url", "size", "mimeType", "userId", "projectId", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      id, mediaName, publicUrl, size, mimeType || 'image/png', req.userId, projectId || null
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
    if (item.url && item.url.includes('/uploads/')) {
      const relativePart = item.url.split('/uploads/')[1];
      const localFile = path.join(uploadsDir, relativePart);
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
