import { Router } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * Normaliza links internos nas páginas HTML para funcionarem em qualquer hospedagem estática
 * Converte href="/servicos" ou href="/pages/servicos" ou href="servicos" para o caminho estático correto
 * e reescreve links de mídia (/uploads/projects/... ou http://.../uploads/...) para o diretório local "media/..."
 */
function normalizeHtmlLinks(
  html: string, 
  isHome: boolean, 
  allPages: Array<{ slug: string; isHomepage: boolean }>,
  projectId?: string
): string {
  if (!html) return '';

  let processedHtml = html;

  // 1. Reescreve URLs de mídias para a pasta local "media/"
  if (projectId) {
    // Substitui URLs completas com domínio e URLs relativas de uploads do projeto
    const mediaRegex = new RegExp(`(?:https?:\\/\\/[^"'/]+)?\\/uploads\\/projects\\/${projectId}\\/([^"'>\\s)]+)`, 'gi');
    processedHtml = processedHtml.replace(mediaRegex, 'media/$1');
  }
  // Fallback genérico para qualquer /uploads/
  processedHtml = processedHtml.replace(/(?:https?:\/\/[^"'/]+)?\/uploads\/projects\/[^"'/]+\/([^"'>\s)]+)/gi, 'media/$1');

  // 2. Normaliza links de navegação interna
  return processedHtml.replace(/href=["']([^"'#?]+)["']/gi, (match, href) => {
    // Ignora links externos, âncoras e protocolos
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
      return match;
    }

    // Extrai o slug do link
    const cleanHref = href.replace(/^\//, '').replace(/^pages\//, '').replace(/\.html$/, '') || 'index';
    
    // Procura a página correspondente
    const targetPage = allPages.find(p => p.slug === cleanHref || (cleanHref === 'index' && p.isHomepage));
    if (!targetPage) return match;

    if (targetPage.isHomepage) {
      return `href="index.html"`;
    } else {
      return `href="${targetPage.slug}.html"`;
    }
  });
}

// Export Project as ZIP containing all pages static files (HTML, CSS, JS, Media) and Dockerfile
router.get('/:projectId', async (req: AuthenticatedRequest, res: any) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        members: {
          some: {
            userId: req.userId as string
          }
        }
      },
      include: {
        pages: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Read URL query params
    const includePages = req.query.pages === undefined ? true : req.query.pages === 'true';
    const includeCss = req.query.css === undefined ? true : req.query.css === 'true';
    const includeJs = req.query.js === undefined ? true : req.query.js === 'true';
    const includeMedia = req.query.media === undefined ? true : req.query.media === 'true';
    const includeDocker = req.query.docker === undefined ? true : req.query.docker === 'true';
    const includeReadme = req.query.readme === undefined ? true : req.query.readme === 'true';

    const zip = new JSZip();

    const cssFolder = includeCss ? zip.folder("css") : null;
    const jsFolder = includeJs ? zip.folder("js") : null;
    const mediaFolder = includeMedia ? zip.folder("media") : null;

    // Empacota todos os arquivos de mídia reais do projeto na pasta "media/"
    if (includeMedia && mediaFolder) {
      const projectUploadsDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
      if (fs.existsSync(projectUploadsDir)) {
        try {
          const files = fs.readdirSync(projectUploadsDir);
          for (const file of files) {
            const filePath = path.join(projectUploadsDir, file);
            if (fs.statSync(filePath).isFile()) {
              const fileBuffer = fs.readFileSync(filePath);
              mediaFolder.file(file, fileBuffer);
            }
          }
        } catch (mediaErr) {
          console.warn('[Export] Aviso ao empacotar mídias locais:', mediaErr);
        }
      }
    }
    
    // Add pages and assets
    project.pages.forEach(page => {
      const isHome = page.isHomepage;
      
      // Arquitetura plana recomendada para static hosts: index.html na raiz e sobre.html, contato.html também na raiz
      // Isso garante links diretos sem erros de roteamento de subdiretório
      const filename = isHome ? "index.html" : `${page.slug}.html`;
      
      // Paths for CSS and JS outputs
      const cssFilename = `${page.slug}.css`;
      const jsFilename = `${page.slug}.js`;

      // Normaliza os links e mídias no HTML desta página
      const normalizedPageHtml = normalizeHtmlLinks(page.html, isHome, project.pages, projectId);
      const normalizedNavbarHtml = normalizeHtmlLinks(project.navbarHtml || '', isHome, project.pages, projectId);
      const normalizedFooterHtml = normalizeHtmlLinks(project.footerHtml || '', isHome, project.pages, projectId);

      // Static index.html boilerplate to bind page files
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title || page.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
    h1,h2,h3,h4,h5,h6 { font-family: 'Outfit', sans-serif; }
  </style>
  ${includeCss ? `<link rel="stylesheet" href="css/${cssFilename}">` : ''}
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
  ${normalizedNavbarHtml}
  <main class="flex-grow">
    ${normalizedPageHtml}
  </main>
  ${normalizedFooterHtml}
  ${includeJs ? `<script src="js/${jsFilename}"></script>` : ''}
</body>
</html>`;

      if (includePages) {
        zip.file(filename, htmlContent);
      }
      if (includeCss && cssFolder) {
        // Também normaliza referências de mídias em CSS caso haja background-image
        const normalizedCss = normalizeHtmlLinks(page.css || '', isHome, project.pages, projectId);
        cssFolder.file(cssFilename, normalizedCss);
      }
      if (includeJs && jsFolder) {
        jsFolder.file(jsFilename, page.js || '');
      }
    });

    // Add general configuration files
    if (includeReadme) {
      zip.file("README.md", `# ${project.name}\n\nSite exportado do construtor de sites Real Premise / AI Website Builder.\n\n## Estrutura dos Arquivos:\n- \`index.html\`: Página Principal (Home - basta abrir direto no navegador)\n- \`*.html\`: Demais páginas do site na raiz para funcionamento direto em qualquer servidor Web (Nginx, Apache, Vercel, Netlify, cPanel, S3, etc.)\n- \`media/\`: Imagens, logos, banners e arquivos estáticos locais\n- \`css/\`: Folhas de estilo adicionais\n- \`js/\`: Scripts interativos\n`);
    }
    
    // Add Docker support inside ZIP
    if (includeDocker) {
      zip.file("Dockerfile", `FROM nginx:alpine
COPY *.html /usr/share/nginx/html/
${includeMedia ? 'COPY media/ /usr/share/nginx/html/media/' : ''}
${includeCss ? 'COPY css/ /usr/share/nginx/html/css/' : ''}
${includeJs ? 'COPY js/ /usr/share/nginx/html/js/' : ''}
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`);

      zip.file("docker-compose.yml", `version: '3.8'
services:
  web:
    build: .
    ports:
      - "8080:80"`);
    }

    // Generate zip content buffer
    const content = await zip.generateAsync({ type: "nodebuffer" });

    // Set headers to download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=project-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`);
    return res.send(content);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const exportRouter = router;
