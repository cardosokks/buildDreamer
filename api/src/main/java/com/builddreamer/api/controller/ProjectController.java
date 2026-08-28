package com.builddreamer.api.controller;

import com.builddreamer.api.model.Project;
import com.builddreamer.api.model.ProjectMember;
import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.ProjectMemberRepository;
import com.builddreamer.api.repository.ProjectRepository;
import com.builddreamer.api.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final UserRepository userRepository;

    public ProjectController(
            ProjectRepository projectRepository,
            ProjectMemberRepository memberRepository,
            UserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
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

        return ResponseEntity.ok(projectOpt.get());
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
}
