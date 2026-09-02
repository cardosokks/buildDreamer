import express from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get sales history with filters
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate, leadId } = req.query;
    
    const where: any = {
      userId: req.userId
    };

    if (leadId) {
      where.leadId = String(leadId);
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        lead: true,
        product: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(sales);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register a sale
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { leadId, productId, productName, amount } = req.body;
    
    if (!leadId || !productName || amount === undefined) {
      return res.status(400).json({ error: 'Lead, nome do produto e valor são obrigatórios' });
    }

    const sale = await prisma.sale.create({
      data: {
        leadId,
        productId: productId || null,
        productName,
        amount: Number(amount),
        userId: req.userId!
      }
    });

    // Optionally update lead status or deal value
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: 'WON',
        dealValue: {
          increment: Number(amount)
        }
      }
    });

    res.status(201).json(sale);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete/Refund a sale (Extornar)
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findFirst({
      where: { id, userId: req.userId }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    // Decrement lead dealValue
    await prisma.lead.update({
      where: { id: sale.leadId },
      data: {
        dealValue: {
          decrement: sale.amount
        }
      }
    });

    await prisma.sale.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Venda extornada com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
