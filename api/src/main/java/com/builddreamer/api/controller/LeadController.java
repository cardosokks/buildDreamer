package com.builddreamer.api.controller;

import com.builddreamer.api.model.Lead;
import com.builddreamer.api.model.LeadPreset;
import com.builddreamer.api.model.Project;
import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.LeadRepository;
import com.builddreamer.api.repository.LeadPresetRepository;
import com.builddreamer.api.repository.ProjectRepository;
import com.builddreamer.api.repository.UserRepository;
import com.builddreamer.api.service.LeadCrawlerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/leads")
public class LeadController {

    private final LeadRepository leadRepository;
    private final LeadPresetRepository leadPresetRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final LeadCrawlerService crawlerService;
    
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public LeadController(
            LeadRepository leadRepository,
            LeadPresetRepository leadPresetRepository,
            UserRepository userRepository,
            ProjectRepository projectRepository,
            LeadCrawlerService crawlerService) {
        this.leadRepository = leadRepository;
        this.leadPresetRepository = leadPresetRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.crawlerService = crawlerService;
    }

    // 1. List all CRM leads (GET /api/leads/crm)
    @GetMapping("/crm")
    public ResponseEntity<?> getLeads(@AuthenticationPrincipal String userId) {
        List<Lead> leads = leadRepository.findByUserId(userId);
        // Map elements to include custom fields if needed, matching the response format expected by frontend
        List<Map<String, Object>> mappedLeads = leads.stream().map(lead -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", lead.getId());
            map.put("name", lead.getName());
            map.put("company", lead.getCompany());
            map.put("phone", lead.getPhone());
            map.put("email", lead.getEmail());
            map.put("website", lead.getWebsite());
            map.put("address", lead.getAddress());
            map.put("rating", lead.getRating());
            map.put("dealValue", lead.getDealValue());
            map.put("status", lead.getStatus());
            map.put("notes", lead.getNotes());
            map.put("origin", lead.getOrigin());
            map.put("tags", lead.getTags() != null ? lead.getTags().split(",") : new String[0]);
            map.put("createdAt", lead.getCreatedAt());
            map.put("updatedAt", lead.getUpdatedAt());
            map.put("lastContactDate", lead.getLastContactDate());
            if (lead.getProject() != null) {
                map.put("projectId", lead.getProject().getId());
                map.put("projectName", lead.getProject().getName());
                map.put("projectStatus", lead.getProject().getStatus());
            } else {
                map.put("projectId", null);
                map.put("projectName", null);
                map.put("projectStatus", null);
            }
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("leads", mappedLeads));
    }

