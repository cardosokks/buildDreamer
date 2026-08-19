import { Router } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import JSZip from 'jszip';

const router = Router();

// Export Project as ZIP containing all pages static files (HTML, CSS, JS) and Dockerfile
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

    const zip = new JSZip();

    // Create folder structure inside ZIP
    const pagesFolder = zip.folder("pages");
    const cssFolder = zip.folder("css");
    const jsFolder = zip.folder("js");
    
    // Add pages and assets
    project.pages.forEach(page => {
      const filename = `${page.slug}.html`;
      const cssFilename = `${page.slug}.css`;
      const jsFilename = `${page.slug}.js`;

      // Static index.html boilerplate to bind page files
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${page.title || page.name}</title>
          <link rel="stylesheet" href="../css/${cssFilename}">
        </head>
        <body>
          ${page.html}
          <script src="../js/${jsFilename}"></script>
        </body>
        </html>
      `;

      if (pagesFolder) pagesFolder.file(filename, htmlContent);
      if (cssFolder) cssFolder.file(cssFilename, page.css);
      if (jsFolder) jsFolder.file(jsFilename, page.js);
    });

    // Add general configuration files
    zip.file("README.md", `# ${project.name}\n\nSite exportado do construtor de sites AI Website Builder.\n`);
    
    // Add Docker support inside ZIP
    zip.file("Dockerfile", `
      FROM nginx:alpine
      COPY ./pages /usr/share/nginx/html
      COPY ./css /usr/share/nginx/css
      COPY ./js /usr/share/nginx/js
      EXPOSE 80
      CMD ["nginx", "-g", "daemon off;"]
    `);

    zip.file("docker-compose.yml", `
      version: '3.8'
      services:
        web:
          build: .
          ports:
            - "8080:80"
    `);

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
