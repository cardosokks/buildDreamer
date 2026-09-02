import { Router } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';

const router = Router();

/**
 * Normaliza links internos nas páginas HTML para funcionarem em qualquer hospedagem estática
 */
function normalizeHtmlLinks(html: string, isHome: boolean, allPages: Array<{ slug: string; isHomepage: boolean }>): string {
  if (!html) return '';

  return html.replace(/href=["']([^"'#?]+)["']/gi, (match, href) => {
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
      return match;
    }

    const cleanHref = href.replace(/^\//, '').replace(/^pages\//, '').replace(/\.html$/, '') || 'index';
    
    const targetPage = allPages.find(p => p.slug === cleanHref || (cleanHref === 'index' && p.isHomepage));
    if (!targetPage) return match;

    if (targetPage.isHomepage) {
      return isHome ? `href="index.html"` : `href="index.html"`;
    } else {
      return `href="${targetPage.slug}.html"`;
    }
  });
}

// Export Project as ZIP containing all pages static files (HTML, CSS, JS, ASSETS) and Dockerfile
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
    const includeAssets = req.query.assets === undefined ? true : req.query.assets === 'true';
    const includeDocker = req.query.docker === undefined ? true : req.query.docker === 'true';
    const includeReadme = req.query.readme === undefined ? true : req.query.readme === 'true';

    const zip = new JSZip();

    const cssFolder = includeCss ? zip.folder("css") : null;
    const jsFolder = includeJs ? zip.folder("js") : null;
    const assetsFolder = includeAssets ? zip.folder("assets") : null;

    const uploadsDir = path.join(process.cwd(), 'backend', 'data', 'uploads');
    const uploadsDirAlt = path.join(process.cwd(), 'data', 'uploads');

    const bundledAssets = new Set<string>();

    // Função auxiliar para coletar e empacotar mídias do HTML/CSS
    const processMediaInContent = (content: string): string => {
      if (!content || !includeAssets || !assetsFolder) return content;

      let rewritten = content;
      // Captura links do tipo /api/media/files/<filename> ou http(s)://.../api/media/files/<filename> ou /data/uploads/<filename>
      const mediaRegex = /(?:https?:\/\/[^\s"'()]+)?(?:\/api\/media\/files\/|\/data\/uploads\/)([a-zA-Z0-9_\-\.]+)/gi;
      const matches = [...content.matchAll(mediaRegex)];

      for (const match of matches) {
        const fullMatch = match[0];
        const filename = match[1];

        // Tenta localizar o arquivo de mídia no servidor
        let filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(uploadsDirAlt, filename);
        }

        if (fs.existsSync(filePath) && !bundledAssets.has(filename)) {
          try {
            const fileBuf = fs.readFileSync(filePath);
            assetsFolder.file(filename, fileBuf);
            bundledAssets.add(filename);
          } catch (e) {
            console.warn(`[Export] Não foi possível ler arquivo de mídia ${filename}:`, e);
          }
        }

        if (bundledAssets.has(filename) || fs.existsSync(filePath)) {
          rewritten = rewritten.split(fullMatch).join(`assets/${filename}`);
        }
      }

      return rewritten;
    };
    
    // Process pages and assets
    project.pages.forEach(page => {
      const isHome = page.isHomepage;
      const filename = isHome ? "index.html" : `${page.slug}.html`;
      
      const cssFilename = `${page.slug}.css`;
      const jsFilename = `${page.slug}.js`;

      let normalizedPageHtml = normalizeHtmlLinks(page.html, isHome, project.pages);
      normalizedPageHtml = processMediaInContent(normalizedPageHtml);

      let processedCss = processMediaInContent(page.css || '');

      const finalTitle = page.seoTitle || page.title || page.name || project.name;
      const finalDesc = page.seoDescription || page.description || project.description || '';

      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${finalTitle}</title>
  <meta name="description" content="${finalDesc}">
  <meta property="og:title" content="${finalTitle}">
  <meta property="og:description" content="${finalDesc}">
  <meta property="og:type" content="website">
  ${project.favicon ? `<link rel="icon" href="${project.favicon}">` : ''}
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Inter', sans-serif;
      position: relative;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Outfit', sans-serif;
    }
  </style>
  ${includeCss ? `<link rel="stylesheet" href="css/${cssFilename}">` : ''}
</head>
<body>
  ${normalizedPageHtml}
  ${includeJs ? `<script src="js/${jsFilename}"></script>` : ''}
</body>
</html>`;

      if (includePages) {
        zip.file(filename, htmlContent);
      }
      if (includeCss && cssFolder) {
        cssFolder.file(cssFilename, processedCss);
      }
      if (includeJs && jsFolder) {
        jsFolder.file(jsFilename, page.js || '');
      }
    });

    if (includeReadme) {
      zip.file("README.md", `# ${project.name}\n\nSite exportado do construtor de sites Real Premise / AI Website Builder.\n\n## Estrutura dos Arquivos:\n- \`index.html\`: Página Principal (Home)\n- \`*.html\`: Demais páginas do site na raiz\n- \`assets/\`: Mídias e imagens originais do site\n- \`css/\`: Folhas de estilo adicionais\n- \`js/\`: Scripts interativos\n`);
    }
    
    if (includeDocker) {
      zip.file("Dockerfile", `FROM nginx:alpine
COPY *.html /usr/share/nginx/html/
${includeCss ? 'COPY css/ /usr/share/nginx/html/css/' : ''}
${includeJs ? 'COPY js/ /usr/share/nginx/html/js/' : ''}
${includeAssets && bundledAssets.size > 0 ? 'COPY assets/ /usr/share/nginx/html/assets/' : ''}
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`);

      zip.file("docker-compose.yml", `version: '3.8'
services:
  web:
    build: .
    ports:
      - "8080:80"`);
    }

    const content = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=project-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`);
    return res.send(content);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export const exportRouter = router;
