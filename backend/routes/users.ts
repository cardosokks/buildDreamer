import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Middleware para verificar se o usuário é ADMIN
const requireAdmin = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });
    const role = user?.role || 'USER';

    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem gerenciar usuários.' });
    }

    next();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// GET /api/users - Listar todos os usuários do sistema
router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: any) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    // Contagem de projetos por usuário se aplicável
    const safeUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email.split('@')[0],
      role: u.role || 'USER',
      createdAt: u.createdAt || new Date().toISOString()
    }));

    return res.json({ users: safeUsers });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Criar novo usuário (Criado pelo Administrador)
router.post('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { email, password, name, role = 'USER' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ error: 'Já existe um usuário com este e-mail' });
    }

    const validRoles = ['ADMIN', 'USER', 'EDITOR', 'VIEWER', 'SUPPORT'];
    const assignedRole = validRoles.includes(role) ? role : 'USER';
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name ? String(name).trim() : normalizedEmail.split('@')[0],
        role: assignedRole
      }
    });

    return res.status(201).json({
      message: 'Usuário criado com sucesso!',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: assignedRole,
        createdAt: newUser.createdAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Atualizar dados e tipo/role do usuário
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;
    const { name, role, email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const validRoles = ['ADMIN', 'USER', 'EDITOR', 'VIEWER', 'SUPPORT'];
    const updateData: any = {};

    if (name !== undefined) updateData.name = String(name).trim();
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: 'E-mail já está em uso por outra conta' });
        }
        updateData.email = normalizedEmail;
      }
    }

    if (role !== undefined && validRoles.includes(role)) {
      // Se for rebaixar a si próprio de ADMIN, verificar se há outros ADMINs
      if (id === req.userId && role !== 'ADMIN') {
        const adminCount = await prisma.user.count({
          where: { role: 'ADMIN' }
        });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Você não pode remover seu próprio privilégio de ADMIN pois é o único administrador do sistema.' });
        }
      }
      updateData.role = role;
    }

    if (password && String(password).trim().length >= 4) {
      updateData.password = await bcrypt.hash(String(password).trim(), 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData
    });

    return res.json({
      message: 'Usuário atualizado com sucesso!',
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role || 'USER',
        createdAt: updated.createdAt
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/users/:id/reset-password - Redefinir senha de um usuário
router.post('/:id/reset-password', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    return res.json({ message: `Senha do usuário ${user.name || user.email} redefinida com sucesso!` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id - Excluir usuário do sistema
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: any) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta de administrador enquanto estiver conectado.' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await prisma.user.delete({ where: { id } });

    return res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const usersRouter = router;
