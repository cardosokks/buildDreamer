package com.builddreamer.api.controller;

import com.builddreamer.api.model.Page;
import com.builddreamer.api.model.Project;
import com.builddreamer.api.model.ProjectMember;
import com.builddreamer.api.repository.PageRepository;
import com.builddreamer.api.repository.ProjectMemberRepository;
import com.builddreamer.api.repository.ProjectRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/projects/{projectId}/pages")
public class PageController {

    private final PageRepository pageRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final com.builddreamer.api.service.FtpService ftpService;

    public PageController(
            PageRepository pageRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository memberRepository,
            com.builddreamer.api.service.FtpService ftpService) {
        this.pageRepository = pageRepository;
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.ftpService = ftpService;
    }

    private boolean checkAccess(String projectId, String userId) {
        return memberRepository.findByProjectIdAndUserId(projectId, userId).isPresent();
    }

    @GetMapping
    public ResponseEntity<?> listPages(@AuthenticationPrincipal String userId, @PathVariable String projectId) {
        if (!checkAccess(projectId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }
        List<Page> pages = pageRepository.findByProjectId(projectId);
        return ResponseEntity.ok(pages);
    }

    @PostMapping
    public ResponseEntity<?> createPage(
            @AuthenticationPrincipal String userId,
            @PathVariable String projectId,
            @RequestBody Map<String, Object> body) {
        if (!checkAccess(projectId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }

        String name = (String) body.get("name");
        String slug = (String) body.get("slug");
        if (name == null || slug == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nome e slug são obrigatórios"));
        }

        Optional<Project> projectOpt = projectRepository.findById(projectId);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        if (pageRepository.existsByProjectIdAndSlug(projectId, slug)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Slug já existente neste projeto"));
        }

        Page page = Page.builder()
                .name(name)
                .slug(slug.toLowerCase().trim())
                .title((String) body.get("title"))
                .description((String) body.get("description"))
                .html(body.containsKey("html") ? (String) body.get("html") : "<div></div>")
                .css(body.containsKey("css") ? (String) body.get("css") : "")
                .js(body.containsKey("js") ? (String) body.get("js") : "")
                .isHomepage(body.containsKey("isHomepage") && (Boolean) body.get("isHomepage"))
                .project(projectOpt.get())
                .build();

        pageRepository.save(page);

        // Upload page to FTP in background
        try {
            Project proj = projectOpt.get();
            ftpService.uploadSinglePageToFTP(proj.getName(), page.getSlug(), page.getHtml(), page.getCss(), page.getJs(), page.isHomepage(), proj.getNavbarHtml(), proj.getFooterHtml());
        } catch (Exception ignored) {}

        return ResponseEntity.ok(page);
    }

    @GetMapping("/{pageId}")
    public ResponseEntity<?> getPage(
            @AuthenticationPrincipal String userId,
            @PathVariable String projectId,
            @PathVariable String pageId) {
        if (!checkAccess(projectId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }

        Optional<Page> pageOpt = pageRepository.findByProjectIdAndId(projectId, pageId);
        if (pageOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(pageOpt.get());
    }

    @PutMapping("/{pageId}")
    public ResponseEntity<?> updatePage(
            @AuthenticationPrincipal String userId,
            @PathVariable String projectId,
            @PathVariable String pageId,
            @RequestBody Map<String, Object> body) {
        if (!checkAccess(projectId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }

        Optional<Page> pageOpt = pageRepository.findByProjectIdAndId(projectId, pageId);
        if (pageOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Page page = pageOpt.get();
        if (body.containsKey("name")) page.setName((String) body.get("name"));
        if (body.containsKey("title")) page.setTitle((String) body.get("title"));
        if (body.containsKey("description")) page.setDescription((String) body.get("description"));
        if (body.containsKey("html")) page.setHtml((String) body.get("html"));
        if (body.containsKey("css")) page.setCss((String) body.get("css"));
        if (body.containsKey("js")) page.setJs((String) body.get("js"));
        if (body.containsKey("seoTitle")) page.setSeoTitle((String) body.get("seoTitle"));
        if (body.containsKey("seoDescription")) page.setSeoDescription((String) body.get("seoDescription"));

        if (body.containsKey("isHomepage") && Boolean.TRUE.equals(body.get("isHomepage"))) {
            // Unset previous homepage for all pages in this project
            List<Page> projectPages = pageRepository.findByProjectId(projectId);
            for (Page p : projectPages) {
                if (p.isHomepage()) {
                    p.setHomepage(false);
                    pageRepository.save(p);
                }
            }
            page.setHomepage(true);
        } else if (body.containsKey("isHomepage")) {
            page.setHomepage((Boolean) body.get("isHomepage"));
        }

        pageRepository.save(page);

        // Upload page to FTP in background
        try {
            Project proj = page.getProject();
            if (proj != null) {
                ftpService.uploadSinglePageToFTP(proj.getName(), page.getSlug(), page.getHtml(), page.getCss(), page.getJs(), page.isHomepage(), proj.getNavbarHtml(), proj.getFooterHtml());
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(page);
    }

    @DeleteMapping("/{pageId}")
    public ResponseEntity<?> deletePage(
            @AuthenticationPrincipal String userId,
            @PathVariable String projectId,
            @PathVariable String pageId) {
        if (!checkAccess(projectId, userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "Acesso negado"));
        }

        Optional<Page> pageOpt = pageRepository.findByProjectIdAndId(projectId, pageId);
        if (pageOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Page page = pageOpt.get();
        List<Page> projectPages = pageRepository.findByProjectId(projectId);
        if (page.isHomepage() && projectPages.size() > 1) {
            return ResponseEntity.badRequest().body(Map.of("error", "Não é possível excluir a página inicial do projeto sem definir outra página como principal antes"));
        }

        pageRepository.delete(page);
        return ResponseEntity.ok(Map.of("message", "Página excluída com sucesso"));
    }
}
