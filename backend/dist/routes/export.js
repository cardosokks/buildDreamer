"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
const jszip_1 = __importDefault(require("jszip"));
const router = (0, express_1.Router)();
// Export Project as ZIP containing all pages static files (HTML, CSS, JS) and Dockerfile
router.get('/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const project = await db_1.prisma.project.findFirst({
            where: {
                id: projectId,
                members: {
                    some: {
                        userId: req.userId
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
        const includeDocker = req.query.docker === undefined ? true : req.query.docker === 'true';
        const includeReadme = req.query.readme === undefined ? true : req.query.readme === 'true';
        const zip = new jszip_1.default();
        // Create folder structure inside ZIP condicionalmente
        const pagesFolder = includePages ? zip.folder("pages") : null;
        const cssFolder = includeCss ? zip.folder("css") : null;
        const jsFolder = includeJs ? zip.folder("js") : null;
        // Add pages and assets
        project.pages.forEach(page => {
            const isHome = page.isHomepage;
            // Determine file structure path
            // Homepage will be exported as index.html in the root
            // Other pages will go into the pages/ folder e.g. pages/about.html
            const filename = isHome ? "index.html" : `pages/${page.slug}.html`;
            // Paths for CSS and JS outputs
            const cssFilename = `${page.slug}.css`;
            const jsFilename = `${page.slug}.js`;
            // Relative path helper from HTML location to CSS/JS directories
            const relativePrefix = isHome ? "." : "..";
            // Static index.html boilerplate to bind page files
            const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title || page.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  ${includeCss ? `<link rel="stylesheet" href="${relativePrefix}/css/${cssFilename}">` : ''}
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${page.html}
  ${includeJs ? `<script src="${relativePrefix}/js/${jsFilename}"></script>` : ''}
</body>
</html>`;
            if (includePages) {
                zip.file(filename, htmlContent);
            }
            if (includeCss && cssFolder) {
                cssFolder.file(cssFilename, page.css);
            }
            if (includeJs && jsFolder) {
                jsFolder.file(jsFilename, page.js);
            }
        });
        // Add general configuration files
        if (includeReadme) {
            zip.file("README.md", `# ${project.name}\n\nSite exportado do construtor de sites AI Website Builder.\n`);
        }
        // Add Docker support inside ZIP
        if (includeDocker) {
            zip.file("Dockerfile", `FROM nginx:alpine
${includePages ? 'COPY index.html /usr/share/nginx/html/' : ''}
${includePages ? 'COPY pages/ /usr/share/nginx/html/pages/' : ''}
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.exportRouter = router;
