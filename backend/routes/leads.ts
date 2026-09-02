import express from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get all leads for the user
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
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
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
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

// Bulk create leads
router.post('/bulk', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    const { leads } = req.body;

    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'Lista de leads é obrigatória.' });
    }

    const createdLeads = [];
    for (const leadData of leads) {
      // Check for existing lead to avoid duplicates
      const existing = await prisma.lead.findFirst({
        where: {
          userId,
          name: leadData.name,
          OR: [
            { phone: leadData.phone || undefined },
            { website: leadData.website || undefined }
          ]
        }
      });

      if (!existing) {
        const lead = await prisma.lead.create({
          data: {
            name: leadData.name,
            company: leadData.company || leadData.category || 'Comércio Local',
            phone: leadData.phone || null,
            email: leadData.email || null,
            website: leadData.website || null,
            address: leadData.address || null,
            status: 'PROSPECT',
            dealValue: 0,
            origin: 'SEARCH',
            userId
          }
        });
        createdLeads.push(lead);
      }
    }

    return res.json({ count: createdLeads.length, message: 'Leads processados com sucesso.' });
  } catch (error) {
    console.error('Error bulk creating leads:', error);
    return res.status(500).json({ error: 'Erro ao processar leads em massa.' });
  }
});

// Update a lead
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
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
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
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
router.post('/bulk-status', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
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
