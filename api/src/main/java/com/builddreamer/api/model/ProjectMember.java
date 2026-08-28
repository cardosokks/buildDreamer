package com.builddreamer.api.model;

import jakarta.persistence.*;

@Entity
@Table(name = "\"ProjectMember\"")
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String role = "OWNER";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    public ProjectMember() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }

    public static ProjectMemberBuilder builder() {
        return new ProjectMemberBuilder();
    }

    public static class ProjectMemberBuilder {
        private final ProjectMember member = new ProjectMember();

        public ProjectMemberBuilder role(String role) { member.setRole(role); return this; }
        public ProjectMemberBuilder user(User user) { member.setUser(user); return this; }
        public ProjectMemberBuilder project(Project project) { member.setProject(project); return this; }
        public ProjectMember build() { return member; }
    }
}
