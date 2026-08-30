import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all leads for the user
router.get('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const leads = await prisma.lead.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

// Create a new lead
router.post('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { name, company, phone, email, website, address, status, dealValue, notes, origin, tags } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'O nome é obrigatório.' });
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        company,
        phone,
        email,
        website,
        address,
        status: status || 'PROSPECT',
        dealValue: dealValue ? parseFloat(dealValue) : 0,
        notes,
        origin: origin || 'MANUAL',
        tags: tags || '',
        userId
      }
    });

    return res.json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

// Update a lead
router.put('/:id', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, company, phone, email, website, address, status, dealValue, notes, origin, tags, projectId } = req.body;

    const lead = await prisma.lead.findFirst({
      where: { id, userId }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        name,
        company,
        phone,
        email,
        website,
        address,
        status,
        dealValue: dealValue ? parseFloat(dealValue) : lead.dealValue,
        notes,
        origin,
        tags,
        projectId
      }
    });

    return res.json(updatedLead);
  } catch (error) {
    console.error('Error updating lead:', error);
    return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
});

// Delete a lead
router.delete('/:id', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const lead = await prisma.lead.findFirst({
      where: { id, userId }
    });

    if (!lead) {
      console.log(`[CRM] Lead não encontrado: ${id}`);
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    console.log(`[CRM] Deletando lead: ${id}, nome: ${lead.name}`);
    await prisma.lead.delete({
      where: { id }
    });

    console.log(`[CRM] Lead deletado com sucesso: ${id}`);
    return res.json({ message: 'Lead excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir lead do CRM:', error);
    return res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
});

// Bulk action (e.g. status update)
router.post('/bulk-status', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { leadIds, status } = req.body;

    if (!Array.isArray(leadIds) || !status) {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }

    await prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        userId
      },
      data: { status }
    });

    return res.json({ message: 'Status atualizado em massa com sucesso.' });
  } catch (error) {
    console.error('Error bulk updating leads:', error);
    return res.status(500).json({ error: 'Erro ao atualizar status em massa.' });
  }
});

export { router as leadsRouter };
