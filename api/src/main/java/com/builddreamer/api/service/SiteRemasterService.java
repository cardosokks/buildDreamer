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

@Service
public class SiteRemasterService {

    private final GeminiService geminiService;
    private final ProjectRepository projectRepository;
    private final PageRepository pageRepository;

    // Track active jobs in memory
    private final Map<String, Map<String, Object>> activeJobs = new ConcurrentHashMap<>();

    public SiteRemasterService(
            GeminiService geminiService,
            ProjectRepository projectRepository,
            PageRepository pageRepository) {
        this.geminiService = geminiService;
        this.projectRepository = projectRepository;
        this.pageRepository = pageRepository;
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
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                        .timeout(10000)
                        .ignoreHttpErrors(true)
                        .get();

                String title = doc.title();
                String bodyHtml = doc.body() != null ? doc.body().html() : doc.html();
                String bodyText = doc.body() != null ? doc.body().text() : "";
                
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

                Map<String, Object> pageData = new HashMap<>();
                pageData.put("name", title.isEmpty() ? slug : title);
                pageData.put("slug", slug);
                pageData.put("url", currentUrl);
                pageData.put("rawHtml", bodyHtml.length() > 20000 ? bodyHtml.substring(0, 20000) : bodyHtml);
                pageData.put("cleanText", bodyText.length() > 5000 ? bodyText.substring(0, 5000) : bodyText);
                pageData.put("media", new ArrayList<>());

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
            String projectId,
            List<Map<String, Object>> pages,
            boolean repeatNavbar,
            boolean repeatFooter,
            String apiKey,
            List<String> models
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
                String slug = (String) pMap.get("slug");
                if ("home".equalsIgnoreCase(slug)) slug = "index";

                String rawHtml = (String) pMap.get("rawHtml");
                if (rawHtml == null || rawHtml.isEmpty()) {
                    rawHtml = (String) pMap.getOrDefault("cleanText", "Conteúdo original da página: " + pageName);
                }

                logs.add("IA gerando página: " + pageName + " (Slug: " + slug + ")...");
                progress.put("progress", i + 1);

                Map<String, String> context = new HashMap<>();
                context.put("html", rawHtml);
                context.put("css", "");
                context.put("js", "");

                String prompt = "Remasterizar a página " + pageName + " mantendo todo o conteúdo, textos e imagens originais, mas recriando o design completo com HTML5 moderno e Tailwind CSS elegante e responsivo.";

                Map<String, Object> aiResult = geminiService.generateAIResponse(
                        prompt,
                        context,
                        apiKey,
                        null,
                        models
                );

                String html = (String) aiResult.getOrDefault("html", "<div></div>");
                String css = (String) aiResult.getOrDefault("css", "");
                String js = (String) aiResult.getOrDefault("js", "");

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
                Optional<Page> existingPage = pageRepository.findByProjectIdAndSlug(project.getId(), slug);
                if (existingPage.isEmpty() && ("index".equals(slug) || "home".equals(slug))) {
                    List<Page> projectPages = pageRepository.findByProjectId(project.getId());
                    existingPage = projectPages.stream().filter(Page::isHomepage).findFirst();
                }

                Page page = existingPage.orElseGet(() -> Page.builder()
                        .project(project)
                        .slug(slug)
                        .build());

                page.setName(pageName);
                page.setHtml(html);
                page.setCss(css);
                page.setJs(js);
                page.setHomepage("index".equals(slug) || i == 0);

                pageRepository.save(page);
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
}
