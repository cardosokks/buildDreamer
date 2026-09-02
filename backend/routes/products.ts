import express from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get all products
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a product
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, price, siteUrl, projectId } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        price: Number(price),
        siteUrl,
        projectId,
        userId: req.userId!
      }
    });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a product
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, price, siteUrl, projectId } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        price: price !== undefined ? Number(price) : undefined,
        siteUrl,
        projectId
      }
    });
    res.json(product);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a product
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
