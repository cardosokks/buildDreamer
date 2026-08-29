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

    // Track active jobs and worker threads in memory
    private final Map<String, Map<String, Object>> activeJobs = new ConcurrentHashMap<>();
    private final Map<String, Thread> activeJobThreads = new ConcurrentHashMap<>();

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
        activeJobThreads.put(projectId, Thread.currentThread());
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
            activeJobThreads.remove(projectId);
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
                        .append(" mantendo todo o conteúdo, textos e imagens originais, mas recriando o design completo com HTML5 moderno e Tailwind CSS elegante e responsivo.\n")
                        .append("\nIMPORTANTE SOBRE LAYOUT GLOBALS (NAVBAR E FOOTER):\n")
                        .append("- Esta página é renderizada dentro de um layout estruturado com Flexbox (flex flex-col min-h-screen justify-between).\n")
                        .append("- A Navbar global fica no topo e o Footer global fica no rodapé. O conteúdo desta página é inserido dentro de um bloco `<main class=\"flex-grow w-full\">` que se expande automaticamente.\n")
                        .append("- Para que não ocorra quebras de design nem duplicidade de componentes: a Navbar deve ser a primeira tag semântica `<header>` ou `<nav>` no topo, e o Footer deve ser a última tag semântica `<footer>` no rodapé. Apenas crie-as na página principal (Página Inicial). Nas demais páginas, não crie menus ou rodapés repetitivos, foque apenas nas seções internas de conteúdo.\n");

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

                logs.add("Fila de Remasterização [" + (i + 1) + "/" + pages.size() + "]: Enviando página '" + pageName + "' (" + targetSlug + ") ao n8n com diretrizes personalizadas...");
                progress.put("progress", i + 1);
                progress.put("currentPage", pageName);

                Map<String, String> context = new HashMap<>();
                context.put("html", rawHtml);
                context.put("css", downloadedCss);
                context.put("js", downloadedJs);

                if (Thread.currentThread().isInterrupted() || "canceled".equalsIgnoreCase((String) progress.get("status"))) {
                    logs.add("Geração cancelada pelo usuário. Abortando worker.");
                    project.setStatus("ready");
                    projectRepository.save(project);
                    if (jobId != null && aiChatJobsQueue != null) {
                        Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                        jState.put("status", "canceled");
                    }
                    activeJobThreads.remove(projectId);
                    return;
                }

                final int pageNum = i + 1;
                final int totalPages = pages.size();

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
                                    jState.put("currentModel", model + " - Gerando " + pageName + " (" + pageNum + "/" + totalPages + ")");
                                    jState.put("attempt", attempt);
                                    jState.put("total", total);
                                }
                            },
                            () -> Thread.currentThread().isInterrupted() || "canceled".equalsIgnoreCase((String) progress.get("status"))
                    );

                    String html = (String) aiResult.getOrDefault("html", "<div></div>");
                    String css = (String) aiResult.getOrDefault("css", "");
                    String js = (String) aiResult.getOrDefault("js", "");
                    String usedModel = (String) aiResult.getOrDefault("_usedModel", "gemini-3.6-flash");

                    // Parse HTML using Jsoup to extract or remove navbar/footer elements
                    try {
                        org.jsoup.nodes.Document bodyDoc = Jsoup.parseBodyFragment(html);
                        org.jsoup.nodes.Element headerEl = bodyDoc.selectFirst("header, nav, div[id*='navbar'], div[class*='navbar'], div[id*='header'], div[class*='header']");
                        org.jsoup.nodes.Element footerEl = bodyDoc.selectFirst("footer, div[id*='footer'], div[class*='footer']");

                        if (i == 0) {
                            if (repeatNavbar && headerEl != null) {
                                project.setNavbarHtml(headerEl.outerHtml());
                                headerEl.remove();
                            } else if (repeatNavbar) {
                                project.setNavbarHtml("<header class=\"bg-slate-950 p-4\"><nav class=\"max-w-7xl mx-auto flex justify-between\"><a href=\"index.html\" class=\"text-xl font-bold\">" + project.getName() + "</a></nav></header>");
                            }

                            if (repeatFooter && footerEl != null) {
                                project.setFooterHtml(footerEl.outerHtml());
                                footerEl.remove();
                            } else if (repeatFooter) {
                                project.setFooterHtml("<footer class=\"bg-slate-950 p-8 text-center text-slate-500\">&copy; " + project.getName() + "</footer>");
                            }
                            projectRepository.save(project);
                        } else {
                            // On subsequent pages, strip any navbar/footer components so the project's global navbar/footer is used
                            if (repeatNavbar && headerEl != null) {
                                headerEl.remove();
                            }
                            if (repeatFooter && footerEl != null) {
                                footerEl.remove();
                            }
                        }
                        html = bodyDoc.body().html();
                    } catch (Exception parseEx) {
                        System.err.println("Erro ao extrair/remover navbar e footer na página " + pageName + ": " + parseEx.getMessage());
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

                    // Push intermediate page progress to aiChatJobsQueue for live UI tracking
                    if (jobId != null && aiChatJobsQueue != null) {
                        Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                        jState.put("status", "processing");
                        jState.put("currentModel", usedModel);
                        jState.put("currentPage", pageName);
                        jState.put("progress", i + 1);
                        jState.put("total", pages.size());
                        jState.put("scope", pages.size() > 1 ? "all" : "single");
                        jState.put("lastPageResult", Map.of(
                            "pageId", page.getId(),
                            "pageName", pageName,
                            "slug", targetSlug,
                            "html", html,
                            "css", css,
                            "js", js,
                            "explanation", "Página '" + pageName + "' (" + (i + 1) + "/" + pages.size() + ") remasterizada e salva no banco/canvas em tempo real.",
                            "_usedModel", usedModel
                        ));
                    }
                    logs.add("Sucesso [" + (i + 1) + "/" + pages.size() + "]: Página '" + pageName + "' remasterizada, aplicada no banco/canvas e sincronizada no MinIO!");
                } catch (Exception pageEx) {
                    if (Thread.currentThread().isInterrupted() || "canceled".equalsIgnoreCase((String) progress.get("status")) || pageEx instanceof InterruptedException) {
                        logs.add("Geração cancelada pelo usuário. Requisição ao n8n abortada com sucesso.");
                        project.setStatus("ready");
                        projectRepository.save(project);
                        if (jobId != null && aiChatJobsQueue != null) {
                            Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                            jState.put("status", "canceled");
                        }
                        activeJobThreads.remove(projectId);
                        return;
                    }

                    pageEx.printStackTrace();
                    logs.add("Erro na geração da página " + (i + 1) + "/" + pages.size() + " ('" + pageName + "'): " + pageEx.getMessage());

                    // Save structured fallback page so project generation continues for remaining pages
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
                }
            }

            project.setStatus("ready");
            projectRepository.save(project);

            logs.add("Todas as " + pages.size() + " páginas do projeto foram remasterizadas com sucesso!");
            progress.put("status", "completed");
            if (jobId != null && aiChatJobsQueue != null) {
                Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                jState.put("status", "completed");
                jState.put("progress", pages.size());
                jState.put("total", pages.size());
            }

        } catch (Exception ex) {
            progress.put("status", "canceled".equalsIgnoreCase((String) progress.get("status")) ? "canceled" : "error");
            progress.put("error", "Erro ao executar worker de geração: " + ex.getMessage());
            if (progress.get("logs") != null) {
                ((List<String>) progress.get("logs")).add("Erro/Cancelamento: " + ex.getMessage());
            }
            if (jobId != null && aiChatJobsQueue != null) {
                Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                jState.put("status", "canceled".equalsIgnoreCase((String) progress.get("status")) ? "canceled" : "failed");
                jState.put("error", ex.getMessage());
            }
        } finally {
            activeJobThreads.remove(projectId);
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
                ((List<String>) progress.get("logs")).add("Solicitação de cancelamento enviada pelo usuário. Interrompendo requisições ao n8n...");
            }
        }

        // Interrompe o Thread da geração síncrona/assíncrona para abortar requisições HTTP ao n8n imediatamente
        Thread workerThread = activeJobThreads.remove(projectId);
        if (workerThread != null && workerThread.isAlive()) {
            try {
                System.out.println("[SiteRemasterService] Interrompendo thread worker de n8n para projeto: " + projectId);
                workerThread.interrupt();
            } catch (Exception ignored) {}
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
