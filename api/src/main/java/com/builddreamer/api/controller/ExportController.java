package com.builddreamer.api.controller;

import com.builddreamer.api.model.Media;
import com.builddreamer.api.model.Page;
import com.builddreamer.api.model.Project;
import com.builddreamer.api.repository.MediaRepository;
import com.builddreamer.api.repository.ProjectRepository;
import com.builddreamer.api.repository.ProjectMemberRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final MediaRepository mediaRepository;
    private final String uploadDir = "uploads";

    public ExportController(ProjectRepository projectRepository, ProjectMemberRepository projectMemberRepository, MediaRepository mediaRepository) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.mediaRepository = mediaRepository;
    }

    /**
     * Normalizes internal links and rewrites media links to the local "media/" directory
     */
    private String normalizeHtmlLinks(String html, boolean isHome, List<Page> allPages, String projectId) {
        if (html == null || html.isEmpty()) {
            return "";
        }

        String processedHtml = html;

        // 1. Rewrite project uploads URLs (e.g. /uploads/projectId_name) to local media/name
        if (projectId != null) {
            // Match both full url paths or relative paths pointing to the uploads folder
            String regex = "(?:https?:\\/[^\"'/]+)?\\/uploads\\/([^\"'>\\s)]+)";
            Pattern p = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
            Matcher m = p.matcher(processedHtml);
            StringBuffer sb = new StringBuffer();
            while (m.find()) {
                String fullFilename = m.group(1);
                // Extract original filename by skipping the UUID part (first 36 chars + underscore)
                String originalFilename = fullFilename;
                if (fullFilename.length() > 37 && fullFilename.contains("_")) {
                    int underscoreIdx = fullFilename.indexOf("_");
                    originalFilename = fullFilename.substring(underscoreIdx + 1);
                }
                m.appendReplacement(sb, "media/" + originalFilename);
            }
            m.appendTail(sb);
            processedHtml = sb.toString();
        }

        // 2. Normalize internal navigation links
        Pattern linkPattern = Pattern.compile("href=[\"']([^\"'#?]+)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher linkMatcher = linkPattern.matcher(processedHtml);
        StringBuffer sbLink = new StringBuffer();
        while (linkMatcher.find()) {
            String href = linkMatcher.group(1);
            if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
                linkMatcher.appendReplacement(sbLink, linkMatcher.group(0));
                continue;
            }

            // Extract the slug
            String cleanHref = href.replaceAll("^/", "").replaceAll("^pages/", "").replaceAll("\\.html$", "");
            if (cleanHref.isEmpty()) {
                cleanHref = "index";
            }

            final String finalCleanHref = cleanHref;
            Optional<Page> targetPage = allPages.stream()
                    .filter(p -> p.getSlug().equalsIgnoreCase(finalCleanHref) || (finalCleanHref.equals("index") && p.isHomepage()))
                    .findFirst();

            if (targetPage.isPresent()) {
                if (targetPage.get().isHomepage()) {
                    linkMatcher.appendReplacement(sbLink, "href=\"index.html\"");
                } else {
                    linkMatcher.appendReplacement(sbLink, "href=\"" + targetPage.get().getSlug() + ".html\"");
                }
            } else {
                linkMatcher.appendReplacement(sbLink, linkMatcher.group(0));
            }
        }
        linkMatcher.appendTail(sbLink);
        return sbLink.toString();
    }

    @GetMapping("/{projectId}")
    public void exportProject(
            @AuthenticationPrincipal String userId,
            @PathVariable String projectId,
            @RequestParam(required = false, defaultValue = "true") boolean pages,
            @RequestParam(required = false, defaultValue = "true") boolean css,
            @RequestParam(required = false, defaultValue = "true") boolean js,
            @RequestParam(required = false, defaultValue = "true") boolean media,
            @RequestParam(required = false, defaultValue = "true") boolean docker,
            @RequestParam(required = false, defaultValue = "true") boolean readme,
            HttpServletResponse response) throws IOException {

        // Validate access
        boolean isMember = projectMemberRepository.findByProjectIdAndUserId(projectId, userId).isPresent();
        if (!isMember) {
            response.sendError(HttpStatus.FORBIDDEN.value(), "Acesso negado ao projeto");
            return;
        }

        Optional<Project> projectOpt = projectRepository.findById(projectId);
        if (projectOpt.isEmpty()) {
            response.sendError(HttpStatus.NOT_FOUND.value(), "Projeto não encontrado");
            return;
        }

        Project project = projectOpt.get();
        List<Page> projectPages = project.getPages();

        response.setContentType("application/zip");
        String sanitizedName = project.getName().toLowerCase().replaceAll("[^a-z0-9]+", "-");
        response.setHeader("Content-Disposition", "attachment; filename=project-" + sanitizedName + ".zip");

        try (ZipOutputStream zos = new ZipOutputStream(response.getOutputStream())) {
            // 1. Package Project Media
            if (media) {
                List<Media> projectMedias = mediaRepository.findByProjectId(projectId);
                for (Media m : projectMedias) {
                    // File name structure is fileId_name
                    String diskFilename = m.getId() + "_" + m.getName();
                    File diskFile = new File(uploadDir, diskFilename);
                    if (diskFile.exists() && diskFile.isFile()) {
                        byte[] fileData = Files.readAllBytes(diskFile.toPath());
                        ZipEntry entry = new ZipEntry("media/" + m.getName());
                        zos.putNextEntry(entry);
                        zos.write(fileData);
                        zos.closeEntry();
                    }
                }
            }

            // 2. Package HTML, CSS, JS Pages
            for (Page page : projectPages) {
                boolean isHome = page.isHomepage();
                String htmlFilename = isHome ? "index.html" : page.getSlug() + ".html";
                String cssFilename = page.getSlug() + ".css";
                String jsFilename = page.getSlug() + ".js";

                String normalizedPageHtml = normalizeHtmlLinks(page.getHtml(), isHome, projectPages, projectId);
                String normalizedNavbarHtml = normalizeHtmlLinks(project.getNavbarHtml(), isHome, projectPages, projectId);
                String normalizedFooterHtml = normalizeHtmlLinks(project.getFooterHtml(), isHome, projectPages, projectId);

                // Build full static HTML page
                String htmlContent = "<!DOCTYPE html>\n" +
                        "<html lang=\"pt-BR\">\n" +
                        "<head>\n" +
                        "  <meta charset=\"UTF-8\">\n" +
                        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                        "  <title>" + (page.getTitle() != null ? page.getTitle() : page.getName()) + "</title>\n" +
                        "  <script src=\"https://cdn.tailwindcss.com\"></script>\n" +
                        "  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap\" rel=\"stylesheet\">\n" +
                        "  <style>\n" +
                        "    body { font-family: 'Inter', sans-serif; }\n" +
                        "    h1,h2,h3,h4,h5,h6 { font-family: 'Outfit', sans-serif; }\n" +
                        "  </style>\n" +
                        (css ? "  <link rel=\"stylesheet\" href=\"css/" + cssFilename + "\">\n" : "") +
                        "</head>\n" +
                        "<body class=\"bg-slate-950 text-slate-100 min-h-screen flex flex-col\">\n" +
                        "  " + normalizedNavbarHtml + "\n" +
                        "  <main class=\"flex-grow\">\n" +
                        "    " + normalizedPageHtml + "\n" +
                        "  </main>\n" +
                        "  " + normalizedFooterHtml + "\n" +
                        (js ? "  <script src=\"js/" + jsFilename + "\"></script>\n" : "") +
                        "</body>\n" +
                        "</html>";

                if (pages) {
                    ZipEntry htmlEntry = new ZipEntry(htmlFilename);
                    zos.putNextEntry(htmlEntry);
                    zos.write(htmlContent.getBytes(StandardCharsets.UTF_8));
                    zos.closeEntry();
                }

                if (css) {
                    String rawCss = page.getCss() != null && !page.getCss().trim().isEmpty()
                            ? page.getCss()
                            : "/* Estilos personalizados da página " + page.getName() + " */\n";
                    String normalizedCss = normalizeHtmlLinks(rawCss, isHome, projectPages, projectId);
                    ZipEntry cssEntry = new ZipEntry("css/" + cssFilename);
                    zos.putNextEntry(cssEntry);
                    zos.write(normalizedCss.getBytes(StandardCharsets.UTF_8));
                    zos.closeEntry();
                }

                if (js) {
                    String rawJs = page.getJs() != null && !page.getJs().trim().isEmpty()
                            ? page.getJs()
                            : "// Scripts interativos da página " + page.getName() + "\n";
                    ZipEntry jsEntry = new ZipEntry("js/" + jsFilename);
                    zos.putNextEntry(jsEntry);
                    zos.write(rawJs.getBytes(StandardCharsets.UTF_8));
                    zos.closeEntry();
                }
            }

            // 3. Package README.md
            if (readme) {
                String readmeContent = "# " + project.getName() + "\n\n" +
                        "Site exportado do construtor de sites Real Premise / AI Website Builder.\n\n" +
                        "## Estrutura dos Arquivos:\n" +
                        "- `index.html`: Página Principal (Home - basta abrir direto no navegador)\n" +
                        "- `*.html`: Demais páginas do site na raiz para funcionamento direto em qualquer servidor Web (Nginx, Apache, Vercel, Netlify, cPanel, S3, etc.)\n" +
                        "- `media/`: Imagens, logos, banners e arquivos estáticos locais\n" +
                        "- `css/`: Folhas de estilo adicionais\n" +
                        "- `js/`: Scripts interativos\n";

                ZipEntry readmeEntry = new ZipEntry("README.md");
                zos.putNextEntry(readmeEntry);
                zos.write(readmeContent.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }

            // 4. Package Docker files
            if (docker) {
                String dockerfileContent = "FROM nginx:alpine\n" +
                        "COPY *.html /usr/share/nginx/html/\n" +
                        (media ? "COPY media/ /usr/share/nginx/html/media/\n" : "") +
                        (css ? "COPY css/ /usr/share/nginx/html/css/\n" : "") +
                        (js ? "COPY js/ /usr/share/nginx/html/js/\n" : "") +
                        "EXPOSE 80\n" +
                        "CMD [\"nginx\", \"-g\", \"daemon off;\"]";

                ZipEntry dockerfileEntry = new ZipEntry("Dockerfile");
                zos.putNextEntry(dockerfileEntry);
                zos.write(dockerfileContent.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();

                String composeContent = "version: '3.8'\n" +
                        "services:\n" +
                        "  web:\n" +
                        "    build: .\n" +
                        "    ports:\n" +
                        "      - \"8080:80\"";

                ZipEntry composeEntry = new ZipEntry("docker-compose.yml");
                zos.putNextEntry(composeEntry);
                zos.write(composeContent.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
        }
    }
}
