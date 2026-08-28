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
import java.time.LocalDateTime;
import java.util.*;

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
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AIController(
            GeminiService geminiService, 
            SiteRemasterService remasterService,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            PageRepository pageRepository,
            UserRepository userRepository,
            LeadRepository leadRepository) {
        this.geminiService = geminiService;
        this.remasterService = remasterService;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.pageRepository = pageRepository;
        this.userRepository = userRepository;
        this.leadRepository = leadRepository;
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

    @PostMapping("/chat")
    public ResponseEntity<?> editPageChat(
            @AuthenticationPrincipal String userId,
            @RequestHeader(name = "x-gemini-key", required = false) String rawGeminiKey,
            @RequestHeader(name = "x-gemini-models", required = false) String rawGeminiModels,
            @RequestBody Map<String, Object> body) {
        String prompt = (String) body.get("prompt");
        Map<String, String> context = (Map<String, String>) body.get("context");
        String apiKey = (String) body.get("apiKey");
        String model = (String) body.get("model");

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

        try {
            Map<String, Object> response = geminiService.generateAIResponse(
                    prompt,
                    context != null ? context : Collections.emptyMap(),
                    apiKey,
                    model,
                    registeredModels
            );
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/models")
    public ResponseEntity<?> listModels(
            @RequestHeader(name = "x-gemini-key", required = false) String rawGeminiKey,
            @RequestHeader(name = "x-proxy-url", required = false) String rawProxyUrl) {
        
        List<Map<String, String>> defaultModels = Arrays.asList(
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
    public ResponseEntity<?> generateRemaster(
            @AuthenticationPrincipal String userId,
            @RequestHeader(value = "X-Gemini-Key", required = false) String clientGeminiKeyEncoded,
            @RequestHeader(value = "X-Proxy-Url", required = false) String clientProxyUrlEncoded,
            @RequestHeader(value = "X-Gemini-Models", required = false) String clientModelsEncoded,
            @RequestBody Map<String, Object> body) {

        String projectName = (String) body.get("projectName");
        String globalPrompt = (String) body.get("globalPrompt");
        List<Map<String, Object>> pages = (List<Map<String, Object>>) body.get("pages");
        String leadId = (String) body.get("leadId");

        Map<String, Object> sharedComponents = (Map<String, Object>) body.getOrDefault("sharedComponents", Collections.emptyMap());
        boolean repeatNavbar = sharedComponents.containsKey("repeatNavbar") ? (boolean) sharedComponents.get("repeatNavbar") : true;
        boolean repeatFooter = sharedComponents.containsKey("repeatFooter") ? (boolean) sharedComponents.get("repeatFooter") : true;

        if (projectName == null || pages == null || pages.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nome do projeto e lista de páginas são obrigatórios."));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário inválido"));
        }

        try {
            // 1. Create Project in DB
            Project project = new Project();
            project.setName(projectName);
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

            // 3. Add default page placeholder
            Page homePage = new Page();
            homePage.setName("Home");
            homePage.setSlug("index");
            homePage.setTitle("Home | " + projectName);
            homePage.setHomepage(true);
            homePage.setHtml("<div class=\"min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center\">\n" +
                    "  <h1 class=\"text-3xl font-bold mb-3\">Reconstruindo " + projectName + "...</h1>\n" +
                    "  <p class=\"text-slate-400\">Aguarde enquanto a IA arquiteta o Design System e gera todas as subpáginas.</p>\n" +
                    "</div>");
            homePage.setCss("body { margin: 0; font-family: sans-serif; }");
            homePage.setJs("");
            homePage.setProject(project);
            pageRepository.save(homePage);

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
            List<String> models = new ArrayList<>();
            String decodedModels = decodeHeader(clientModelsEncoded);
            if (decodedModels != null) {
                try {
                    models = objectMapper.readValue(decodedModels, new TypeReference<List<String>>() {});
                } catch (Exception ignored) {}
            }

            // 4. Start async generation worker
            remasterService.runRemasterGenerationJob(
                    project.getId(),
                    pages,
                    repeatNavbar,
                    repeatFooter,
                    clientGeminiKey,
                    models
            );

            return ResponseEntity.ok(project);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/remaster/job/{projectId}")
    public ResponseEntity<?> getJobStatus(@PathVariable String projectId) {
        Map<String, Object> status = remasterService.getJobStatus(projectId);
        if (status.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(status);
    }

    /**
     * GET /api/ai/jobs/{jobId}/status — used by ChatPanel.tsx to poll AI generation job status
     * Checks both remaster jobs (by projectId) and scrape jobs (by jobId)
     */
    @GetMapping("/jobs/{jobId}/status")
    public ResponseEntity<?> getAiJobStatus(@PathVariable String jobId) {
        // Try scrape job first
        Map<String, Object> scrapeStatus = remasterService.getScrapeJobStatus(jobId);
        if (!scrapeStatus.isEmpty()) {
            return ResponseEntity.ok(scrapeStatus);
        }
        // Try remaster (generation) job by projectId
        Map<String, Object> remasterStatus = remasterService.getJobStatus(jobId);
        if (!remasterStatus.isEmpty()) {
            return ResponseEntity.ok(remasterStatus);
        }
        return ResponseEntity.notFound().build();
    }

    /**
     * GET /api/ai/jobs/active — used by ChatPanel.tsx to check if there is an active job
     * Returns 200 with empty body when there is no active job for the given page/project
     */
    @GetMapping("/jobs/active")
    public ResponseEntity<?> getActiveJob(
            @RequestParam(required = false) String pageId,
            @RequestParam(required = false) String projectId) {
        // We don't track per-page jobs, just return empty so ChatPanel handles gracefully
        return ResponseEntity.ok(Map.of("noActiveJob", true));
    }
}
