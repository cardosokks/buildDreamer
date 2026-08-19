import { Router } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// List Projects
router.get('/', async (req: AuthenticatedRequest, res: any) => {
  try {
    const userId = req.userId as string;
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        pages: {
          select: {
            id: true
          }
        }
      }
    });
    return res.json(projects);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create Project
router.post('/', async (req: AuthenticatedRequest, res: any) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const userId = req.userId as string;
    const project = await prisma.project.create({
      data: {
        name,
        description,
        members: {
          create: {
            userId,
            role: 'OWNER'
          }
        },
        pages: {
          create: {
            name: 'Home',
            slug: 'index',
            title: 'Home',
            isHomepage: true,
            html: '<div class="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center"><h1 class="text-4xl font-bold mb-4">Bem-vindo ao seu novo site</h1><p class="text-slate-400">Edite este site usando o painel visual ou solicitando mudanças ao Gemini.</p></div>',
            css: 'body { margin: 0; font-family: sans-serif; }',
            js: 'console.log("Página inicial carregada.");'
          }
        }
      },
      include: {
        pages: true
      }
    });

    return res.status(201).json(project);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Get Project Details & Pages
router.get('/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    const id = req.params.id as string;
    const userId = req.userId as string;
    const project = await prisma.project.findFirst({
      where: {
        id,
        members: {
          some: {
            userId
          }
        }
      },
      include: {
        pages: true,
        assets: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json(project);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete Project
router.delete('/:id', async (req: AuthenticatedRequest, res: any) => {
  try {
    const id = req.params.id as string;
    const userId = req.userId as string;

    const membership = await prisma.projectMember.findFirst({
      where: {
        projectId: id,
        userId: userId,
        role: 'OWNER'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Only the project owner can delete this project' });
    }

    await prisma.project.delete({ where: { id } });
    return res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const projectRouter = router;
