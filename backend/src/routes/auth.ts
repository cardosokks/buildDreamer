import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';

// Register User
router.post('/signup', async (req: any, res: any) => {
  try {
    await ensureUserSettingsColumns();
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado' });
    }

    const count = await prisma.user.count();
    const role = count === 0 ? 'ADMIN' : 'USER';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0]
      }
    });

    await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = $1 WHERE "id" = $2`, role, user.id);

    const token = jwt.sign({ userId: user.id, role }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Login User
router.post('/login', async (req: any, res: any) => {
  try {
    await ensureUserSettingsColumns();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos' });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "role" FROM "User" WHERE "id" = $1`, user.id);
    let role = rows && rows[0] && rows[0].role ? rows[0].role : 'USER';

    // Se houver apenas 1 usuário e estiver sem role, torna ADMIN
    const totalUsers = await prisma.user.count();
    if (totalUsers === 1 && role !== 'ADMIN') {
      role = 'ADMIN';
      await prisma.$executeRawUnsafe(`UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = $1`, user.id);
    }

    const token = jwt.sign({ userId: user.id, role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

// Helper para garantir que as colunas de configurações existam no banco PostgreSQL
let columnsChecked = false;
async function ensureUserSettingsColumns() {
  if (columnsChecked) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT 'USER',
      ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT,
      ADD COLUMN IF NOT EXISTS "openaiApiKey" TEXT,
      ADD COLUMN IF NOT EXISTS "aiProxyUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "ngrokAuthToken" TEXT,
      ADD COLUMN IF NOT EXISTS "customAiSkills" JSONB,
      ADD COLUMN IF NOT EXISTS "customAiModels" JSONB,
      ADD COLUMN IF NOT EXISTS "savedLeads" JSONB,
      ADD COLUMN IF NOT EXISTS "filterPresets" JSONB;
    `);
    // Se existir usuários sem role definida, garante que o primeiro seja ADMIN e os demais USER
    await prisma.$executeRawUnsafe(`
      UPDATE "User" SET "role" = 'USER' WHERE "role" IS NULL;
      UPDATE "User" SET "role" = 'ADMIN' WHERE "id" IN (SELECT "id" FROM "User" ORDER BY "id" ASC LIMIT 1);
    `);
    columnsChecked = true;
  } catch (err) {
    console.error('Error ensuring User settings columns:', err);
  }
}

// Obter dados do usuário logado (Perfil & Role)
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureUserSettingsColumns();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id", "email", "name", "role" FROM "User" WHERE "id" = $1 LIMIT 1`,
      req.userId
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json({ user: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Obter configurações do usuário logado (armazenadas no banco de dados)
router.get('/settings', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureUserSettingsColumns();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id", "email", "name", "role", "geminiApiKey", "openaiApiKey", "aiProxyUrl", "ngrokAuthToken", "customAiSkills", "customAiModels", "savedLeads", "filterPresets" FROM "User" WHERE "id" = $1 LIMIT 1`,
      req.userId
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = rows[0];
    return res.json({ settings: user });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Atualizar configurações do usuário logado no banco de dados
router.put('/settings', authenticateToken, async (req: AuthenticatedRequest, res: any) => {
  try {
    await ensureUserSettingsColumns();
    const { 
      name,
      geminiApiKey, 
      openaiApiKey, 
      aiProxyUrl, 
      ngrokAuthToken, 
      customAiSkills, 
      customAiModels,
      savedLeads,
      filterPresets 
    } = req.body;

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`"name" = $${idx++}`);
      values.push(name);
    }
    if (geminiApiKey !== undefined) {
      fields.push(`"geminiApiKey" = $${idx++}`);
      values.push(geminiApiKey);
    }
    if (openaiApiKey !== undefined) {
      fields.push(`"openaiApiKey" = $${idx++}`);
      values.push(openaiApiKey);
    }
    if (aiProxyUrl !== undefined) {
      fields.push(`"aiProxyUrl" = $${idx++}`);
      values.push(aiProxyUrl);
    }
    if (ngrokAuthToken !== undefined) {
      fields.push(`"ngrokAuthToken" = $${idx++}`);
      values.push(ngrokAuthToken);
    }
    if (customAiSkills !== undefined) {
      fields.push(`"customAiSkills" = $${idx++}::jsonb`);
      values.push(typeof customAiSkills === 'string' ? customAiSkills : JSON.stringify(customAiSkills));
    }
    if (customAiModels !== undefined) {
      fields.push(`"customAiModels" = $${idx++}::jsonb`);
      values.push(typeof customAiModels === 'string' ? customAiModels : JSON.stringify(customAiModels));
    }
    if (savedLeads !== undefined) {
      fields.push(`"savedLeads" = $${idx++}::jsonb`);
      values.push(typeof savedLeads === 'string' ? savedLeads : JSON.stringify(savedLeads));
    }
    if (filterPresets !== undefined) {
      fields.push(`"filterPresets" = $${idx++}::jsonb`);
      values.push(typeof filterPresets === 'string' ? filterPresets : JSON.stringify(filterPresets));
    }

    if (fields.length > 0) {
      values.push(req.userId);
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET ${fields.join(', ')} WHERE "id" = $${idx}`,
        ...values
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id", "email", "name", "geminiApiKey", "openaiApiKey", "aiProxyUrl", "ngrokAuthToken", "customAiSkills", "customAiModels", "savedLeads", "filterPresets" FROM "User" WHERE "id" = $1 LIMIT 1`,
      req.userId
    );

    return res.json({ 
      message: 'Configurações salvas e sincronizadas com sucesso no banco de dados!', 
      settings: rows[0] || {} 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Server Time Endpoint – retorna o horário atual do servidor para sincronização no cliente
router.get('/time', (req: any, res: any) => {
  return res.json({ time: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
});

export const authRouter = router;
