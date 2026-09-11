import { Router } from 'express';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { getAssetStream } from '../services/storageService';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';

const router = Router();

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Verifica se um texto é uma instrução/prompt interno da IA para evitar exportá-lo na meta tag description
 */
function isPromptText(str?: string | null): boolean {
  if (!str) return false;
  const s = str.trim();
  if (s.length > 250) return true;
  const lower = s.toLowerCase();
  return (
    lower.includes('prompt') ||
    lower.includes('diretríz') ||
    lower.includes('diretriz') ||
    lower.includes('obrigatori') ||
    lower.includes('obrigatóri') ||
    lower.includes('gere um website') ||
    lower.includes('você é um') ||
    lower.includes('theme engine') ||
    lower.includes('instruç') ||
    lower.includes('instruc') ||
    lower.includes('bento grid') ||
    lower.includes('spline-viewer') ||
    lower.includes('tailwind css') ||
    lower.includes('motor de injeção') ||
    lower.includes('regras técnicas') ||
    lower.includes('estrutura completa')
  );
}

function getCleanMetaDescription(pageDesc: string | null | undefined, projDesc: string | null | undefined, projectName: string, pageTitle: string): string {
  if (pageDesc && !isPromptText(pageDesc)) {
    return pageDesc.replace(/"/g, '&quot;').trim();
  }
  if (projDesc && !isPromptText(projDesc)) {
    return projDesc.replace(/"/g, '&quot;').trim();
  }
  return `${projectName} - ${pageTitle}. Website oficial com serviços, diferenciais e informações completas.`;
}

function stripPromptArtifacts(html: string): string {
  if (!html) return '';
  return html.replace(/<!--[\s\S]*?-->/g, (comment) => {
    const lower = comment.toLowerCase();
    if (
      lower.includes('prompt') ||
      lower.includes('diretríz') ||
      lower.includes('diretriz') ||
      lower.includes('instruç') ||
      lower.includes('instruc') ||
      lower.includes('gerar') ||
      lower.includes('regra')
    ) {
      return '';
    }
    return comment;
  });
}

/**
 * Normaliza links internos nas páginas HTML para funcionarem em qualquer hospedagem estática
 */
function normalizeHtmlLinks(html: string, isHome: boolean, allPages: Array<{ slug: string; isHomepage: boolean }>): string {
  if (!html) return '';

  return html.replace(/href=["']([^"']+)["']/gi, (match, fullHref) => {
    if (
      fullHref.startsWith('http://') ||
      fullHref.startsWith('https://') ||
      fullHref.startsWith('mailto:') ||
      fullHref.startsWith('tel:') ||
      fullHref.startsWith('#') ||
      fullHref.startsWith('javascript:')
    ) {
      return match;
    }

    // Extrair caminho principal, query string e âncoras (hash)
    const hashIndex = fullHref.indexOf('#');
    const pathAndSearch = hashIndex !== -1 ? fullHref.substring(0, hashIndex) : fullHref;
    const hash = hashIndex !== -1 ? fullHref.substring(hashIndex) : '';

    const queryIndex = pathAndSearch.indexOf('?');
    const pathPart = queryIndex !== -1 ? pathAndSearch.substring(0, queryIndex) : pathAndSearch;
    const search = queryIndex !== -1 ? pathAndSearch.substring(queryIndex) : '';

    const cleanHref = pathPart.replace(/^\//, '').replace(/^pages\//, '').replace(/\.html$/, '') || 'index';
    
    const targetPage = allPages.find(p => p.slug === cleanHref || (cleanHref === 'index' && p.isHomepage));
    if (!targetPage) return match;

    const newPath = targetPage.isHomepage ? 'index.html' : `${targetPage.slug}.html`;
    return `href="${newPath}${search}${hash}"`;
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
        pages: true,
        assets: true
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

    // Função auxiliar para coletar e empacotar mídias do HTML/CSS (MinIO ou disco)
    const processMediaInContent = async (content: string): Promise<string> => {
      if (!content || !includeAssets || !assetsFolder) return content;

      let rewritten = content;
      // Captura links do tipo /api/media/files/<filename>, http(s)://.../api/media/files/<filename>, /data/uploads/<filename>, uploads/<filename> ou assets/<filename>
      const mediaRegex = /(?:https?:\/\/[^\s"'()]+)?(?:\/api\/media\/files\/|\/data\/uploads\/|\/uploads\/|uploads\/|\/assets\/|assets\/)([^"'\s()#?]+)/gi;
      const matches = [...content.matchAll(mediaRegex)];

      for (const match of matches) {
        const fullMatch = match[0];
        const filename = match[1];

        if (bundledAssets.has(filename)) {
          rewritten = rewritten.split(fullMatch).join(`assets/${filename}`);
          continue;
        }

        try {
          const stream = await getAssetStream(filename);
          const buffer = await streamToBuffer(stream);
          assetsFolder.file(filename, buffer);
          bundledAssets.add(filename);
          rewritten = rewritten.split(fullMatch).join(`assets/${filename}`);
        } catch (e) {
          // Fallback para arquivo local em disco
          let filePath = path.join(uploadsDir, filename);
          if (!fs.existsSync(filePath)) {
            filePath = path.join(uploadsDirAlt, filename);
          }

          if (fs.existsSync(filePath)) {
            try {
              const fileBuf = fs.readFileSync(filePath);
              assetsFolder.file(filename, fileBuf);
              bundledAssets.add(filename);
              rewritten = rewritten.split(fullMatch).join(`assets/${filename}`);
            } catch (err) {
              console.warn(`[Export] Não foi possível ler arquivo local ${filename}:`, err);
            }
          } else {
            console.warn(`[Export] Mídia não encontrada para empacotar: ${filename}`);
          }
        }
      }

      return rewritten;
    };

    // Processar assets cadastrados explicitamente no projeto
    if (project.assets && project.assets.length > 0 && includeAssets && assetsFolder) {
      for (const asset of project.assets) {
        if (asset.url) {
          const parts = asset.url.split('/');
          const filename = parts[parts.length - 1];
          if (filename && !bundledAssets.has(filename)) {
            try {
              const stream = await getAssetStream(filename);
              const buffer = await streamToBuffer(stream);
              assetsFolder.file(filename, buffer);
              bundledAssets.add(filename);
            } catch {}
          }
        }
      }
    }

    // Processar Favicon do projeto
    let processedFavicon = project.favicon;
    if (processedFavicon && includeAssets && assetsFolder) {
      const matchFav = processedFavicon.match(/(?:\/api\/media\/files\/|\/data\/uploads\/|\/uploads\/|uploads\/|\/assets\/|assets\/)([^"'\s()#?]+)/i);
      if (matchFav) {
        const favFilename = matchFav[1];
        if (!bundledAssets.has(favFilename)) {
          try {
            const stream = await getAssetStream(favFilename);
            const buffer = await streamToBuffer(stream);
            assetsFolder.file(favFilename, buffer);
            bundledAssets.add(favFilename);
          } catch {}
        }
        processedFavicon = `assets/${favFilename}`;
      }
    }
    
    // Process pages and assets
    for (const page of project.pages) {
      const isHome = page.isHomepage;
      const filename = isHome ? "index.html" : `${page.slug}.html`;
      
      const cssFilename = `${page.slug}.css`;
      const jsFilename = `${page.slug}.js`;

      let normalizedPageHtml = normalizeHtmlLinks(page.html, isHome, project.pages);
      normalizedPageHtml = stripPromptArtifacts(normalizedPageHtml);
      normalizedPageHtml = await processMediaInContent(normalizedPageHtml);

      let processedCss = await processMediaInContent(page.css || '');

      const finalTitle = page.seoTitle || page.title || page.name || project.name;
      const finalDesc = getCleanMetaDescription(page.seoDescription || page.description, project.description, project.name, finalTitle);

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
  ${processedFavicon ? `<link rel="icon" href="${processedFavicon}">` : ''}
  <!-- CDNs e Tecnologias Injetadas -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Outfit:wght@100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&family=Sora:wght@100..800&family=Space+Grotesk:wght@300..700&family=Syne:wght@400..800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
  <script type="module" src="https://unpkg.com/@splinetool/viewer/build/spline-viewer.js"></script>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
  </style>
  ${includeCss ? `<link rel="stylesheet" href="css/${cssFilename}">` : ''}
</head>
<body class="min-h-screen">
  ${normalizedPageHtml}

  <!-- Scripts de Inicialização Global -->
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // 1. Lucide Icons
      if (window.lucide) { try { lucide.createIcons(); } catch(e){} }

      // 2. Lenis Smooth Scroll
      if (typeof Lenis !== 'undefined') {
        try {
          const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
          function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
          requestAnimationFrame(raf);
        } catch(e){}
      }

      // 3. GSAP ScrollTrigger Reveal
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        try {
          gsap.registerPlugin(ScrollTrigger);
          gsap.utils.toArray('.gsap-reveal').forEach(function(el) {
            gsap.from(el, { opacity: 0, y: 35, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
          });
        } catch(e){}
      }

      // 4. Swiper.js 3D Cards
      if (typeof Swiper !== 'undefined') {
        try {
          if (document.querySelector('.maps-reviews-swiper')) {
            new Swiper('.maps-reviews-swiper', {
              effect: 'cards',
              grabCursor: true,
              pagination: { el: '.swiper-pagination', clickable: true },
              autoplay: { delay: 4000, disableOnInteraction: false }
            });
          }
        } catch(e){}
      }

      // 5. Dynamic Business Status Badge
      function updateBusinessStatus() {
        const statusEl = document.getElementById('business-status-badge');
        if (statusEl) {
          const hour = new Date().getHours();
          const isOpen = hour >= 8 && hour < 21;
          if (isOpen) {
            statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block mr-1.5"></span><span class="text-emerald-400 font-bold">🟢 Aberto Agora</span>';
          } else {
            statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500 inline-block mr-1.5"></span><span class="text-rose-400 font-bold">🔴 Fechado • Abre às 08:00</span>';
          }
        }
      }
      updateBusinessStatus();
    });
  </script>
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
    }

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

