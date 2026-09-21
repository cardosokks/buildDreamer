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

// GET /api/chat/conversations - Listar visão geral de conversas com resumo da última mensagem e não lidas
router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const currentUserId = req.userId!;
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    });

    const allMessages: any[] = await (prisma as any).message.findMany();

    // Mensagens do Canal Geral
    const generalMessages = allMessages.filter(m => m.recipientId === 'ALL');
    const lastGeneral = generalMessages[generalMessages.length - 1] || null;

    // Conversas diretas para cada usuário
    const otherUsers = users.filter(u => u.id !== currentUserId);
    const conversations = otherUsers.map(u => {
      const directMsgs = allMessages.filter(m => 
        (m.senderId === currentUserId && m.recipientId === u.id) ||
        (m.senderId === u.id && m.recipientId === currentUserId)
      );
      const lastMsg = directMsgs[directMsgs.length - 1] || null;
      const unreadCount = directMsgs.filter(m => m.senderId === u.id && !m.read).length;

      return {
        user: {
          id: u.id,
          name: u.name || u.email.split('@')[0],
          email: u.email,
          role: u.role || 'USER'
        },
        lastMessage: lastMsg ? {
          id: lastMsg.id,
          content: lastMsg.content,
          type: lastMsg.type,
          senderId: lastMsg.senderId,
          createdAt: lastMsg.createdAt,
          fileName: lastMsg.fileName
        } : null,
        unreadCount
      };
    });

    // Ordenar conversas por data da última mensagem (mais recentes primeiro)
    conversations.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    const generalSender = lastGeneral ? users.find(u => u.id === lastGeneral.senderId) : null;
    return res.json({
      generalChannel: {
        id: 'ALL',
        name: 'Canal Geral da Equipe',
        lastMessage: lastGeneral ? {
          id: lastGeneral.id,
          content: lastGeneral.content,
          type: lastGeneral.type,
          senderName: generalSender ? (generalSender.name || generalSender.email.split('@')[0]) : (lastGeneral.senderName || 'Membro'),
          createdAt: lastGeneral.createdAt
        } : null
      },
      conversations
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/chat/messages - Obter mensagens do chat (geral ou conversa direta)
router.get('/messages', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { recipientId, targetUserId } = req.query;
    const currentUserId = req.userId!;
    const effectiveTarget = (targetUserId || recipientId) as string | undefined;

    let messages: any[] = [];
    if (effectiveTarget && effectiveTarget !== 'ALL') {
      // Conversa direta privada entre currentUserId e effectiveTarget (ambas as direções)
      messages = await (prisma as any).message.findMany({
        where: {
          OR: [
            { senderId: currentUserId, recipientId: String(effectiveTarget) },
            { senderId: String(effectiveTarget), recipientId: currentUserId }
          ]
        },
        orderBy: { createdAt: 'asc' }
      });

      // Marcar mensagens recebidas como lidas
      try {
        await (prisma as any).message.updateMany({
          where: {
            senderId: String(effectiveTarget),
            recipientId: currentUserId
          },
          data: { read: true }
        });
      } catch {}
    } else {
      // Canal Geral / Broadcast
      messages = await (prisma as any).message.findMany({
        where: {
          recipientId: 'ALL'
        },
        orderBy: { createdAt: 'asc' }
      });
    }

    // Buscar lista de usuários para obter os nomes atualizados
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
    const userMap = new Map<string, string>();
    users.forEach(u => {
      userMap.set(u.id, u.name || u.email.split('@')[0]);
    });

    const enrichedMessages = messages.map(m => ({
      ...m,
      senderName: userMap.get(m.senderId) || m.senderName || 'Membro'
    }));

    return res.json({ messages: enrichedMessages });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/messages - Enviar mensagem de texto, áudio gravado ou anexo
router.post('/messages', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const currentUserId = req.userId!;
    const { content, type = 'text', recipientId = 'ALL', mediaUrl, duration, fileName, fileSize, replyTo } = req.body;

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
        replyTo: replyTo || null,
        reactions: [],
        pinned: false,
        read: false,
        createdAt: new Date()
      }
    });

    return res.status(201).json({ message: newMessage });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/chat/messages/:id/react - Alternar reação com emoji em uma mensagem
router.post('/messages/:id/react', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const currentUserId = req.userId!;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji é obrigatório' });
    }

    const user = await prisma.user.findUnique({ where: { id: currentUserId } });
    const msg = await (prisma as any).message.findUnique({ where: { id } });

    if (!msg) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    let reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
    const existingIndex = reactions.findIndex(r => r.userId === currentUserId && r.emoji === emoji);

    if (existingIndex > -1) {
      // Remove a reação se já tiver clicado no mesmo emoji (toggle off)
      reactions.splice(existingIndex, 1);
    } else {
      // Adiciona a nova reação
      reactions.push({
        emoji,
        userId: currentUserId,
        userName: user?.name || user?.email?.split('@')[0] || 'Usuário'
      });
    }

    const updated = await (prisma as any).message.update({
      where: { id },
      data: { reactions }
    });

    return res.json({ message: updated, reactions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/chat/messages/:id/pin - Fixar ou desafixar mensagem
router.put('/messages/:id/pin', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;
    const { pinned } = req.body;

    const msg = await (prisma as any).message.findUnique({ where: { id } });
    if (!msg) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    const updated = await (prisma as any).message.update({
      where: { id },
      data: { pinned: Boolean(pinned) }
    });

    return res.json({ message: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/chat/messages/:id/edit - Editar texto de mensagem própria
router.put('/messages/:id/edit', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const currentUserId = req.userId!;

    const msg = await (prisma as any).message.findUnique({ where: { id } });
    if (!msg) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    if (msg.senderId !== currentUserId) {
      return res.status(403).json({ error: 'Você só pode editar suas próprias mensagens' });
    }

    const updated = await (prisma as any).message.update({
      where: { id },
      data: { content, isEdited: true }
    });

    return res.json({ message: updated });
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
