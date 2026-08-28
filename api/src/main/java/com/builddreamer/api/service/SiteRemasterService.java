package com.builddreamer.api.service;

import com.builddreamer.api.model.Page;
import com.builddreamer.api.model.Project;
import com.builddreamer.api.repository.PageRepository;
import com.builddreamer.api.repository.ProjectRepository;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.URL;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import java.util.regex.Pattern;
import java.util.regex.Matcher;

@Service
public class SiteRemasterService {

    private final GeminiService geminiService;
    private final ProjectRepository projectRepository;
    private final PageRepository pageRepository;
    private final StorageService storageService;

    // Track active jobs in memory
    private final Map<String, Map<String, Object>> activeJobs = new ConcurrentHashMap<>();

    public SiteRemasterService(
            GeminiService geminiService,
            ProjectRepository projectRepository,
            PageRepository pageRepository,
            StorageService storageService) {
        this.geminiService = geminiService;
        this.projectRepository = projectRepository;
        this.pageRepository = pageRepository;
        this.storageService = storageService;
    }

    public List<Map<String, Object>> crawlEntireClientWebsite(String startUrl, int maxPages) {
        List<Map<String, Object>> pages = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        Queue<String> queue = new LinkedList<>();

        String normalizedUrl = startUrl.trim();
        if (!normalizedUrl.startsWith("http")) {
            normalizedUrl = "https://" + normalizedUrl;
        }

        queue.add(normalizedUrl);
        String host = "";
        try {
            host = new URI(normalizedUrl).getHost();
        } catch (Exception ignored) {}

        while (!queue.isEmpty() && pages.size() < maxPages) {
            String currentUrl = queue.poll();
            if (visited.contains(currentUrl)) continue;
            visited.add(currentUrl);

            try {
                Document doc = Jsoup.connect(currentUrl)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                        .timeout(12000)
                        .ignoreHttpErrors(true)
                        .get();

                String title = doc.title();
                String bodyHtml = doc.body() != null ? doc.body().html() : doc.html();
                String bodyText = doc.body() != null ? doc.body().text() : "";
                
                // Extract inline CSS styles
                StringBuilder cssSb = new StringBuilder();
                for (Element style : doc.select("style")) {
                    cssSb.append(style.html()).append("\n");
                }
                String extractedCss = cssSb.toString();

                // Extract inline JS scripts
                StringBuilder jsSb = new StringBuilder();
                for (Element script : doc.select("script")) {
                    if (!script.hasAttr("src") && !script.html().trim().isEmpty()) {
                        jsSb.append(script.html()).append("\n");
                    }
                }
                String extractedJs = jsSb.toString();

                // Get slug
                String slug = "index";
                try {
                    String path = new URL(currentUrl).getPath();
                    if (path != null && !path.isEmpty() && !"/".equals(path)) {
                        slug = path.substring(path.lastIndexOf('/') + 1).replace(".html", "").replace(".php", "");
                    }
                } catch (Exception ignored) {}
                if (slug.isEmpty() || "home".equalsIgnoreCase(slug)) {
                    slug = "index";
                }

                // Extract page media (Images, Logos, Backgrounds, Videos)
                List<Map<String, Object>> pageMedia = new ArrayList<>();
                Set<String> seenMediaUrls = new HashSet<>();

                // 1. <img> tags
                for (Element img : doc.select("img")) {
                    String srcAttr = img.hasAttr("data-src") ? "data-src" :
                                    img.hasAttr("data-lazy-src") ? "data-lazy-src" :
                                    img.hasAttr("src") ? "src" : null;
                    if (srcAttr == null) continue;
                    
                    String rawSrc = img.attr(srcAttr);
                    if (rawSrc.isEmpty() || rawSrc.startsWith("data:") || rawSrc.startsWith("blob:")) continue;

                    String absUrl = img.absUrl(srcAttr);
                    if (absUrl.isEmpty()) {
                        try {
                            absUrl = new URL(new URL(currentUrl), rawSrc).toString();
                        } catch (Exception ignored) {}
                    }

                    if (absUrl.isEmpty() || seenMediaUrls.contains(absUrl) || absUrl.contains("pixel") || absUrl.contains("tracking") || absUrl.contains("favicon")) continue;

                    seenMediaUrls.add(absUrl);
                    String alt = img.attr("alt");
                    String cls = img.attr("class").toLowerCase();
                    String lowerUrl = absUrl.toLowerCase();

                    String role = "content";
                    if (lowerUrl.contains("logo") || alt.toLowerCase().contains("logo") || cls.contains("logo") || cls.contains("brand") || cls.contains("marca")) {
                        role = "logo";
                    } else if (lowerUrl.contains("hero") || lowerUrl.contains("banner") || lowerUrl.contains("destaque") || cls.contains("hero") || cls.contains("banner") || cls.contains("cover")) {
                        role = "hero";
                    } else if (lowerUrl.contains("card") || lowerUrl.contains("servico") || lowerUrl.contains("produto") || cls.contains("card") || cls.contains("item")) {
                        role = "card";
                    }

                    Map<String, Object> mediaItem = new HashMap<>();
                    mediaItem.put("url", absUrl);
                    mediaItem.put("alt", alt.trim().isEmpty() ? (title.isEmpty() ? slug : title) + " Imagem" : alt.trim());
                    mediaItem.put("type", "logo".equals(role) ? "logo" : "image");
                    mediaItem.put("role", role);
                    pageMedia.add(mediaItem);
                }

                // 2. Background images in inline styles or tags
                Elements elementsWithStyle = doc.select("[style*='url']");
                for (Element el : elementsWithStyle) {
                    String styleAttr = el.attr("style");
                    Matcher m = Pattern.compile("url\\(['\"]?([^'\")\\s]+\\.(?:png|jpe?g|webp|svg|gif)(?:\\?[^'\")\\s]*)?)['\"]?\\)", Pattern.CASE_INSENSITIVE).matcher(styleAttr);
                    while (m.find()) {
                        String bgSrc = m.group(1);
                        String absUrl = "";
                        try {
                            absUrl = new URL(new URL(currentUrl), bgSrc).toString();
                        } catch (Exception ignored) {}
                        if (!absUrl.isEmpty() && !seenMediaUrls.contains(absUrl) && !absUrl.contains("pixel")) {
                            seenMediaUrls.add(absUrl);
                            Map<String, Object> mediaItem = new HashMap<>();
                            mediaItem.put("url", absUrl);
                            mediaItem.put("alt", (title.isEmpty() ? slug : title) + " Background");
                            mediaItem.put("type", "image");
                            mediaItem.put("role", "hero");
                            pageMedia.add(mediaItem);
                        }
                    }
                }

                // 3. Videos
                for (Element video : doc.select("video, iframe[src*='youtube'], iframe[src*='vimeo']")) {
                    String vSrc = video.attr("src");
                    String absUrl = video.absUrl("src");
                    if (absUrl.isEmpty() && !vSrc.isEmpty()) {
                        try {
                            absUrl = new URL(new URL(currentUrl), vSrc).toString();
                        } catch (Exception ignored) {}
                    }
                    if (!absUrl.isEmpty() && !seenMediaUrls.contains(absUrl)) {
                        seenMediaUrls.add(absUrl);
                        Map<String, Object> mediaItem = new HashMap<>();
                        mediaItem.put("url", absUrl);
                        mediaItem.put("alt", (title.isEmpty() ? slug : title) + " Vídeo");
                        mediaItem.put("type", "video");
                        mediaItem.put("role", "video");
                        pageMedia.add(mediaItem);
                    }
                }

                Map<String, Object> pageData = new HashMap<>();
                pageData.put("name", title.isEmpty() ? slug : title);
                pageData.put("slug", slug);
                pageData.put("url", currentUrl);
                pageData.put("html", bodyHtml);
                pageData.put("css", extractedCss);
                pageData.put("js", extractedJs);
                pageData.put("rawHtml", bodyHtml.length() > 20000 ? bodyHtml.substring(0, 20000) : bodyHtml);
                pageData.put("cleanText", bodyText.length() > 5000 ? bodyText.substring(0, 5000) : bodyText);
                pageData.put("isHomepage", "index".equals(slug) || pages.isEmpty());
                pageData.put("media", pageMedia);

                pages.add(pageData);

                // Find other links on same domain
                Elements links = doc.select("a[href]");
                for (Element link : links) {
                    String absUrl = link.absUrl("href");
                    try {
                        String linkHost = new URI(absUrl).getHost();
                        if (host.equals(linkHost) && !visited.contains(absUrl) && !queue.contains(absUrl)) {
                            queue.add(absUrl);
                        }
                    } catch (Exception ignored) {}
                }
            } catch (Exception ex) {
                System.err.println("Failed crawling url " + currentUrl + ": " + ex.getMessage());
            }
        }
        return pages;
    }

