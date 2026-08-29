package com.builddreamer.api.service;

import com.builddreamer.api.model.Page;
import com.builddreamer.api.model.Project;
import com.builddreamer.api.model.ProjectMember;
import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.PageRepository;
import com.builddreamer.api.repository.ProjectMemberRepository;
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
    private final ProjectMemberRepository projectMemberRepository;
    private final StorageService storageService;

    // Track active jobs and worker threads in memory
    private final Map<String, Map<String, Object>> activeJobs = new ConcurrentHashMap<>();
    private final Map<String, Thread> activeJobThreads = new ConcurrentHashMap<>();

    public SiteRemasterService(
            GeminiService geminiService,
            ProjectRepository projectRepository,
            PageRepository pageRepository,
            ProjectMemberRepository projectMemberRepository,
            StorageService storageService) {
        this.geminiService = geminiService;
        this.projectRepository = projectRepository;
        this.pageRepository = pageRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.storageService = storageService;
    }

    public List<Map<String, Object>> crawlEntireClientWebsite(String startUrl, int maxPages) {
        List<Map<String, Object>> pages = new ArrayList<>();
        Set<String> visitedUrls = new HashSet<>();
        Set<String> seenSlugs = new HashSet<>();
        Set<String> globalSeenMedia = new HashSet<>();
        Queue<String> queue = new LinkedList<>();

        String normalizedUrl = startUrl.trim();
        if (!normalizedUrl.startsWith("http")) {
            normalizedUrl = "https://" + normalizedUrl;
        }

        String baseCleanUrl = normalizedUrl.replaceAll("#.*$", "").replaceAll("\\?.*$", "");
        queue.add(baseCleanUrl);

        String mainHost = "";
        try {
            URI u = new URI(baseCleanUrl);
            mainHost = u.getHost() != null ? u.getHost().replaceAll("^www\\.", "").toLowerCase() : "";
        } catch (Exception ignored) {}

        while (!queue.isEmpty() && pages.size() < maxPages) {
            String currentUrl = queue.poll();
            if (currentUrl == null || currentUrl.trim().isEmpty()) continue;

            String cleanCurrent = currentUrl.replaceAll("#.*$", "").replaceAll("\\?.*$", "").replaceAll("/+$", "");
            if (visitedUrls.contains(cleanCurrent)) continue;
            visitedUrls.add(cleanCurrent);

            try {
                Document doc = Jsoup.connect(currentUrl)
                        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                        .timeout(15000)
                        .followRedirects(true)
                        .ignoreHttpErrors(true)
                        .get();

                String title = doc.title();
                String bodyHtml = doc.body() != null ? doc.body().html() : doc.html();
                
                // Extract inline and external CSS styles
                StringBuilder cssSb = new StringBuilder();
                for (Element style : doc.select("style")) {
                    if (!style.html().trim().isEmpty()) {
                        cssSb.append(style.html()).append("\n");
                    }
                }
                for (Element link : doc.select("link[rel~=(?i)stylesheet]")) {
                    String href = link.absUrl("href");
                    if (href.isEmpty() || href.startsWith("data:")) continue;
                    try {
                        org.jsoup.Connection.Response cssRes = Jsoup.connect(href)
                                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                                .timeout(5000)
                                .ignoreContentType(true)
                                .ignoreHttpErrors(true)
                                .execute();
                        if (cssRes.statusCode() == 200 && cssRes.body() != null) {
                            cssSb.append("/* CSS Import: ").append(href).append(" */\n").append(cssRes.body().trim()).append("\n");
                        }
                    } catch (Exception ignored) {}
                }
                String extractedCss = cssSb.toString();

                // Extract inline and external JS scripts
                StringBuilder jsSb = new StringBuilder();
                for (Element script : doc.select("script")) {
                    if (!script.hasAttr("src") && !script.html().trim().isEmpty()) {
                        jsSb.append(script.html()).append("\n");
                    } else if (script.hasAttr("src")) {
                        String src = script.absUrl("src");
                        if (src.isEmpty() || src.startsWith("data:") || src.contains("analytics") || src.contains("gtag")) continue;
                        try {
                            org.jsoup.Connection.Response jsRes = Jsoup.connect(src)
                                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                                    .timeout(4000)
                                    .ignoreContentType(true)
                                    .ignoreHttpErrors(true)
                                    .execute();
                            if (jsRes.statusCode() == 200 && jsRes.body() != null) {
                                jsSb.append("// JS Import: ").append(src).append("\n").append(jsRes.body().trim()).append("\n");
                            }
                        } catch (Exception ignored) {}
                    }
                }
                String extractedJs = jsSb.toString();

                // Get clean slug
                String slug = "index";
                try {
                    String path = new URI(currentUrl).getPath();
                    if (path != null && !path.isEmpty() && !"/".equals(path)) {
                        String[] parts = path.split("/");
                        for (int k = parts.length - 1; k >= 0; k--) {
                            String pName = parts[k].replaceAll("\\.(html|php|aspx|jsp)$", "").trim();
                            if (!pName.isEmpty() && !"index".equalsIgnoreCase(pName) && !"home".equalsIgnoreCase(pName)) {
                                slug = pName;
                                break;
                            }
                        }
                    }
                } catch (Exception ignored) {}

                if (slug.isEmpty() || "home".equalsIgnoreCase(slug) || pages.isEmpty()) {
                    slug = pages.isEmpty() ? "index" : slug;
                }

                // Prevent fetching/saving duplicate pages with the same slug
                if (seenSlugs.contains(slug)) {
                    System.out.println("[Crawler] Ignorando página com slug duplicado: " + slug + " (URL: " + currentUrl + ")");
                    continue;
                }
                seenSlugs.add(slug);

                // Extract page media (Images, Logos, Backgrounds, Videos) without duplicates
                List<Map<String, Object>> pageMedia = new ArrayList<>();

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

                    if (absUrl.isEmpty() || globalSeenMedia.contains(absUrl) || absUrl.contains("pixel") || absUrl.contains("tracking")) continue;
                    globalSeenMedia.add(absUrl);

                    String alt = img.attr("alt");
                    String imgClass = img.className().toLowerCase();
                    String imgId = img.id().toLowerCase();

                    String role = "content";
                    if (imgClass.contains("logo") || imgId.contains("logo") || alt.toLowerCase().contains("logo")) {
                        role = "logo";
                    } else if (imgClass.contains("hero") || imgId.contains("hero") || imgClass.contains("banner")) {
                        role = "hero";
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
                        if (!absUrl.isEmpty() && !globalSeenMedia.contains(absUrl) && !absUrl.contains("pixel")) {
                            globalSeenMedia.add(absUrl);
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
                    if (!absUrl.isEmpty() && !globalSeenMedia.contains(absUrl)) {
                        globalSeenMedia.add(absUrl);
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
                pageData.put("isHomepage", pages.isEmpty() || "index".equalsIgnoreCase(slug));
                pageData.put("media", pageMedia);

                pages.add(pageData);

                // 4. Discover subpages on the same domain
                Elements links = doc.select("a[href], [data-href], [data-url]");
                for (Element link : links) {
                    String rawHref = link.hasAttr("href") ? link.attr("href") :
                                     link.hasAttr("data-href") ? link.attr("data-href") :
                                     link.attr("data-url");
                    if (rawHref.isEmpty() || rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("whatsapp:")) {
                        continue;
                    }

                    String absUrl = link.absUrl("href");
                    if (absUrl.isEmpty()) {
                        try {
                            absUrl = new URL(new URL(currentUrl), rawHref).toString();
                        } catch (Exception ignored) {}
                    }

                    if (absUrl.isEmpty()) continue;
                    String cleanCandidate = absUrl.replaceAll("#.*$", "").replaceAll("\\?.*$", "").replaceAll("/+$", "");

                    // Exclude non-page assets
                    if (cleanCandidate.matches("(?i).*\\.(png|jpg|jpeg|gif|svg|pdf|zip|css|js|woff2?|ico|mp4|webm)$")) {
                        continue;
                    }

                    try {
                        URI linkUri = new URI(cleanCandidate);
                        String linkHost = linkUri.getHost() != null ? linkUri.getHost().replaceAll("^www\\.", "").toLowerCase() : "";
                        boolean isSameHost = mainHost.isEmpty() || linkHost.equals(mainHost) || linkHost.endsWith("." + mainHost) || mainHost.endsWith("." + linkHost);

                        if (isSameHost && !visitedUrls.contains(cleanCandidate) && !queue.contains(cleanCandidate)) {
                            queue.add(cleanCandidate);
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
    }    private String preProcessImageUrls(String rawHtml, List<Map<String, Object>> pageMedia, List<String> projectMediaUrls) {
        if (rawHtml == null || rawHtml.isEmpty()) return "";
        try {
            org.jsoup.nodes.Document doc = Jsoup.parseBodyFragment(rawHtml);
            if (projectMediaUrls != null && !projectMediaUrls.isEmpty()) {
                org.jsoup.select.Elements imgs = doc.select("img");
                int mediaIdx = 0;
                for (org.jsoup.nodes.Element img : imgs) {
                    String newUrl = projectMediaUrls.get(mediaIdx % projectMediaUrls.size());
                    img.attr("src", newUrl);
                    img.removeAttr("data-src");
                    img.removeAttr("srcset");
                    mediaIdx++;
                }
            }
            return doc.body().html();
        } catch (Exception ex) {
            return rawHtml;
        }
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
            
            logs.add("Mapeando mídias cadastradas e preparando pacote com " + pages.size() + " páginas...");
            progress.put("status", "generating");

            // 1. Pre-process pages with image replacements and build unified JSON package
            List<Map<String, Object>> preparedPages = new ArrayList<>();
            for (int i = 0; i < pages.size(); i++) {
                Map<String, Object> pMap = pages.get(i);
                String pageName = (String) pMap.get("name");
                String rawSlug = (String) pMap.get("slug");
                String targetSlug = ("home".equalsIgnoreCase(rawSlug) || rawSlug == null || rawSlug.trim().isEmpty()) ? "index" : rawSlug.trim();

                String rawHtml = (String) pMap.get("rawHtml");
                if (rawHtml == null || rawHtml.isEmpty()) {
                    rawHtml = (String) pMap.get("html");
                }
                if (rawHtml == null || rawHtml.isEmpty()) {
                    rawHtml = "Conteúdo original da página: " + pageName;
                }

                if (rawHtml.length() > 8000) {
                    rawHtml = rawHtml.substring(0, 8000) + "... [Truncado]";
                }

                List<Map<String, Object>> pMedia = (List<Map<String, Object>>) pMap.get("media");
                String processedHtml = preProcessImageUrls(rawHtml, pMedia, projectMediaUrls);

                Map<String, Object> pObj = new HashMap<>();
                pObj.put("slug", targetSlug);
                pObj.put("name", pageName);
                pObj.put("customPrompt", pMap.getOrDefault("customPrompt", ""));
                pObj.put("html", processedHtml);
                pObj.put("css", pMap.getOrDefault("css", ""));
                pObj.put("js", pMap.getOrDefault("js", ""));
                preparedPages.add(pObj);
            }

            // 2. Build global prompt and context
            StringBuilder promptBuilder = new StringBuilder();
            promptBuilder.append("Remasterização completa do projeto '").append(project.getName()).append("' contendo ").append(preparedPages.size()).append(" páginas.\n");
            promptBuilder.append("Instruções: Recriar as páginas com HTML5 moderno e Tailwind CSS. Preservar mídias, imagens e textos originais.\n");
            promptBuilder.append("Retornar ESTRITAMENTE um JSON padronizado na estrutura: {\"explanation\": \"...\", \"pages\": [{\"slug\": \"...\", \"name\": \"...\", \"html\": \"...\", \"css\": \"...\", \"js\": \"...\"}]}\n");

            if (customAiSkills != null && !customAiSkills.trim().isEmpty()) {
                promptBuilder.append("Skills: ").append(customAiSkills.trim()).append("\n");
            }
            if (projectMediaUrls != null && !projectMediaUrls.isEmpty()) {
                promptBuilder.append("Mídias: ").append(String.join(", ", projectMediaUrls)).append("\n");
            }

            String globalPrompt = promptBuilder.toString();

            Map<String, Object> context = new HashMap<>();
            context.put("pages", preparedPages);
            context.put("projectMediaUrls", projectMediaUrls != null ? projectMediaUrls : Collections.emptyList());
            context.put("customAiSkills", customAiSkills != null ? customAiSkills : "");

            String provider = "ollama";
            String ollamaModel = "cardosokks:latest";
            String ollamaUrl = "http://192.168.18.33:11434";

            List<ProjectMember> members = projectMemberRepository.findByProjectIdWithUser(projectId);
            if (members != null && !members.isEmpty()) {
                User owner = members.get(0).getUser();
                if (owner != null) {
                    if (owner.getActiveProvider() != null && !owner.getActiveProvider().trim().isEmpty()) {
                        provider = owner.getActiveProvider().trim();
                    }
                    if (owner.getOllamaModel() != null && !owner.getOllamaModel().trim().isEmpty()) {
                        ollamaModel = owner.getOllamaModel().trim();
                    }
                    if (owner.getOllamaServerUrl() != null && !owner.getOllamaServerUrl().trim().isEmpty()) {
                        ollamaUrl = owner.getOllamaServerUrl().trim();
                    }
                }
            }

            context.put("provider", provider);
            context.put("ollamaModel", ollamaModel);
            context.put("ollamaUrl", ollamaUrl);

            logs.add("Enviando pacote com " + preparedPages.size() + " páginas em requisição única para o n8n/IA...");
            progress.put("progress", 1);
            progress.put("currentPage", "Pacote Completo (" + pages.size() + " páginas)");

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

            // 3. Send single HTTP package request to n8n / Gemini / Ollama
            Map<String, Object> aiResult = geminiService.generateAIResponse(
                    globalPrompt,
                    context,
                    apiKey,
                    null,
                    models,
                    (model, attempt, total) -> {
                        if (jobId != null && aiChatJobsQueue != null) {
                            Map<String, Object> jState = aiChatJobsQueue.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
                            jState.put("status", "processing");
                            jState.put("currentModel", model + " - Remasterizando pacote (" + pages.size() + " páginas)");
                            jState.put("attempt", attempt);
                            jState.put("total", total);
                        }
                    },
                    () -> Thread.currentThread().isInterrupted() || "canceled".equalsIgnoreCase((String) progress.get("status"))
            );

            // 4. Process returned package pages
            List<Map<String, Object>> returnedPagesList = new ArrayList<>();
            Object pagesObj = aiResult.get("pages");
            if (pagesObj instanceof List) {
                returnedPagesList = (List<Map<String, Object>>) pagesObj;
            } else if (aiResult.containsKey("html")) {
                Map<String, Object> single = new HashMap<>();
                single.put("slug", "index");
                single.put("name", "Página Inicial");
                single.put("html", aiResult.get("html"));
                single.put("css", aiResult.getOrDefault("css", ""));
                single.put("js", aiResult.getOrDefault("js", ""));
                returnedPagesList.add(single);
            }

            logs.add("Pacote de páginas processado pela IA com sucesso! Aplicando no banco e canvas...");

            // 5. Save each returned page and update live canvas
            for (int i = 0; i < pages.size(); i++) {
                Map<String, Object> origPage = pages.get(i);
                String origSlug = (String) origPage.get("slug");
                final String targetSlug = ("home".equalsIgnoreCase(origSlug) || origSlug == null || origSlug.trim().isEmpty()) ? "index" : origSlug.trim();
                String pageName = (String) origPage.get("name");

                Map<String, Object> rPage = null;
                for (Map<String, Object> rp : returnedPagesList) {
                    String rSlug = (String) rp.get("slug");
                    if (targetSlug.equalsIgnoreCase(rSlug)) {
                        rPage = rp;
                        break;
                    }
                }
                if (rPage == null && i < returnedPagesList.size()) {
                    rPage = returnedPagesList.get(i);
                }

                String html = rPage != null ? (String) rPage.getOrDefault("html", "<div></div>") : "<div></div>";
                String css = rPage != null ? (String) rPage.getOrDefault("css", "") : "";
                String js = rPage != null ? (String) rPage.getOrDefault("js", "") : "";

                String downloadedCss = (String) origPage.getOrDefault("css", "");
                String downloadedJs = (String) origPage.getOrDefault("js", "");
                if (css == null || css.trim().isEmpty()) css = downloadedCss;
                if (js == null || js.trim().isEmpty()) js = downloadedJs;

                String usedModel = (String) aiResult.getOrDefault("_usedModel", "gemini-3.6-flash");

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
                        if (repeatNavbar && headerEl != null) headerEl.remove();
                        if (repeatFooter && footerEl != null) footerEl.remove();
                    }
                    html = bodyDoc.body().html();
                } catch (Exception parseEx) {
                    System.err.println("Erro ao extrair navbar e footer na página " + pageName + ": " + parseEx.getMessage());
                }

                Optional<Page> existingPage = pageRepository.findFirstByProjectIdAndSlug(project.getId(), targetSlug);
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

                try {
                    storageService.uploadSinglePage(project.getName(), page.getSlug(), page.getHtml(), page.getCss(), page.getJs(), page.isHomepage(), project.getNavbarHtml(), project.getFooterHtml());
                } catch (Exception ignored) {}

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
                        "explanation", "Página '" + pageName + "' (" + (i + 1) + "/" + pages.size() + ") remasterizada do pacote e salva no canvas em tempo real.",
                        "_usedModel", usedModel
                    ));
                }
                logs.add("Página '" + pageName + "' (" + (i + 1) + "/" + pages.size() + ") salva no banco e sincronizada no canvas!");
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
