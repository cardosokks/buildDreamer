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
    const { name, price, description, category, sku, status, billingType, costPrice, siteUrl, projectId } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        price: Number(price),
        description: description || null,
        category: category || 'Geral',
        sku: sku || null,
        status: status || 'ACTIVE',
        billingType: billingType || 'ONE_TIME',
        costPrice: costPrice !== undefined && costPrice !== null && costPrice !== '' ? Number(costPrice) : null,
        siteUrl: siteUrl || null,
        projectId: projectId || null,
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
    const { name, price, description, category, sku, status, billingType, costPrice, siteUrl, projectId } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = Number(price);
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (sku !== undefined) updateData.sku = sku;
    if (status !== undefined) updateData.status = status;
    if (billingType !== undefined) updateData.billingType = billingType;
    if (costPrice !== undefined) updateData.costPrice = costPrice !== null && costPrice !== '' ? Number(costPrice) : null;
    if (siteUrl !== undefined) updateData.siteUrl = siteUrl;
    if (projectId !== undefined) updateData.projectId = projectId;

    const product = await prisma.product.update({
      where: { id },
      data: updateData
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
