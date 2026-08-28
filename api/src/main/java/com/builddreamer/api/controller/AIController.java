package com.builddreamer.api.controller;

import com.builddreamer.api.service.GeminiService;
import com.builddreamer.api.service.SiteRemasterService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    private final GeminiService geminiService;
    private final SiteRemasterService remasterService;

    public AIController(GeminiService geminiService, SiteRemasterService remasterService) {
        this.geminiService = geminiService;
        this.remasterService = remasterService;
    }

    @PostMapping("/chat")
    public ResponseEntity<?> editPageChat(
            @AuthenticationPrincipal String userId,
            @RequestBody Map<String, Object> body) {
        String prompt = (String) body.get("prompt");
        Map<String, String> context = (Map<String, String>) body.get("context");
        String apiKey = (String) body.get("apiKey");
        String model = (String) body.get("model");

        try {
            Map<String, Object> response = geminiService.generateAIResponse(
                    prompt,
                    context != null ? context : Collections.emptyMap(),
                    apiKey,
                    model,
                    null
            );
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping("/models")
    public ResponseEntity<?> listModels() {
        // Return standard models
        List<Map<String, String>> models = Arrays.asList(
                Map.of("id", "gemini-3.5-flash", "name", "Gemini 3.5 Flash", "category", "flash"),
                Map.of("id", "gemini-3.6-flash", "name", "Gemini 3.6 Flash", "category", "flash"),
                Map.of("id", "gemini-3.7-flash", "name", "Gemini 3.7 Flash", "category", "flash"),
                Map.of("id", "gemini-3.5-flash-lite", "name", "Gemini 3.5 Flash Lite", "category", "flash")
        );
        return ResponseEntity.ok(models);
    }

    @PostMapping("/remaster/scrape")
    public ResponseEntity<?> scrapeWebsite(@RequestBody Map<String, Object> body) {
        String url = (String) body.get("url");
        Number maxPages = (Number) body.getOrDefault("maxPages", 6);
        if (url == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "URL é obrigatória"));
        }
        try {
            List<Map<String, Object>> scraped = remasterService.crawlEntireClientWebsite(url, maxPages.intValue());
            return ResponseEntity.ok(Map.of("success", true, "pages", scraped));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/remaster/generate")
    public ResponseEntity<?> generateRemaster(
            @RequestBody Map<String, Object> body) {
        String projectId = (String) body.get("projectId");
        List<Map<String, Object>> pages = (List<Map<String, Object>>) body.get("pages");
        Boolean repeatNavbar = (Boolean) body.getOrDefault("repeatNavbar", true);
        Boolean repeatFooter = (Boolean) body.getOrDefault("repeatFooter", true);
        String apiKey = (String) body.get("apiKey");
        List<String> models = (List<String>) body.get("models");

        if (projectId == null || pages == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "projectId e pages são obrigatórios"));
        }

        try {
            remasterService.runRemasterGenerationJob(
                    projectId,
                    pages,
                    repeatNavbar,
                    repeatFooter,
                    apiKey,
                    models
            );
            return ResponseEntity.ok(Map.of("success", true, "message", "Worker de remasterização iniciado"));
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
}
