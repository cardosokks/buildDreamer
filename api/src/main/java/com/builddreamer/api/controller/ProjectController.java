package com.builddreamer.api.controller;

import com.builddreamer.api.model.Page;
import com.builddreamer.api.model.Project;
import com.builddreamer.api.model.ProjectMember;
import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.PageRepository;
import com.builddreamer.api.repository.ProjectMemberRepository;
import com.builddreamer.api.repository.ProjectRepository;
import com.builddreamer.api.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final PageRepository pageRepository;
    private final com.builddreamer.api.service.SiteRemasterService remasterService;

    public ProjectController(
            ProjectRepository projectRepository,
            ProjectMemberRepository memberRepository,
            UserRepository userRepository,
            PageRepository pageRepository,
            com.builddreamer.api.service.SiteRemasterService remasterService) {
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.pageRepository = pageRepository;
        this.remasterService = remasterService;
    }

    @GetMapping
    public ResponseEntity<List<Project>> listProjects(@AuthenticationPrincipal String userId) {
        List<Project> projects = projectRepository.findProjectsByUserId(userId);
        return ResponseEntity.ok(projects);
    }

    @PostMapping
    public ResponseEntity<?> createProject(@AuthenticationPrincipal String userId, @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String description = (String) body.get("description");
        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nome do projeto é obrigatório"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "Usuário inválido"));
        }

        Project project = Project.builder()
                .name(name)
                .description(description)
                .status("development")
                .domain("project-" + System.currentTimeMillis() + ".local")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        projectRepository.save(project);

        ProjectMember member = ProjectMember.builder()
                .project(project)
                .user(userOpt.get())
                .role("OWNER")
                .build();

        memberRepository.save(member);

        return ResponseEntity.ok(project);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getProject(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<ProjectMember> memberOpt = memberRepository.findByProjectIdAndUserId(id, userId);
        if (memberOpt.isEmpty()) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }

        Optional<Project> projectOpt = projectRepository.findById(id);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Project project = projectOpt.get();
        List<Page> pages = pageRepository.findByProjectId(id);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", project.getId());
        response.put("name", project.getName());
        response.put("description", project.getDescription());
        response.put("status", project.getStatus());
        response.put("domain", project.getDomain());
        response.put("favicon", project.getFavicon());
        response.put("navbarHtml", project.getNavbarHtml() != null ? project.getNavbarHtml() : "");
        response.put("footerHtml", project.getFooterHtml() != null ? project.getFooterHtml() : "");
        response.put("createdAt", project.getCreatedAt());
        response.put("updatedAt", project.getUpdatedAt());
        response.put("pages", pages);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProject(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        Optional<ProjectMember> memberOpt = memberRepository.findByProjectIdAndUserId(id, userId);
        if (memberOpt.isEmpty() || !"OWNER".equals(memberOpt.get().getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Permissão negada"));
        }

        Optional<Project> projectOpt = projectRepository.findById(id);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Project project = projectOpt.get();
        if (body.containsKey("name")) project.setName((String) body.get("name"));
        if (body.containsKey("description")) project.setDescription((String) body.get("description"));
        if (body.containsKey("status")) project.setStatus((String) body.get("status"));
        if (body.containsKey("domain")) project.setDomain((String) body.get("domain"));
        if (body.containsKey("favicon")) project.setFavicon((String) body.get("favicon"));

        projectRepository.save(project);
        return ResponseEntity.ok(project);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProject(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<ProjectMember> memberOpt = memberRepository.findByProjectIdAndUserId(id, userId);
        if (memberOpt.isEmpty() || !"OWNER".equals(memberOpt.get().getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Permissão negada"));
        }

        Optional<Project> projectOpt = projectRepository.findById(id);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        projectRepository.delete(projectOpt.get());
        return ResponseEntity.ok(Map.of("message", "Projeto excluído com sucesso"));
    }

    @PutMapping("/{id}/globals")
    public ResponseEntity<?> updateGlobals(
            @AuthenticationPrincipal String userId,
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        Optional<ProjectMember> memberOpt = memberRepository.findByProjectIdAndUserId(id, userId);
        if (memberOpt.isEmpty()) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }

        Optional<Project> projectOpt = projectRepository.findById(id);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Project project = projectOpt.get();
        if (body.containsKey("navbarHtml")) project.setNavbarHtml((String) body.get("navbarHtml"));
        if (body.containsKey("footerHtml")) project.setFooterHtml((String) body.get("footerHtml"));

        projectRepository.save(project);
        return ResponseEntity.ok(project);
    }

    @GetMapping("/jobs/{projectId}/status")
    public ResponseEntity<?> getJobStatus(@PathVariable String projectId) {
        Map<String, Object> status = remasterService.getJobStatus(projectId);
        if (status.isEmpty()) {
            return ResponseEntity.ok(Map.of("status", "none", "projectId", projectId));
        }
        return ResponseEntity.ok(status);
    }

    /**
     * POST /api/projects/import-zip
     * Body: { targetProjectId: string, zipBase64: string (data URL) }
     * Extracts HTML/CSS/JS files from the ZIP and adds them as pages to the target project.
     */
    @PostMapping("/import-zip")
    public ResponseEntity<?> importZip(
            @AuthenticationPrincipal String userId,
            @RequestBody Map<String, Object> body) {
        String targetProjectId = (String) body.get("targetProjectId");
        String zipBase64 = (String) body.get("zipBase64");

        if (targetProjectId == null || zipBase64 == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "targetProjectId e zipBase64 são obrigatórios"));
        }

        Optional<ProjectMember> memberOpt = memberRepository.findByProjectIdAndUserId(targetProjectId, userId);
        if (memberOpt.isEmpty()) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }

        Optional<Project> projectOpt = projectRepository.findById(targetProjectId);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Project project = projectOpt.get();

        try {
            // Decode base64 data URL
            String pureBase64 = zipBase64.contains(",") ? zipBase64.split(",")[1] : zipBase64;
            byte[] zipBytes = Base64.getDecoder().decode(pureBase64);

            List<String> importedPages = new ArrayList<>();
            try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
                ZipEntry entry;
                while ((entry = zis.getNextEntry()) != null) {
                    String name = entry.getName();
                    if (entry.isDirectory()) continue;
                    if (!name.endsWith(".html")) continue;

                    byte[] content = zis.readAllBytes();
                    String html = new String(content, java.nio.charset.StandardCharsets.UTF_8);
                    String slug = name.replaceAll(".*/", "").replace(".html", "");
                    String pageName = slug.equals("index") ? "Home" : slug.substring(0, 1).toUpperCase() + slug.substring(1);

                    if (pageRepository.existsByProjectIdAndSlug(targetProjectId, slug)) {
                        slug = slug + "-imported-" + System.currentTimeMillis();
                    }

                    Page page = new Page();
                    page.setName(pageName);
                    page.setSlug(slug);
                    page.setTitle(pageName + " | " + project.getName());
                    page.setHtml(html);
                    page.setCss("");
                    page.setJs("");
                    page.setHomepage(slug.equals("index"));
                    page.setProject(project);
                    pageRepository.save(page);
                    importedPages.add(pageName);
                    zis.closeEntry();
                }
            }

            return ResponseEntity.ok(Map.of("success", true, "importedPages", importedPages));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Erro ao importar ZIP: " + ex.getMessage()));
        }
    }
}
