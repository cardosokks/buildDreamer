import { Router } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Create Page
router.post('/projects/:projectId/pages', async (req: AuthenticatedRequest, res: any) => {
  try {
    const projectId = req.params.projectId as string;
    const { name, slug, title, description, html, css, js } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    // Verify member permissions
    const userId = req.userId as string;
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId }
    });
    if (!member) {
      return res.status(403).json({ error: 'Not authorized on this project' });
    }

    const page = await prisma.page.create({
      data: {
        name,
        slug,
        title,
        description,
        html: html || '<div></div>',
        css: css || '',
        js: js || '',
        projectId
      }
    });

    return res.status(201).json(page);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Update Page Code / Content
router.put('/pages/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    const id = req.params.id as string;
    const { name, slug, title, description, html, css, js, isHomepage } = req.body;

    const page = await prisma.page.findUnique({
      where: { id },
      include: { project: { include: { members: true } } }
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const userId = req.userId as string;
    const isMember = page.project.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (isHomepage) {
      // Unset previous homepage in this project
      await prisma.page.updateMany({
        where: { projectId: page.projectId, isHomepage: true },
        data: { isHomepage: false }
      });
    }

    const updatedPage = await prisma.page.update({
      where: { id },
      data: {
        name: name !== undefined ? name : page.name,
        slug: slug !== undefined ? slug : page.slug,
        title: title !== undefined ? title : page.title,
        description: description !== undefined ? description : page.description,
        html: html !== undefined ? html : page.html,
        css: css !== undefined ? css : page.css,
        js: js !== undefined ? js : page.js,
        isHomepage: isHomepage !== undefined ? isHomepage : page.isHomepage
      }
    });

    return res.json(updatedPage);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete Page
router.delete('/pages/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    const id = req.params.id as string;

    const page = await prisma.page.findUnique({
      where: { id },
      include: { project: { include: { members: true } } }
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const userId = req.userId as string;
    const isMember = page.project.members.some(m => m.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (page.isHomepage) {
      return res.status(400).json({ error: 'Cannot delete the homepage of a project' });
    }

    await prisma.page.delete({ where: { id } });
    return res.json({ message: 'Page deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const pageRouter = router;