    public Map<String, Object> getJobStatus(String projectId) {
        return activeJobs.getOrDefault(projectId, Collections.emptyMap());
    }

    @Async
    public void runRemasterGenerationJob(
            String jobId,
            String projectId,
            List<Map<String, Object>> pages,
            boolean repeatNavbar,
            boolean repeatFooter,
            String apiKey,
            List<String> models,
            Map<String, Map<String, Object>> aiChatJobsQueue,
            String customAiSkills,
            List<String> projectMediaUrls
    ) {
        Map<String, Object> progress = new ConcurrentHashMap<>();
        progress.put("status", "starting");
        progress.put("progress", 0);
        progress.put("total", pages.size());
        progress.put("logs", new ArrayList<String>());
        activeJobs.put(projectId, progress);

        Optional<Project> projectOpt = projectRepository.findById(projectId);
        if (projectOpt.isEmpty()) {
            progress.put("status", "error");
            progress.put("error", "Projeto não encontrado");
            if (jobId != null && aiChatJobsQueue != null) {
                Map<String, Object> jState = new ConcurrentHashMap<>();
                jState.put("status", "failed");
                jState.put("error", "Projeto não encontrado");
                aiChatJobsQueue.put(jobId, jState);
            }
            return;
        }

        Project project = projectOpt.get();

        try {
            List<String> logs = (List<String>) progress.get("logs");
            
            // Set basic structure status
            logs.add("Importando mídias e organizando estrutura...");
            progress.put("status", "generating");

            for (int i = 0; i < pages.size(); i++) {
                Map<String, Object> pMap = pages.get(i);
                String pageName = (String) pMap.get("name");
                String rawSlug = (String) pMap.get("slug");
                final String targetSlug = ("home".equalsIgnoreCase(rawSlug) || rawSlug == null || rawSlug.trim().isEmpty()) ? "index" : rawSlug.trim();

                String rawHtml = (String) pMap.get("rawHtml");
                if (rawHtml == null || rawHtml.isEmpty()) {
                    rawHtml = (String) pMap.get("html");
                }
                if (rawHtml == null || rawHtml.isEmpty()) {
                    rawHtml = (String) pMap.getOrDefault("cleanText", "Conteúdo original da página: " + pageName);
                }

                String downloadedCss = (String) pMap.getOrDefault("css", "");
                String downloadedJs = (String) pMap.getOrDefault("js", "");

                // Truncate overly long raw HTML to avoid Gemini API token/context limit errors
                if (rawHtml != null && rawHtml.length() > 12000) {
                    rawHtml = rawHtml.substring(0, 12000) + "... [Conteúdo truncado para otimização da IA]";
                }

                String customPrompt = (String) pMap.get("customPrompt");
                StringBuilder promptBuilder = new StringBuilder();
                promptBuilder.append("Remasterizar a página ").append(pageName)
                        .append(" mantendo todo o conteúdo, textos e imagens originais, mas recriando o design completo com HTML5 moderno e Tailwind CSS elegante e responsivo.\n");

                if (customPrompt != null && !customPrompt.trim().isEmpty()) {
                    promptBuilder.append("\nDIRETRIZES DO USUÁRIO PARA ESTA PÁGINA:\n").append(customPrompt.trim()).append("\n");
                }

                if (customAiSkills != null && !customAiSkills.trim().isEmpty()) {
                    promptBuilder.append("\nHABILIDADES / SKILLS DE DESIGN APLICADAS:\n").append(customAiSkills.trim()).append("\n");
                }

                if (projectMediaUrls != null && !projectMediaUrls.isEmpty()) {
                    promptBuilder.append("\nMÍDIAS CADASTRADAS NO PROJETO DISPONÍVEIS PARA INSERÇÃO NAS PÁGINAS:\n");
                    for (String mediaUrl : projectMediaUrls) {
                        promptBuilder.append("- ").append(mediaUrl).append("\n");
                    }
                }

                String prompt = promptBuilder.toString();

                logs.add("IA gerando página: " + pageName + " (Slug: " + targetSlug + ")...");
                progress.put("progress", i + 1);

                Map<String, String> context = new HashMap<>();
                context.put("html", rawHtml);
                context.put("css", downloadedCss);
                context.put("js", downloadedJs);

                if ("canceled".equalsIgnoreCase((String) progress.get("status"))) {
                    logs.add("Geração cancelada pelo usuário.");
                    project.setStatus("ready");
                    projectRepository.save(project);
                    if (jobId != null && aiChatJobsQueue != null) {
                        Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                        jState.put("status", "canceled");
                    }
                    return;
                }

                try {
                    Map<String, Object> aiResult = geminiService.generateAIResponse(
                            prompt,
                            context,
                            apiKey,
                            null,
                            models,
                            (model, attempt, total) -> {
                                if (jobId != null && aiChatJobsQueue != null) {
                                    Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                                    jState.put("status", "processing");
                                    jState.put("currentModel", model);
                                    jState.put("attempt", attempt);
                                    jState.put("total", total);
                                }
                            }
                    );

                    String html = (String) aiResult.getOrDefault("html", "<div></div>");
                    String css = (String) aiResult.getOrDefault("css", "");
                    String js = (String) aiResult.getOrDefault("js", "");
                    String usedModel = (String) aiResult.getOrDefault("_usedModel", "gemini-3.6-flash");

                    // Exclude navbar/footer global components if desired
                    if (i == 0) {
                        if (repeatNavbar) {
                            project.setNavbarHtml("<header class=\"bg-slate-950 p-4\"><nav class=\"max-w-7xl mx-auto flex justify-between\"><a href=\"index.html\" class=\"text-xl font-bold\">" + project.getName() + "</a></nav></header>");
                        }
                        if (repeatFooter) {
                            project.setFooterHtml("<footer class=\"bg-slate-950 p-8 text-center text-slate-500\">&copy; " + project.getName() + "</footer>");
                        }
                    }

                    // Check if page already exists by slug or is homepage, otherwise create new
                    Optional<Page> existingPage = pageRepository.findByProjectIdAndSlug(project.getId(), targetSlug);
                    if (existingPage.isEmpty() && ("index".equals(targetSlug) || "home".equals(targetSlug))) {
                        List<Page> projectPages = pageRepository.findByProjectId(project.getId());
                        existingPage = projectPages.stream().filter(Page::isHomepage).findFirst();
                    }

                    Page page = existingPage.orElseGet(() -> Page.builder()
                            .project(project)
                            .slug(targetSlug)
                            .build());

                    page.setName(pageName);
                    page.setHtml(html);
                    page.setCss(css);
                    page.setJs(js);
                    page.setHomepage("index".equals(targetSlug) || i == 0);

                    pageRepository.save(page);

                    // Sync page to MinIO storage
                    try {
                        storageService.uploadSinglePage(project.getName(), page.getSlug(), page.getHtml(), page.getCss(), page.getJs(), page.isHomepage(), project.getNavbarHtml(), project.getFooterHtml());
                    } catch (Exception ignored) {}

                    // Push job completion result to aiChatJobsQueue for Chat tracking
                    if (jobId != null && aiChatJobsQueue != null) {
                        Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                        jState.put("status", "completed");
                        jState.put("currentModel", usedModel);
                        jState.put("scope", pages.size() > 1 ? "all" : "single");
                        jState.put("result", Map.of(
                            "explanation", "Página '" + pageName + "' remasterizada com IA com sucesso.",
                            "html", html,
                            "css", css,
                            "js", js,
                            "_usedModel", usedModel
                        ));
                    }
                } catch (Exception pageEx) {
                    pageEx.printStackTrace();
                    logs.add("Erro na geração da página '" + pageName + "': " + pageEx.getMessage());

                    // Save structured fallback page so project generation continues
                    Optional<Page> existingPage = pageRepository.findByProjectIdAndSlug(project.getId(), targetSlug);
                    Page page = existingPage.orElseGet(() -> Page.builder()
                            .project(project)
                            .slug(targetSlug)
                            .build());

                    page.setName(pageName);
                    page.setHomepage("index".equals(targetSlug) || i == 0);
                    if (page.getHtml() == null || page.getHtml().isEmpty() || page.getHtml().contains("Reconstruindo")) {
                        page.setHtml("<section class=\"min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center\">\n" +
                                "  <h1 class=\"text-3xl font-bold mb-4\">" + pageName + "</h1>\n" +
                                "  <p class=\"text-slate-400 max-w-lg mb-6\">A IA encontrou uma instabilidade ao gerar esta página automaticamente (" + pageEx.getMessage() + "). Você pode gerar ou ajustar esta página a qualquer momento no Chat de IA ao lado.</p>\n" +
                                "</section>");
                    }
                    pageRepository.save(page);

                    if (jobId != null && aiChatJobsQueue != null) {
                        Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                        jState.put("status", "failed");
                        jState.put("error", "Erro ao gerar página '" + pageName + "': " + pageEx.getMessage());
                    }
                }
            }

            project.setStatus("ready");
            projectRepository.save(project);

            logs.add("Projeto remasterizado com sucesso!");
            progress.put("status", "completed");

        } catch (Exception ex) {
            progress.put("status", "error");
            progress.put("error", "Erro ao executar worker de geração: " + ex.getMessage());
            if (progress.get("logs") != null) {
                ((List<String>) progress.get("logs")).add("Erro: " + ex.getMessage());
            }
            if (jobId != null && aiChatJobsQueue != null) {
                Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                jState.put("status", "failed");
                jState.put("error", ex.getMessage());
            }
        }
    }
    private final Map<String, Map<String, Object>> scrapeJobs = new ConcurrentHashMap<>();

