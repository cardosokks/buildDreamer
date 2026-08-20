"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const ftp_1 = require("../services/ftp");
const router = (0, express_1.Router)();
// List Projects
router.get('/', async (req, res) => {
    try {
        const userId = req.userId;
        const projects = await db_1.prisma.project.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Create Project
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        const userId = req.userId;
        const project = await db_1.prisma.project.create({
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
                        html: `<div class="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center">
  <h1 class="text-4xl font-bold mb-4">Bem-vindo ao seu novo site</h1>
  <p class="text-slate-400">Edite este site usando o painel visual ou solicitando mudanças ao Gemini.</p>
</div>

<!-- Widget do WhatsApp Vermelho -->
<div id="whatsapp-widget" class="fixed bottom-6 right-6 z-50 font-sans text-slate-100">
  <button id="wa-btn" class="bg-red-650 hover:bg-red-550 text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 animate-bounce">
    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.859-4.407 9.862-9.843.002-2.633-1.02-5.107-2.88-6.97C16.59 1.916 14.12 .892 11.5 89.1c-5.44 0-9.863 4.41-9.866 9.846-.001 1.777.478 3.506 1.39 5.031l-.92 3.363 3.443-.903zm12.188-7.391c-.33-.165-1.951-.963-2.253-1.073-.303-.11-.523-.165-.743.165-.22.33-.853 1.073-1.046 1.293-.193.22-.385.247-.715.082-.33-.165-1.393-.513-2.653-1.637-.98-.874-1.642-1.953-1.834-2.283-.193-.33-.02-.508.145-.671.148-.147.33-.385.495-.578.165-.192.22-.33.33-.55.11-.22.055-.412-.028-.577-.082-.165-.743-1.787-1.018-2.447-.268-.645-.536-.557-.743-.568-.19-.009-.413-.011-.632-.011-.22 0-.577.082-.88.413-.303.33-1.155 1.127-1.155 2.748 0 1.62 1.182 3.19 1.346 3.41.165.22 2.327 3.553 5.637 4.98.787.339 1.402.541 1.88.692.791.252 1.512.216 2.081.131.635-.094 1.951-.798 2.226-1.57.275-.77.275-1.43.193-1.569-.083-.139-.303-.22-.633-.385z"/>
    </svg>
  </button>
  <div id="wa-chat" class="hidden absolute bottom-20 right-0 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
    <div class="bg-red-650 p-4 text-white flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-red-100">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.859-4.407 9.862-9.843.002-2.633-1.02-5.107-2.88-6.97C16.59 1.916 14.12 .892 11.5 89.1c-5.44 0-9.863 4.41-9.866 9.846-.001 1.777.478 3.506 1.39 5.031l-.92 3.363 3.443-.903zm12.188-7.391c-.33-.165-1.951-.963-2.253-1.073-.303-.11-.523-.165-.743.165-.22.33-.853 1.073-1.046 1.293-.193.22-.385.247-.715.082-.33-.165-1.393-.513-2.653-1.637-.98-.874-1.642-1.953-1.834-2.283-.193-.33-.02-.508.145-.671.148-.147.33-.385.495-.578.165-.192.22-.33.33-.55.11-.22.055-.412-.028-.577-.082-.165-.743-1.787-1.018-2.447-.268-.645-.536-.557-.743-.568-.19-.009-.413-.011-.632-.011-.22 0-.577.082-.88.413-.303.33-1.155 1.127-1.155 2.748 0 1.62 1.182 3.19 1.346 3.41.165.22 2.327 3.553 5.637 4.98.787.339 1.402.541 1.88.692.791.252 1.512.216 2.081.131.635-.094 1.951-.798 2.226-1.57.275-.77.275-1.43.193-1.569-.083-.139-.303-.22-.633-.385z"/>
          </svg>
        </div>
        <div>
          <h4 class="font-bold text-sm">Suporte Online</h4>
          <span class="text-[10px] text-red-200">Online</span>
        </div>
      </div>
      <button id="wa-close" class="text-white hover:text-red-200 text-lg cursor-pointer font-bold">&times;</button>
    </div>
    <div class="p-5 bg-slate-950 flex-1 min-h-[100px] flex items-center justify-center">
      <p class="text-xs text-slate-400 text-center">Olá! Como podemos te ajudar hoje?</p>
    </div>
    <div class="p-3 bg-slate-900 border-t border-slate-800">
      <a href="https://wa.me/5500000000000" target="_blank" class="block w-full py-2 bg-red-650 hover:bg-red-550 text-center text-white text-xs font-bold rounded-xl transition-colors">
        Iniciar Conversa
      </a>
    </div>
  </div>
</div>`,
                        css: 'body { margin: 0; font-family: sans-serif; }',
                        js: `const btn = document.getElementById("wa-btn");
const chat = document.getElementById("wa-chat");
const close = document.getElementById("wa-close");
if (btn && chat && close) {
  btn.addEventListener("click", () => {
    chat.classList.toggle("hidden");
  });
  close.addEventListener("click", () => {
    chat.classList.add("hidden");
  });
}`
                    }
                }
            },
            include: {
                pages: true
            }
        });
        // Upload to FTP background
        try {
            await (0, ftp_1.uploadProjectToFTP)(project.name, project.pages);
        }
        catch (ftpErr) {
            console.error("Failed to upload newly created project to FTP:", ftpErr);
        }
        return res.status(201).json(project);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Get Project Details & Pages
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const project = await db_1.prisma.project.findFirst({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Delete Project
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.userId;
        const membership = await db_1.prisma.projectMember.findFirst({
            where: {
                projectId: id,
                userId: userId,
                role: 'OWNER'
            }
        });
        if (!membership) {
            return res.status(403).json({ error: 'Only the project owner can delete this project' });
        }
        await db_1.prisma.project.delete({ where: { id } });
        return res.json({ message: 'Project deleted successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.projectRouter = router;
