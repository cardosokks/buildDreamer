"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-prod';
// Register User
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const existingUser = await db_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await db_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name
            }
        });
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Login User
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await db_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
const auth_1 = require("../middleware/auth");
// Helper para garantir que as colunas de configurações existam no banco PostgreSQL
let columnsChecked = false;
async function ensureUserSettingsColumns() {
    if (columnsChecked)
        return;
    try {
        await db_1.prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT,
      ADD COLUMN IF NOT EXISTS "openaiApiKey" TEXT,
      ADD COLUMN IF NOT EXISTS "aiProxyUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "ngrokAuthToken" TEXT,
      ADD COLUMN IF NOT EXISTS "customAiSkills" JSONB,
      ADD COLUMN IF NOT EXISTS "customAiModels" JSONB,
      ADD COLUMN IF NOT EXISTS "savedLeads" JSONB,
      ADD COLUMN IF NOT EXISTS "filterPresets" JSONB;
    `);
        columnsChecked = true;
    }
    catch (err) {
        console.error('Error ensuring User settings columns:', err);
    }
}
// Obter configurações do usuário logado (armazenadas no banco de dados)
router.get('/settings', auth_1.authenticateToken, async (req, res) => {
    try {
        await ensureUserSettingsColumns();
        const rows = await db_1.prisma.$queryRawUnsafe(`SELECT "id", "email", "name", "geminiApiKey", "openaiApiKey", "aiProxyUrl", "ngrokAuthToken", "customAiSkills", "customAiModels", "savedLeads", "filterPresets" FROM "User" WHERE "id" = $1 LIMIT 1`, req.userId);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        const user = rows[0];
        return res.json({ settings: user });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Atualizar configurações do usuário logado no banco de dados
router.put('/settings', auth_1.authenticateToken, async (req, res) => {
    try {
        await ensureUserSettingsColumns();
        const { name, geminiApiKey, openaiApiKey, aiProxyUrl, ngrokAuthToken, customAiSkills, customAiModels, savedLeads, filterPresets } = req.body;
        const fields = [];
        const values = [];
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
            await db_1.prisma.$executeRawUnsafe(`UPDATE "User" SET ${fields.join(', ')} WHERE "id" = $${idx}`, ...values);
        }
        const rows = await db_1.prisma.$queryRawUnsafe(`SELECT "id", "email", "name", "geminiApiKey", "openaiApiKey", "aiProxyUrl", "ngrokAuthToken", "customAiSkills", "customAiModels", "savedLeads", "filterPresets" FROM "User" WHERE "id" = $1 LIMIT 1`, req.userId);
        return res.json({
            message: 'Configurações salvas e sincronizadas com sucesso no banco de dados!',
            settings: rows[0] || {}
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.authRouter = router;