    public Map<String, Object> getScrapeJobStatus(String jobId) {
        return scrapeJobs.getOrDefault(jobId, Collections.emptyMap());
    }

    @Async
    public void runScrapeJob(String jobId, String url, int maxPages) {
        Map<String, Object> jobData = new ConcurrentHashMap<>();
        jobData.put("status", "scraping");
        jobData.put("progressMessage", "Conectando e descobrindo subpáginas...");
        scrapeJobs.put(jobId, jobData);

        try {
            List<Map<String, Object>> pages = crawlEntireClientWebsite(url, maxPages);
            jobData.put("status", "completed");
            jobData.put("progressMessage", "Extração finalizada com sucesso!");
            jobData.put("discoveredPages", pages);
        } catch (Exception ex) {
            jobData.put("status", "failed");
            jobData.put("error", ex.getMessage());
        }
    }

    public boolean cancelJob(String projectId) {
        Map<String, Object> progress = activeJobs.get(projectId);
        if (progress != null) {
            progress.put("status", "canceled");
            if (progress.get("logs") != null) {
                ((List<String>) progress.get("logs")).add("Solicitação de cancelamento enviada pelo usuário.");
            }
        }
        Optional<Project> projOpt = projectRepository.findById(projectId);
        if (projOpt.isPresent()) {
            Project proj = projOpt.get();
            proj.setStatus("ready");
            projectRepository.save(proj);
        }
        return true;
    }
}
