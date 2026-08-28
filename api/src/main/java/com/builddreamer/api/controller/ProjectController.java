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
        try {
            String name = (String) body.get("name");
            String description = (String) body.get("description");
            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Nome do projeto é obrigatório"));
            }

            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(401).body(Map.of("error", "Usuário inválido"));
            }

            String uniqueDomain = "project-" + UUID.randomUUID().toString().substring(0, 8) + ".local";

            Project project = Project.builder()
                    .name(name.trim())
                    .description(description != null ? description.trim() : "")
                    .status("development")
                    .domain(uniqueDomain)
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

            // Automatically create initial homepage for the project
            Page homePage = Page.builder()
                    .name("Página Inicial")
                    .slug("home")
                    .title(project.getName())
                    .description("Página inicial do projeto " + project.getName())
                    .html("<section class=\"relative bg-slate-900 text-white py-24 px-6 md:px-12 rounded-3xl my-6 border border-slate-800 shadow-2xl overflow-hidden\">\n" +
                          "  <div class=\"max-w-4xl mx-auto text-center space-y-6\">\n" +
                          "    <span class=\"inline-block px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-semibold uppercase tracking-wider\">\n" +
                          "      Bem-vindo ao BuildDreamer\n" +
                          "    </span>\n" +
                          "    <h1 class=\"text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent\">\n" +
                          "      " + project.getName() + "\n" +
                          "    </h1>\n" +
                          "    <p class=\"text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-normal\">\n" +
                          "      Crie e personalize o seu site com o editor visual intuitivo.\n" +
                          "    </p>\n" +
                          "  </div>\n" +
                          "</section>")
                    .css("/* Estilos personalizados */")
                    .js("")
                    .isHomepage(true)
                    .project(project)
                    .build();

            pageRepository.save(homePage);

            // Trigger AI Generation if requested
            boolean isAIPrompt = body.containsKey("isAIPrompt") && Boolean.TRUE.equals(body.get("isAIPrompt"));
            if (isAIPrompt) {
                Map<String, Object> pageData = new HashMap<>();
                pageData.put("name", "Página Inicial");
                pageData.put("slug", "home");
                pageData.put("cleanText", description != null ? description : name);

                remasterService.runRemasterGenerationJob(
                        project.getId(),
                        List.of(pageData),
                        true,
                        true,
                        null,
                        null
                );
            }

            return ResponseEntity.ok(project);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Erro ao criar projeto: " + ex.getMessage()));
        }
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
        try {
            String targetProjectId = (String) body.get("targetProjectId");
            String zipBase64 = (String) body.get("zipBase64");
            String name = (String) body.get("name");
            String description = (String) body.get("description");

            if (zipBase64 == null || zipBase64.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Arquivo ZIP (zipBase64) é obrigatório"));
            }

            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isEmpty()) {
                return ResponseEntity.status(401).body(Map.of("error", "Usuário inválido"));
            }

            Project project;
            if (targetProjectId != null && !targetProjectId.trim().isEmpty()) {
                Optional<ProjectMember> memberOpt = memberRepository.findByProjectIdAndUserId(targetProjectId, userId);
                if (memberOpt.isEmpty()) {
                    return ResponseEntity.status(403).body(Map.of("error", "Acesso negado ao projeto alvo"));
                }
                Optional<Project> projectOpt = projectRepository.findById(targetProjectId);
                if (projectOpt.isEmpty()) {
                    return ResponseEntity.notFound().build();
                }
                project = projectOpt.get();
            } else {
                String projName = (name != null && !name.trim().isEmpty()) ? name.trim() : "Site Importado (ZIP)";
                project = Project.builder()
                        .name(projName)
                        .description(description != null ? description.trim() : "Projeto importado via arquivo ZIP")
                        .status("development")
                        .domain("project-" + UUID.randomUUID().toString().substring(0, 8) + ".local")
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
            }

            // Decode base64 data URL
            String pureBase64 = zipBase64.contains(",") ? zipBase64.split(",")[1] : zipBase64;
            byte[] zipBytes = Base64.getDecoder().decode(pureBase64);

            List<String> importedPages = new ArrayList<>();
            try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
                ZipEntry entry;
                while ((entry = zis.getNextEntry()) != null) {
                    String entryName = entry.getName();
                    if (entry.isDirectory()) continue;
                    if (!entryName.endsWith(".html")) continue;

                    byte[] content = zis.readAllBytes();
                    String html = new String(content, java.nio.charset.StandardCharsets.UTF_8);
                    String slug = entryName.replaceAll(".*/", "").replace(".html", "");
                    String pageName = slug.equals("index") ? "Home" : slug.substring(0, 1).toUpperCase() + slug.substring(1);

                    if (pageRepository.existsByProjectIdAndSlug(project.getId(), slug)) {
                        slug = slug + "-imported-" + System.currentTimeMillis();
                    }

                    Page page = new Page();
                    page.setName(pageName);
                    page.setSlug(slug);
                    page.setTitle(pageName + " | " + project.getName());
                    page.setHtml(html);
                    page.setCss("");
                    page.setJs("");
                    page.setHomepage(slug.equals("index") || importedPages.isEmpty());
                    page.setProject(project);
                    pageRepository.save(page);
                    importedPages.add(pageName);
                    zis.closeEntry();
                }
            }

            return ResponseEntity.ok(project);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Erro ao importar ZIP: " + ex.getMessage()));
        }
    }
}
