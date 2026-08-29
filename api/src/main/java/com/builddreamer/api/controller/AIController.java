package com.builddreamer.api.controller;

import com.builddreamer.api.model.*;
import com.builddreamer.api.repository.*;
import com.builddreamer.api.service.GeminiService;
import com.builddreamer.api.service.SiteRemasterService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;

import com.builddreamer.api.service.StorageService;
import org.springframework.scheduling.annotation.Async;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    private final GeminiService geminiService;
    private final SiteRemasterService remasterService;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final PageRepository pageRepository;
    private final UserRepository userRepository;
    private final LeadRepository leadRepository;
    private final StorageService storageService;
    private final MediaRepository mediaRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Track AI Chat background jobs in memory
    private final Map<String, Map<String, Object>> aiChatJobsQueue = new ConcurrentHashMap<>();

    public AIController(
            GeminiService geminiService, 
            SiteRemasterService remasterService,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            PageRepository pageRepository,
            UserRepository userRepository,
            LeadRepository leadRepository,
            StorageService storageService,
            MediaRepository mediaRepository) {
        this.geminiService = geminiService;
        this.remasterService = remasterService;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.pageRepository = pageRepository;
        this.userRepository = userRepository;
        this.leadRepository = leadRepository;
        this.storageService = storageService;
        this.mediaRepository = mediaRepository;
    }

    private String decodeHeader(String header) {
        if (header == null || header.trim().isEmpty()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(header.trim());
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return header; // Return raw if not valid base64
        }
    }

    @Async
    public void processAiChatJob(
            String jobId,
            String pageId,
            String projectId,
            String prompt,
            Map<String, String> context,
            String apiKey,
            String model,
            List<String> registeredModels
    ) {
        Map<String, Object> jobState = aiChatJobsQueue.get(jobId);
        if (jobState == null) {
            jobState = new ConcurrentHashMap<>();
            aiChatJobsQueue.put(jobId, jobState);
        }
        jobState.put("status", "processing");
        if (pageId != null) jobState.put("pageId", pageId);
        if (projectId != null) jobState.put("projectId", projectId);

        final Map<String, Object> stateRef = jobState;

        try {
            Map<String, Object> response = geminiService.generateAIResponse(
                    prompt,
                    context != null ? context : Collections.emptyMap(),
                    apiKey,
                    model,
                    registeredModels,
                    (m, attempt, total) -> {
                        stateRef.put("status", "processing");
                        stateRef.put("currentModel", m);
                        stateRef.put("attempt", attempt);
                        stateRef.put("total", total);
                    }
            );

            // Update Page in database & MinIO if pageId is present
            if (pageId != null && !pageId.isEmpty()) {
                Optional<Page> pageOpt = pageRepository.findById(pageId);
                if (pageOpt.isPresent()) {
                    Page page = pageOpt.get();
                    if (response.containsKey("html")) page.setHtml((String) response.get("html"));
                    if (response.containsKey("css")) page.setCss((String) response.get("css"));
                    if (response.containsKey("js")) page.setJs((String) response.get("js"));
                    pageRepository.save(page);

                    // Sync to MinIO
                    try {
                        Project proj = page.getProject();
                        if (proj != null) {
                            storageService.uploadSinglePage(proj.getName(), page.getSlug(), page.getHtml(), page.getCss(), page.getJs(), page.isHomepage(), proj.getNavbarHtml(), proj.getFooterHtml());
                        }
                    } catch (Exception ignored) {}
                }
            }

            stateRef.put("status", "completed");
            stateRef.put("response", response);
            stateRef.put("result", response);
            if (response.containsKey("explanation")) stateRef.put("explanation", response.get("explanation"));
            if (response.containsKey("html")) stateRef.put("html", response.get("html"));
            if (response.containsKey("css")) stateRef.put("css", response.get("css"));
            if (response.containsKey("js")) stateRef.put("js", response.get("js"));

        } catch (Exception ex) {
            System.err.println("Erro no worker do AI Chat (job " + jobId + "): " + ex.getMessage());
            stateRef.put("status", "failed");
            stateRef.put("error", ex.getMessage());
        }
    }

    @PostMapping("/generate")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> generateAI(
            @AuthenticationPrincipal String userId,
            @RequestHeader(name = "x-gemini-key", required = false) String rawGeminiKey,
            @RequestHeader(name = "x-gemini-models", required = false) String rawGeminiModels,
            @RequestBody Map<String, Object> body) {
        String prompt = (String) body.get("prompt");
        Map<String, String> context = (Map<String, String>) body.get("context");
        String apiKey = (String) body.get("apiKey");
        String model = (String) body.get("model");
        String pageId = (String) body.get("pageId");
        String projectId = (String) body.get("projectId");

        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = decodeHeader(rawGeminiKey);
        }

        List<String> registeredModels = null;
        if (rawGeminiModels != null && !rawGeminiModels.isEmpty()) {
            try {
                String jsonStr = decodeHeader(rawGeminiModels);
                registeredModels = objectMapper.readValue(jsonStr, new TypeReference<List<String>>() {});
            } catch (Exception ignored) {}
        }

        String jobId = "job-" + System.currentTimeMillis() + "-" + new Random().nextInt(10000);
        String scope = (projectId != null && pageId == null) ? "all" : "single";

        Map<String, Object> initialJob = new ConcurrentHashMap<>();
        initialJob.put("status", "pending");
        initialJob.put("scope", scope);
        if (pageId != null) initialJob.put("pageId", pageId);
        if (projectId != null) initialJob.put("projectId", projectId);

        aiChatJobsQueue.put(jobId, initialJob);

        processAiChatJob(jobId, pageId, projectId, prompt, context, apiKey, model, registeredModels);

        return ResponseEntity.status(202).body(Map.of("jobId", jobId, "status", "pending", "scope", scope));
    }

    @PostMapping("/chat")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> editPageChat(
            @AuthenticationPrincipal String userId,
            @RequestHeader(name = "x-gemini-key", required = false) String rawGeminiKey,
            @RequestHeader(name = "x-gemini-models", required = false) String rawGeminiModels,
            @RequestBody Map<String, Object> body) {
        String prompt = (String) body.get("prompt");
        Map<String, String> context = (Map<String, String>) body.get("context");
        String apiKey = (String) body.get("apiKey");
        String model = (String) body.get("model");
        String pageId = (String) body.get("pageId");
        String projectId = (String) body.get("projectId");

        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = decodeHeader(rawGeminiKey);
        }

        List<String> registeredModels = null;
        if (rawGeminiModels != null && !rawGeminiModels.isEmpty()) {
            try {
                String jsonStr = decodeHeader(rawGeminiModels);
                registeredModels = objectMapper.readValue(jsonStr, new TypeReference<List<String>>() {});
            } catch (Exception ignored) {}
        }

        String jobId = "job-" + System.currentTimeMillis() + "-" + new Random().nextInt(10000);
        String scope = (projectId != null && pageId == null) ? "all" : "single";

        Map<String, Object> initialJob = new ConcurrentHashMap<>();
        initialJob.put("status", "pending");
        initialJob.put("scope", scope);
        if (pageId != null) initialJob.put("pageId", pageId);
        if (projectId != null) initialJob.put("projectId", projectId);

        aiChatJobsQueue.put(jobId, initialJob);

        processAiChatJob(jobId, pageId, projectId, prompt, context, apiKey, model, registeredModels);

        return ResponseEntity.status(202).body(Map.of("jobId", jobId, "status", "pending", "scope", scope));
    }

    @GetMapping("/jobs/active")
    public ResponseEntity<?> getActiveJob(
            @RequestParam(required = false) String pageId,
            @RequestParam(required = false) String projectId) {
        
        List<Map.Entry<String, Map<String, Object>>> entries = new ArrayList<>(aiChatJobsQueue.entrySet());
        Collections.reverse(entries);

        for (Map.Entry<String, Map<String, Object>> entry : entries) {
            String jobId = entry.getKey();
            Map<String, Object> job = entry.getValue();
            String status = (String) job.get("status");

            if ("processing".equals(status) || "pending".equals(status)) {
                if (pageId != null && pageId.equals(job.get("pageId"))) {
                    Map<String, Object> res = new HashMap<>(job);
                    res.put("jobId", jobId);
                    return ResponseEntity.ok(res);
                }
                if (projectId != null && projectId.equals(job.get("projectId")) && "all".equals(job.get("scope"))) {
                    Map<String, Object> res = new HashMap<>(job);
                    res.put("jobId", jobId);
                    return ResponseEntity.ok(res);
                }
            }
        }
        return ResponseEntity.ok(Map.of("active", false));
    }

    @GetMapping("/jobs/{jobId}/status")
    public ResponseEntity<?> getJobStatus(@PathVariable String jobId) {
        Map<String, Object> job = aiChatJobsQueue.get(jobId);
        if (job != null) {
            return ResponseEntity.ok(job);
        }
        Map<String, Object> scrapeStatus = remasterService.getScrapeJobStatus(jobId);
        if (!scrapeStatus.isEmpty()) {
            return ResponseEntity.ok(scrapeStatus);
        }
        Map<String, Object> remasterStatus = remasterService.getJobStatus(jobId);
        if (!remasterStatus.isEmpty()) {
            return ResponseEntity.ok(remasterStatus);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/models")
    public ResponseEntity<?> listModels(
            @RequestHeader(name = "x-gemini-key", required = false) String rawGeminiKey,
            @RequestHeader(name = "x-proxy-url", required = false) String rawProxyUrl) {
        
        List<Map<String, String>> defaultModels = Arrays.asList(
                Map.of("id", "gemini-3.6-flash", "name", "Gemini 3.6 Flash", "category", "flash"),
                Map.of("id", "gemini-2.5-flash", "name", "Gemini 2.5 Flash", "category", "flash"),
                Map.of("id", "gemini-2.0-flash", "name", "Gemini 2.0 Flash", "category", "flash"),
                Map.of("id", "gemini-1.5-flash", "name", "Gemini 1.5 Flash", "category", "flash"),
                Map.of("id", "gemini-1.5-pro", "name", "Gemini 1.5 Pro", "category", "pro")
        );

        String apiKey = null;
        if (rawGeminiKey != null && !rawGeminiKey.isEmpty()) {
            try {
                apiKey = new String(Base64.getDecoder().decode(rawGeminiKey), StandardCharsets.UTF_8);
            } catch (Exception ex) {
                apiKey = rawGeminiKey;
            }
        }

        if (apiKey == null || apiKey.trim().isEmpty()) {
            apiKey = System.getenv("GEMINI_API_KEY");
        }

        if (apiKey == null || apiKey.trim().isEmpty()) {
            return ResponseEntity.ok(Map.of("models", defaultModels));
        }

        try {
            String baseUrl = "https://generativelanguage.googleapis.com";
            if (rawProxyUrl != null && !rawProxyUrl.isEmpty()) {
                try {
                    String decodedProxy = new String(Base64.getDecoder().decode(rawProxyUrl), StandardCharsets.UTF_8);
                    if (decodedProxy.startsWith("http")) baseUrl = decodedProxy.replaceAll("/+$", "");
                } catch (Exception ignored) {}
            }

            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest req = java.net.http.HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/v1beta/models?key=" + apiKey))
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> resp = client.send(req, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(resp.body());
                List<Map<String, String>> discovered = new ArrayList<>();
                if (root.has("models") && root.get("models").isArray()) {
                    for (com.fasterxml.jackson.databind.JsonNode m : root.get("models")) {
                        String name = m.path("name").asText(""); // models/gemini-2.0-flash
                        String id = name.replace("models/", "");
                        String displayName = m.path("displayName").asText(id);
                        if (id.startsWith("gemini")) {
                            discovered.add(Map.of("id", id, "name", displayName));
                        }
                    }
                }
                if (!discovered.isEmpty()) {
                    return ResponseEntity.ok(Map.of("models", discovered));
                }
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(Map.of("models", defaultModels));
    }

    @PostMapping("/remaster/scrape")
    public ResponseEntity<?> scrapeWebsite(@RequestBody Map<String, Object> body) {
        String url = body.containsKey("websiteUrl") ? (String) body.get("websiteUrl") : (String) body.get("url");
        Number maxPages = (Number) body.getOrDefault("maxPages", 6);

        if (url == null || url.trim().isEmpty() || "null".equalsIgnoreCase(url.trim())) {
            return ResponseEntity.badRequest().body(Map.of("error", "URL é obrigatória e deve ser um endereço de site válido."));
        }
        
        String jobId = "scrape-" + System.currentTimeMillis() + "-" + new Random().nextInt(10000);
        try {
            remasterService.runScrapeJob(jobId, url, maxPages.intValue());
            return ResponseEntity.status(202).body(Map.of(
                    "jobId", jobId,
                    "status", "scraping",
                    "message", "Extração do site iniciada em background."
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/remaster/scrape/{jobId}/status")
    public ResponseEntity<?> getScrapeStatus(@PathVariable String jobId) {
        Map<String, Object> status = remasterService.getScrapeJobStatus(jobId);
        if (status.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(status);
    }

    @PostMapping("/remaster/generate")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> generateRemaster(
            @AuthenticationPrincipal String userId,
            @RequestHeader(value = "X-Gemini-Key", required = false) String clientGeminiKeyEncoded,
            @RequestHeader(value = "X-Proxy-Url", required = false) String clientProxyUrlEncoded,
            @RequestHeader(value = "X-Gemini-Models", required = false) String clientModelsEncoded,
            @RequestHeader(value = "X-AI-Skills", required = false) String clientAiSkillsEncoded,
            @RequestBody Map<String, Object> body) {

        String projectName = (String) body.get("projectName");
        String globalPrompt = (String) body.get("globalPrompt");
        List<Map<String, Object>> pages = null;
        try {
            pages = (List<Map<String, Object>>) body.get("pages");
        } catch (Exception e) {
            System.err.println("[REMASTER] Erro ao parsear pages do body: " + e.getMessage());
        }
        String leadId = (String) body.get("leadId");

        Map<String, Object> sharedComponents = null;
        try {
            sharedComponents = (Map<String, Object>) body.getOrDefault("sharedComponents", Collections.emptyMap());
        } catch (Exception e) {
            sharedComponents = Collections.emptyMap();
        }
        boolean repeatNavbar = true;
        boolean repeatFooter = true;
        try {
            Object rn = sharedComponents.get("repeatNavbar");
            if (rn instanceof Boolean) repeatNavbar = (Boolean) rn;
            Object rf = sharedComponents.get("repeatFooter");
            if (rf instanceof Boolean) repeatFooter = (Boolean) rf;
        } catch (Exception ignored) {}

        if (projectName == null || projectName.trim().isEmpty()) {
            projectName = "Novo Projeto Remasterizado";
        }

        if (pages == null || pages.isEmpty()) {
            pages = new ArrayList<>();
            Map<String, Object> defaultPage = new HashMap<>();
            defaultPage.put("name", "Home");
            defaultPage.put("slug", "index");
            defaultPage.put("customPrompt", globalPrompt != null ? globalPrompt : "Site moderno e responsivo com HTML5 e Tailwind CSS");
            pages.add(defaultPage);
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário inválido"));
        }

        try {
            // 1. Create Project in DB
            Project project = new Project();
            project.setName(projectName);
            project.setStatus("generating");
            project.setDescription(globalPrompt != null && globalPrompt.length() > 120 
                    ? "Remasterização IA: " + globalPrompt.substring(0, 120) + "..." 
                    : "Site gerado com IA para " + projectName);
            projectRepository.save(project);

            // 2. Add Project Owner member
            ProjectMember member = new ProjectMember();
            member.setProject(project);
            member.setUser(userOpt.get());
            member.setRole("OWNER");
            projectMemberRepository.save(member);

            // 3. Register downloaded pages & media into Project DB immediately
            Set<String> projectMediaUrls = new LinkedHashSet<>();

            for (int i = 0; i < pages.size(); i++) {
                Map<String, Object> pMap = pages.get(i);
                String pageName = (String) pMap.getOrDefault("name", "Página " + (i + 1));
                String rawSlug = (String) pMap.get("slug");
                String slug = ("home".equalsIgnoreCase(rawSlug) || rawSlug == null || rawSlug.trim().isEmpty()) ? "index" : rawSlug.trim();

                String rawHtml = (String) pMap.get("rawHtml");
                if (rawHtml == null || rawHtml.isEmpty()) {
                    rawHtml = (String) pMap.get("html");
                }
                if (rawHtml == null || rawHtml.isEmpty()) {
                    rawHtml = (String) pMap.getOrDefault("cleanText", "<div class=\"p-8 text-center\">Página " + pageName + "</div>");
                }

                String css = (String) pMap.getOrDefault("css", "");
                String js = (String) pMap.getOrDefault("js", "");
                boolean isHomepage = "index".equals(slug) || i == 0;

                Page page = new Page();
                page.setName(pageName);
                page.setSlug(slug);
                page.setTitle(pageName + " | " + projectName);
                page.setHomepage(isHomepage);
                page.setHtml(rawHtml);
                page.setCss(css);
                page.setJs(js);
                page.setProject(project);
                pageRepository.save(page);

                // Process and register media items without duplicates
                Object mediaObj = pMap.get("media");
                if (mediaObj instanceof List) {
                    List<?> mediaList = (List<?>) mediaObj;
                    for (Object item : mediaList) {
                        String mUrl = null;
                        if (item instanceof Map) {
                            mUrl = (String) ((Map<?, ?>) item).get("url");
                        } else if (item instanceof String) {
                            mUrl = (String) item;
                        }

                        if (mUrl != null && !mUrl.trim().isEmpty()) {
                            String finalUrl = mUrl.trim();
                            if (!projectMediaUrls.contains(finalUrl)) {
                                projectMediaUrls.add(finalUrl);
                                try {
                                    Media media = Media.builder()
                                            .name("Mídia da página " + pageName)
                                            .url(finalUrl)
                                            .userId(userId)
                                            .projectId(project.getId())
                                            .mimeType(finalUrl.endsWith(".svg") ? "image/svg+xml" : "image/jpeg")
                                            .build();
                                    mediaRepository.save(media);
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                }
            }

            // Link CRM Lead if present
            if (leadId != null) {
                Optional<Lead> leadOpt = leadRepository.findByUserIdAndId(userId, leadId);
                if (leadOpt.isPresent()) {
                    Lead lead = leadOpt.get();
                    lead.setProject(project);
                    leadRepository.save(lead);
                }
            }

            // Decode headers
            String clientGeminiKey = decodeHeader(clientGeminiKeyEncoded);
            String customAiSkills = decodeHeader(clientAiSkillsEncoded);

            String reqProvider = body.containsKey("provider") ? (String) body.get("provider") : (String) body.get("agent");
            String reqModel = (String) body.get("model");
            String reqOllamaModel = (String) body.get("ollamaModel");
            String reqOllamaUrl = (String) body.get("ollamaUrl");

            if (reqOllamaModel == null && "ollama".equalsIgnoreCase(reqProvider) && reqModel != null) {
                reqOllamaModel = reqModel;
            }

            List<String> models = new ArrayList<>();
            if (reqModel != null && !reqModel.trim().isEmpty()) {
                models.add(reqModel.trim());
            }

            String decodedModels = decodeHeader(clientModelsEncoded);
            if (decodedModels != null) {
                try {
                    List<String> headerModels = objectMapper.readValue(decodedModels, new TypeReference<List<String>>() {});
                    for (String hm : headerModels) {
                        if (!models.contains(hm)) models.add(hm);
                    }
                } catch (Exception ignored) {}
            }
            if (models.isEmpty()) {
                if (userOpt.isPresent() && userOpt.get().getCustomAiModels() != null) {
                    try {
                        models = objectMapper.readValue(userOpt.get().getCustomAiModels(), new TypeReference<List<String>>() {});
                    } catch (Exception ignored) {}
                }
            }

            // 4. Start async generation worker with jobId tracking for AI Chat & polling
            String jobId = "job-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 10000);
            Map<String, Object> initialJob = new ConcurrentHashMap<>();
            initialJob.put("jobId", jobId);
            initialJob.put("status", "processing");
            initialJob.put("progress", 0);
            initialJob.put("total", pages.size());
            initialJob.put("scope", pages.size() > 1 ? "all" : "single");
            initialJob.put("currentModel", models != null && !models.isEmpty() ? models.get(0) : "gemini-2.0-flash");
            aiChatJobsQueue.put(jobId, initialJob);

            remasterService.runRemasterGenerationJob(
                    jobId,
                    project.getId(),
                    pages,
                    repeatNavbar,
                    repeatFooter,
                    clientGeminiKey,
                    models,
                    aiChatJobsQueue,
                    customAiSkills,
                    new ArrayList<>(projectMediaUrls),
                    reqProvider,
                    reqOllamaModel,
                    reqOllamaUrl
            );

            Map<String, Object> resMap = new LinkedHashMap<>();
            resMap.put("id", project.getId());
            resMap.put("name", project.getName());
            resMap.put("description", project.getDescription());
            resMap.put("status", project.getStatus());
            resMap.put("domain", project.getDomain());
            resMap.put("jobId", jobId);
            resMap.put("pages", pageRepository.findByProjectId(project.getId()));

            return ResponseEntity.ok(resMap);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/remaster/job/{projectId}")
    public ResponseEntity<?> getRemasterJobStatus(@PathVariable String projectId) {
        Map<String, Object> status = remasterService.getJobStatus(projectId);
        if (status.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(status);
    }

    @PostMapping("/remaster/job/{projectId}/cancel")
    public ResponseEntity<?> cancelRemasterJob(@PathVariable String projectId) {
        boolean canceled = remasterService.cancelJob(projectId);
        return ResponseEntity.ok(Map.of("canceled", canceled, "projectId", projectId));
    }

    @GetMapping("/ollama/models")
    public ResponseEntity<?> getOllamaModels(@RequestParam(required = false, defaultValue = "http://192.168.18.33:11434") String url) {
        try {
            String baseUrl = url.trim().replaceAll("/+$", "");
            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            String response = restTemplate.getForObject(baseUrl + "/api/tags", String.class);
            
            List<String> modelNames = new ArrayList<>();
            if (response != null) {
                com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(response);
                com.fasterxml.jackson.databind.JsonNode modelsNode = root.get("models");
                if (modelsNode != null && modelsNode.isArray()) {
                    for (com.fasterxml.jackson.databind.JsonNode mNode : modelsNode) {
                        if (mNode.has("name")) {
                            modelNames.add(mNode.get("name").asText());
                        }
                    }
                }
            }
            if (modelNames.isEmpty()) {
                modelNames.add("cardosokks:latest");
            }
            return ResponseEntity.ok(Map.of("models", modelNames));
        } catch (Exception ex) {
            return ResponseEntity.ok(Map.of("models", List.of("cardosokks:latest"), "warning", "Não foi possível conectar ao Ollama: " + ex.getMessage()));
        }
    }
}
