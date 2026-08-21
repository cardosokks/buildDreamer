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
/**
 * Normaliza links internos nas páginas HTML para funcionarem em qualquer hospedagem estática
 * Converte href="/servicos" ou href="/pages/servicos" ou href="servicos" para o caminho estático correto
 */
function normalizeHtmlLinks(html, isHome, allPages) {
    if (!html)
        return '';
    return html.replace(/href=["']([^"'#?]+)["']/gi, (match, href) => {
        // Ignora links externos, âncoras e protocolos
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
            return match;
        }
        // Extrai o slug do link
        const cleanHref = href.replace(/^\//, '').replace(/^pages\//, '').replace(/\.html$/, '') || 'index';
        // Procura a página correspondente
        const targetPage = allPages.find(p => p.slug === cleanHref || (cleanHref === 'index' && p.isHomepage));
        if (!targetPage)
            return match;
        if (targetPage.isHomepage) {
            return isHome ? `href="index.html"` : `href="index.html"`;
        }
        else {
            return `href="${targetPage.slug}.html"`;
        }
    });
}
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
        const cssFolder = includeCss ? zip.folder("css") : null;
        const jsFolder = includeJs ? zip.folder("js") : null;
        // Add pages and assets
        project.pages.forEach(page => {
            const isHome = page.isHomepage;
            // Arquitetura plana recomendada para static hosts: index.html na raiz e sobre.html, contato.html também na raiz
            // Isso garante links diretos sem erros de roteamento de subdiretório
            const filename = isHome ? "index.html" : `${page.slug}.html`;
            // Paths for CSS and JS outputs
            const cssFilename = `${page.slug}.css`;
            const jsFilename = `${page.slug}.js`;
            // Normaliza os links no HTML desta página
            const normalizedPageHtml = normalizeHtmlLinks(page.html, isHome, project.pages);
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
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${normalizedPageHtml}
  ${includeJs ? `<script src="js/${jsFilename}"></script>` : ''}
</body>
</html>`;
            if (includePages) {
                zip.file(filename, htmlContent);
            }
            if (includeCss && cssFolder) {
                cssFolder.file(cssFilename, page.css || '');
            }
            if (includeJs && jsFolder) {
                jsFolder.file(jsFilename, page.js || '');
            }
        });
        // Add general configuration files
        if (includeReadme) {
            zip.file("README.md", `# ${project.name}\n\nSite exportado do construtor de sites Real Premise / AI Website Builder.\n\n## Estrutura dos Arquivos:\n- \`index.html\`: Página Principal (Home)\n- \`*.html\`: Demais páginas do site na raiz para funcionamento direto em qualquer servidor Web (Nginx, Apache, Vercel, Netlify, cPanel, S3, etc.)\n- \`css/\`: Folhas de estilo adicionais\n- \`js/\`: Scripts interativos\n`);
        }
        // Add Docker support inside ZIP
        if (includeDocker) {
            zip.file("Dockerfile", `FROM nginx:alpine
COPY *.html /usr/share/nginx/html/
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
