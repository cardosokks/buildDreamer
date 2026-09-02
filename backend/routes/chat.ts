import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configuração para upload de áudios e imagens no chat
const chatUploadsDir = path.join(process.cwd(), 'front-end', 'public', 'uploads', 'chat');
if (!fs.existsSync(chatUploadsDir)) {
  fs.mkdirSync(chatUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, chatUploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith('audio') ? '.webm' : '.png');
    const name = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// GET /api/chat/messages - Obter mensagens do chat (geral ou conversa direta)
router.get('/messages', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { recipientId, targetUserId } = req.query;
    const currentUserId = req.userId!;

    let messages: any[] = [];
    if (targetUserId && targetUserId !== 'ALL') {
      // Conversa direta entre currentUserId e targetUserId (ambas as direções)
      messages = await (prisma as any).message.findMany({
        where: {
          OR: [
            { senderId: currentUserId, recipientId: String(targetUserId) },
            { senderId: String(targetUserId), recipientId: currentUserId }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });
    } else {
      // Canal Geral / Broadcast
      messages = await (prisma as any).message.findMany({
        where: {
          recipientId: 'ALL'
        },
        orderBy: { createdAt: 'asc' }
      });
    }

    return res.json({ messages });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/messages - Enviar mensagem de texto, áudio gravado ou anexo
router.post('/messages', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const currentUserId = req.userId!;
    const { content, type = 'text', recipientId = 'ALL', mediaUrl, duration, fileName, fileSize } = req.body;

    // Buscar dados do usuário logado
    const user = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário remetente não encontrado' });
    }

    const newMessage = await (prisma as any).message.create({
      data: {
        senderId: currentUserId,
        senderName: user.name || user.email.split('@')[0],
        senderEmail: user.email,
        senderRole: (user as any).role || 'USER',
        recipientId: recipientId || 'ALL',
        content: content || '',
        type: type, // 'text' | 'audio' | 'image' | 'file'
        mediaUrl: mediaUrl || null,
        duration: duration ? Number(duration) : null,
        fileName: fileName || null,
        fileSize: fileSize ? Number(fileSize) : null,
        read: false,
        createdAt: new Date()
      }
    });

    return res.status(201).json({ message: newMessage });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/upload - Upload de arquivo de áudio (gravação de voz) ou imagem do chat
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res: any) => {
  try {
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const fileUrl = `/uploads/chat/${file.filename}`;
    return res.json({
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/chat/messages/:id - Excluir mensagem do chat
router.delete('/messages/:id', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;
    const currentUserId = req.userId!;

    const user = await prisma.user.findUnique({ where: { id: currentUserId } });
    const isAdmin = (user as any)?.role === 'ADMIN' || (user as any)?.role === 'SUPER_ADMIN';

    // Se for admin ou se for o autor da mensagem
    const all = await (prisma as any).message.findMany();
    const msg = all.find((m: any) => m.id === id);

    if (!msg) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    if (msg.senderId !== currentUserId && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para deletar esta mensagem' });
    }

    await (prisma as any).message.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const chatRouter = router;
