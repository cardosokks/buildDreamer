import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// Database Backup / Export
router.get('/backup', async (req, res: any) => {
  try {
    const data = {
      projects: await prisma.project.findMany(),
      pages: await prisma.page.findMany(),
      leads: await prisma.lead.findMany(),
      projectMembers: await prisma.projectMember.findMany(),
      medias: await prisma.media.findMany(),
      blogPosts: await prisma.blogPost.findMany(),
      menuItems: await prisma.menuItem.findMany(),
      assets: await prisma.asset.findMany(),
      users: await prisma.user.findMany(),
      versions: await prisma.version.findMany()
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=builddreamer_backup.json');
    res.send(JSON.stringify(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Database Restore / Import
router.post('/restore', async (req, res: any) => {
  try {
    const { 
      projects, pages, leads, projectMembers, medias, 
      blogPosts, menuItems, assets, users, versions 
    } = req.body;
    
    // Disable foreign key constraints during restore - SQLite PRAGMA not standard everywhere but let's try safely deleting
    // Or we just UPSERT everything to avoid breaking changes! We will skip existing to prevent ID collisions, or use upsert.
    // For simplicity, we createMany with skipDuplicates.
    
    if (users && users.length) await prisma.user.createMany({ data: users, skipDuplicates: true });
    if (projects && projects.length) await prisma.project.createMany({ data: projects, skipDuplicates: true });
    if (pages && pages.length) await prisma.page.createMany({ data: pages, skipDuplicates: true });
    if (leads && leads.length) await prisma.lead.createMany({ data: leads, skipDuplicates: true });
    if (projectMembers && projectMembers.length) await prisma.projectMember.createMany({ data: projectMembers, skipDuplicates: true });
    if (medias && medias.length) await prisma.media.createMany({ data: medias, skipDuplicates: true });
    if (blogPosts && blogPosts.length) await prisma.blogPost.createMany({ data: blogPosts, skipDuplicates: true });
    if (menuItems && menuItems.length) await prisma.menuItem.createMany({ data: menuItems, skipDuplicates: true });
    if (assets && assets.length) await prisma.asset.createMany({ data: assets, skipDuplicates: true });
    if (versions && versions.length) await prisma.version.createMany({ data: versions, skipDuplicates: true });

    res.json({ success: true, message: "Restaurado com sucesso!" });
  } catch (err: any) {
    console.error("Restore failed", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
