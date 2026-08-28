package com.builddreamer.api.controller;

import com.builddreamer.api.model.Lead;
import com.builddreamer.api.model.Project;
import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.LeadRepository;
import com.builddreamer.api.repository.ProjectRepository;
import com.builddreamer.api.repository.UserRepository;
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

@RestController
@RequestMapping("/api/leads")
public class LeadController {

    private final LeadRepository leadRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public LeadController(
            LeadRepository leadRepository,
            UserRepository userRepository,
            ProjectRepository projectRepository) {
        this.leadRepository = leadRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
    }

    @GetMapping
    public ResponseEntity<List<Lead>> getLeads(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(leadRepository.findByUserId(userId));
    }

    @PostMapping
    public ResponseEntity<?> createLead(@AuthenticationPrincipal String userId, @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nome é obrigatório"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário inválido"));
        }

        Lead lead = Lead.builder()
                .name(name)
                .company((String) body.get("company"))
                .phone((String) body.get("phone"))
                .email((String) body.get("email"))
                .website((String) body.get("website"))
                .address((String) body.get("address"))
                .rating((String) body.get("rating"))
                .status(body.containsKey("status") ? (String) body.get("status") : "PROSPECT")
                .origin(body.containsKey("origin") ? (String) body.get("origin") : "MANUAL")
                .notes((String) body.get("notes"))
                .tags(body.containsKey("tags") ? body.get("tags").toString() : "")
                .user(userOpt.get())
                .build();

        if (body.containsKey("projectId") && body.get("projectId") != null) {
            Optional<Project> projectOpt = projectRepository.findById((String) body.get("projectId"));
            projectOpt.ifPresent(lead::setProject);
        }

        leadRepository.save(lead);
        return ResponseEntity.ok(lead);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getLead(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<Lead> leadOpt = leadRepository.findByUserIdAndId(userId, id);
        if (leadOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(leadOpt.get());
    }

    @PutMapping("/{id}")
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
        if (body.containsKey("rating")) lead.setRating((String) body.get("rating"));
        if (body.containsKey("status")) lead.setStatus((String) body.get("status"));
        if (body.containsKey("notes")) lead.setNotes((String) body.get("notes"));
        if (body.containsKey("tags")) lead.setTags(body.get("tags").toString());

        if (body.containsKey("projectId")) {
            String pId = (String) body.get("projectId");
            if (pId == null) {
                lead.setProject(null);
            } else {
                Optional<Project> projectOpt = projectRepository.findById(pId);
                projectOpt.ifPresent(lead::setProject);
            }
        }

        leadRepository.save(lead);
        return ResponseEntity.ok(lead);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLead(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<Lead> leadOpt = leadRepository.findByUserIdAndId(userId, id);
        if (leadOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        leadRepository.delete(leadOpt.get());
        return ResponseEntity.ok(Map.of("message", "Lead excluído com sucesso"));
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
}
