import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido', code: 'TOKEN_MISSING' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada', code: 'TOKEN_INVALID' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Usuário não encontrado ou desativado do sistema', code: 'USER_NOT_FOUND' });
      }

      req.userId = user.id;
      req.userRole = user.role || decoded.role || 'USER';
      next();
    } catch (dbError) {
      req.userId = decoded.userId;
      req.userRole = decoded.role || 'USER';
      next();
    }
  });
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'ADMIN' && req.userRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Acesso negado. Permissão de Administrador requerida.', code: 'FORBIDDEN_ADMIN_ONLY' });
  }
  next();
};