    // 2. Create or update a CRM lead (POST /api/leads/crm)
    @PostMapping("/crm")
    public ResponseEntity<?> createLead(@AuthenticationPrincipal String userId, @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nome é obrigatório"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário inválido"));
        }

        // Support update in POST if id is provided
        Lead lead;
        if (body.containsKey("id") && body.get("id") != null) {
            Optional<Lead> existing = leadRepository.findByUserIdAndId(userId, (String) body.get("id"));
            lead = existing.orElseGet(Lead::new);
        } else {
            lead = new Lead();
        }

        lead.setName(name);
        lead.setCompany((String) body.get("company"));
        lead.setPhone((String) body.get("phone"));
        lead.setEmail((String) body.get("email"));
        lead.setWebsite((String) body.get("website"));
        lead.setAddress((String) body.get("address"));
        lead.setRating(body.get("rating") != null ? body.get("rating").toString() : "0");
        lead.setDealValue(body.containsKey("dealValue") ? Double.parseDouble(body.get("dealValue").toString()) : 0.0);
        lead.setStatus(body.containsKey("status") ? (String) body.get("status") : "PROSPECT");
        lead.setOrigin(body.containsKey("origin") ? (String) body.get("origin") : "MANUAL");
        lead.setNotes((String) body.get("notes"));
        lead.setUser(userOpt.get());

        if (body.containsKey("tags")) {
            Object tagsObj = body.get("tags");
            if (tagsObj instanceof List) {
                lead.setTags(String.join(",", (List<String>) tagsObj));
            } else if (tagsObj != null) {
                lead.setTags(tagsObj.toString());
            }
        }

        if (body.containsKey("projectId") && body.get("projectId") != null) {
            Optional<Project> projectOpt = projectRepository.findById((String) body.get("projectId"));
            projectOpt.ifPresent(lead::setProject);
        }

        if (body.containsKey("lastContactDate") && body.get("lastContactDate") != null) {
            try {
                lead.setLastContactDate(LocalDateTime.parse((String) body.get("lastContactDate")));
            } catch (Exception ignored) {}
        }

        leadRepository.save(lead);
        return ResponseEntity.ok(lead);
    }

    // 3. Get single lead (GET /api/leads/crm/{id})
    @GetMapping("/crm/{id}")
    public ResponseEntity<?> getLead(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<Lead> leadOpt = leadRepository.findByUserIdAndId(userId, id);
        if (leadOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(leadOpt.get());
    }

    // 4. Update single lead (PUT /api/leads/crm/{id})
    @PutMapping("/crm/{id}")
    public ResponseEntity<?> updateLead(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        Optional<Lead> leadOpt = leadRepository.findByUserIdAndId(userId, id);
        if (leadOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Lead lead = leadOpt.get();
        if (body.containsKey("name")) lead.setName((String) body.get("name"));
        if (body.containsKey("company")) lead.setCompany((String) body.get("company"));
        if (body.containsKey("phone")) lead.setPhone((String) body.get("phone"));
        if (body.containsKey("email")) lead.setEmail((String) body.get("email"));
        if (body.containsKey("website")) lead.setWebsite((String) body.get("website"));
        if (body.containsKey("address")) lead.setAddress((String) body.get("address"));
        if (body.containsKey("rating")) lead.setRating(body.get("rating").toString());
        if (body.containsKey("dealValue")) lead.setDealValue(Double.parseDouble(body.get("dealValue").toString()));
        if (body.containsKey("status")) lead.setStatus((String) body.get("status"));
        if (body.containsKey("notes")) lead.setNotes((String) body.get("notes"));
        
        if (body.containsKey("tags")) {
            Object tagsObj = body.get("tags");
            if (tagsObj instanceof List) {
                lead.setTags(String.join(",", (List<String>) tagsObj));
            } else if (tagsObj != null) {
                lead.setTags(tagsObj.toString());
            }
        }

        if (body.containsKey("projectId")) {
            String pId = (String) body.get("projectId");
            if (pId == null) {
                lead.setProject(null);
            } else {
                Optional<Project> projectOpt = projectRepository.findById(pId);
                projectOpt.ifPresent(lead::setProject);
            }
        }

        if (body.containsKey("lastContactDate")) {
            Object lcd = body.get("lastContactDate");
            if (lcd == null) {
                lead.setLastContactDate(null);
            } else {
                try {
                    lead.setLastContactDate(LocalDateTime.parse(lcd.toString()));
                } catch (Exception ignored) {}
            }
        }

        leadRepository.save(lead);
        return ResponseEntity.ok(lead);
    }

    // 5. Delete single lead (DELETE /api/leads/crm/{id})
    @DeleteMapping("/crm/{id}")
    public ResponseEntity<?> deleteLead(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<Lead> leadOpt = leadRepository.findByUserIdAndId(userId, id);
        if (leadOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        leadRepository.delete(leadOpt.get());
        return ResponseEntity.ok(Map.of("message", "Lead excluído com sucesso"));
    }

    // 6. Search leads using LeadCrawlerService (GET /api/leads/search)
    @GetMapping("/search")
    public ResponseEntity<?> searchLeads(
            @RequestParam(required = false) String niche,
            @RequestParam(required = false) String query,
            @RequestParam String city,
            @RequestParam(required = false) String state,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "false") boolean onlyWithoutWebsite,
            @RequestParam(defaultValue = "false") boolean onlyWithWebsite,
            @RequestParam(defaultValue = "false") boolean hasPhone,
            @RequestParam(defaultValue = "false") boolean hasWhatsapp,
            @RequestParam(defaultValue = "0") double minRating,
            @RequestParam(defaultValue = "0") int minReviews,
            @RequestParam(defaultValue = "rating") String sortBy) {

        String term = niche != null ? niche : query;
        if (term == null || term.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nicho ou termo de busca é obrigatório"));
        }

        try {
            List<Map<String, Object>> leads = crawlerService.searchLeads(term, city, state, page);

            // Filter leads
            List<Map<String, Object>> filteredLeads = leads.stream().filter(lead -> {
                String website = (String) lead.get("website");
                boolean hasWeb = website != null && !website.trim().isEmpty();
                if (onlyWithoutWebsite && hasWeb) return false;
                if (onlyWithWebsite && !hasWeb) return false;

                String phone = (String) lead.get("phone");
                boolean hasPh = phone != null && !phone.trim().isEmpty();
                if (hasPhone && !hasPh) return false;

                if (hasWhatsapp) {
                    boolean isCel = phone != null && (phone.contains(" 9") || phone.replace(" ", "").length() >= 11);
                    if (!isCel) return false;
                }

                Object ratingObj = lead.get("rating");
                double rating = ratingObj != null ? Double.parseDouble(ratingObj.toString()) : 0.0;
                if (rating < minRating) return false;

                Object reviewsObj = lead.get("reviewsCount");
                int reviews = reviewsObj != null ? Integer.parseInt(reviewsObj.toString()) : 0;
                if (reviews < minReviews) return false;

                return true;
            }).collect(Collectors.toList());

            // Sort leads
            if ("rating".equalsIgnoreCase(sortBy)) {
                filteredLeads.sort((a, b) -> {
                    double ra = a.get("rating") != null ? Double.parseDouble(a.get("rating").toString()) : 0.0;
                    double rb = b.get("rating") != null ? Double.parseDouble(b.get("rating").toString()) : 0.0;
                    return Double.compare(rb, ra); // Descending
                });
            } else if ("reviews".equalsIgnoreCase(sortBy) || "reviewsCount".equalsIgnoreCase(sortBy)) {
                filteredLeads.sort((a, b) -> {
                    int ra = a.get("reviewsCount") != null ? Integer.parseInt(a.get("reviewsCount").toString()) : 0;
                    int rb = b.get("reviewsCount") != null ? Integer.parseInt(b.get("reviewsCount").toString()) : 0;
                    return Integer.compare(rb, ra); // Descending
                });
            } else if ("name".equalsIgnoreCase(sortBy)) {
                filteredLeads.sort((a, b) -> {
                    String na = (String) a.getOrDefault("name", "");
                    String nb = (String) b.getOrDefault("name", "");
                    return na.compareToIgnoreCase(nb);
                });
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "total", filteredLeads.size(),
                    "page", page,
                    "hasMore", leads.size() >= 20,
                    "leads", filteredLeads
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    // 7. Get user's presets (GET /api/leads/presets)
    @GetMapping("/presets")
    public ResponseEntity<?> getPresets(@AuthenticationPrincipal String userId) {
        List<LeadPreset> presets = leadPresetRepository.findAllByUserId(userId);
        return ResponseEntity.ok(Map.of("presets", presets));
    }

    // 8. Create a preset (POST /api/leads/presets)
    @PostMapping("/presets")
    public ResponseEntity<?> createPreset(@AuthenticationPrincipal String userId, @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String niche = (String) body.get("niche");
        String city = (String) body.get("city");

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário não encontrado"));
        }

        LeadPreset preset = new LeadPreset();
        preset.setName(name);
        preset.setNiche(niche);
        preset.setCity(city);
        preset.setState((String) body.get("state"));
        preset.setCountry(body.containsKey("country") ? (String) body.get("country") : "Brasil");
        preset.setOnlyWithoutWebsite(body.containsKey("onlyWithoutWebsite") && (boolean) body.get("onlyWithoutWebsite"));
        preset.setOnlyWithWebsite(body.containsKey("onlyWithWebsite") && (boolean) body.get("onlyWithWebsite"));
        preset.setHasPhoneOnly(body.containsKey("hasPhoneOnly") && (boolean) body.get("hasPhoneOnly"));
        preset.setHasWhatsappOnly(body.containsKey("hasWhatsappOnly") && (boolean) body.get("hasWhatsappOnly"));
        preset.setMinRating(body.containsKey("minRating") ? Double.parseDouble(body.get("minRating").toString()) : 0.0);
        preset.setUser(userOpt.get());

        leadPresetRepository.save(preset);
        return ResponseEntity.status(201).body(Map.of("success", true, "id", preset.getId()));
    }

    // 9. Update a preset (PUT /api/leads/presets/{id})
    @PutMapping("/presets/{id}")
    public ResponseEntity<?> updatePreset(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        Optional<LeadPreset> presetOpt = leadPresetRepository.findByIdAndUserIdCustom(id, userId);
        if (presetOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        LeadPreset preset = presetOpt.get();
        if (body.containsKey("name")) preset.setName((String) body.get("name"));
        if (body.containsKey("niche")) preset.setNiche((String) body.get("niche"));
        if (body.containsKey("city")) preset.setCity((String) body.get("city"));
        if (body.containsKey("state")) preset.setState((String) body.get("state"));
        if (body.containsKey("country")) preset.setCountry((String) body.get("country"));
        if (body.containsKey("onlyWithoutWebsite")) preset.setOnlyWithoutWebsite((boolean) body.get("onlyWithoutWebsite"));
        if (body.containsKey("onlyWithWebsite")) preset.setOnlyWithWebsite((boolean) body.get("onlyWithWebsite"));
        if (body.containsKey("hasPhoneOnly")) preset.setHasPhoneOnly((boolean) body.get("hasPhoneOnly"));
        if (body.containsKey("hasWhatsappOnly")) preset.setHasWhatsappOnly((boolean) body.get("hasWhatsappOnly"));
        if (body.containsKey("minRating")) preset.setMinRating(Double.parseDouble(body.get("minRating").toString()));

        leadPresetRepository.save(preset);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // 10. Delete a preset (DELETE /api/leads/presets/{id})
    @DeleteMapping("/presets/{id}")
    public ResponseEntity<?> deletePreset(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<LeadPreset> presetOpt = leadPresetRepository.findByIdAndUserIdCustom(id, userId);
        if (presetOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        leadPresetRepository.delete(presetOpt.get());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/project")
    public ResponseEntity<?> linkProject(@AuthenticationPrincipal String userId, @RequestBody Map<String, Object> body) {
        String leadId = (String) body.get("leadId");
        String projectId = (String) body.get("projectId");

        if (leadId == null || projectId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "leadId e projectId são obrigatórios"));
        }

        Optional<Lead> leadOpt = leadRepository.findByUserIdAndId(userId, leadId);
        if (leadOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lead não encontrado"));
        }

        Optional<Project> projectOpt = projectRepository.findById(projectId);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Projeto não encontrado"));
        }

        Lead lead = leadOpt.get();
        lead.setProject(projectOpt.get());
        leadRepository.save(lead);

        return ResponseEntity.ok(lead);
    }

    @GetMapping("/nominatim")
    public ResponseEntity<?> nominatimSearch(@RequestParam String q) {
        try {
            String url = "https://nominatim.openstreetmap.org/search?format=json&q=" + URLEncoder.encode(q, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", "Mozilla/5.0")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    // POST /api/leads/search-leads — fallback search endpoint used by Dashboard.tsx
    @PostMapping("/search-leads")
    public ResponseEntity<?> searchLeadsFallback(
            @AuthenticationPrincipal String userId,
            @RequestBody Map<String, Object> body) {
        try {
            String query = (String) body.getOrDefault("query", "");
            String location = (String) body.getOrDefault("location", "");
            // Parse city from "city state country" string
            String[] parts = location.trim().split("\\s+", 2);
            String city = parts.length > 0 ? parts[0] : "";
            String state = parts.length > 1 ? parts[1] : null;
            List<Map<String, Object>> leads = crawlerService.searchLeads(query, city, state, 1);
            return ResponseEntity.ok(Map.of("leads", leads));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}

