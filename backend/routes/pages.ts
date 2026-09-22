import { Router } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { cleanHtmlExtractAssets } from '../services/gemini';

const router = Router();

// Create Page (supports /projects/:projectId/pages and /pages)
router.post(['/projects/:projectId/pages', '/pages'], async (req: AuthenticatedRequest, res: any) => {
  try {
    const projectId = (req.params.projectId || req.body.projectId) as string;
    const { name, slug, title, description, seoTitle, seoDescription, html, css, js, isHomepage } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'ProjectId is required' });
    }

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

    if (isHomepage) {
      // Unset previous homepage in this project
      await prisma.page.updateMany({
        where: { projectId, isHomepage: true },
        data: { isHomepage: false }
      });
    }

    // Separa rigorosamente HTML, CSS e JS para a nova página
    const cleaned = cleanHtmlExtractAssets(html || '<div></div>', css || '', js || '');

    const page = await prisma.page.create({
      data: {
        name,
        slug,
        title: title || name,
        description: description || '',
        seoTitle: seoTitle || title || name,
        seoDescription: seoDescription || description || '',
        html: cleaned.html || '<div></div>',
        css: cleaned.css || '',
        js: cleaned.js || '',
        isHomepage: isHomepage === true,
        projectId
      },
      include: {
        project: true
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
    const { name, slug, title, description, html, css, js, seoTitle, seoDescription, seoOgImage, isHomepage } = req.body;

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

    const rawHtmlInput = html !== undefined ? html : page.html;
    const rawCssInput = css !== undefined ? css : page.css;
    const rawJsInput = js !== undefined ? js : page.js;

    const cleaned = cleanHtmlExtractAssets(rawHtmlInput, rawCssInput, rawJsInput);

    const updatedPage = await prisma.page.update({
      where: { id },
      data: {
        name: name !== undefined ? name : page.name,
        slug: slug !== undefined ? slug : page.slug,
        title: title !== undefined ? title : page.title,
        description: description !== undefined ? description : page.description,
        seoTitle: seoTitle !== undefined ? seoTitle : page.seoTitle,
        seoDescription: seoDescription !== undefined ? seoDescription : page.seoDescription,
        seoOgImage: seoOgImage !== undefined ? seoOgImage : (page.seoOgImage || null),
        html: cleaned.html,
        css: cleaned.css,
        js: cleaned.js,
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
