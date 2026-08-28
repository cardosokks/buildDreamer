package com.builddreamer.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "\"Version\"")
public class Version {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(columnDefinition = "text", nullable = false)
    private String snapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Version() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSnapshot() { return snapshot; }
    public void setSnapshot(String snapshot) { this.snapshot = snapshot; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static VersionBuilder builder() {
        return new VersionBuilder();
    }

    public static class VersionBuilder {
        private final Version version = new Version();

        public VersionBuilder name(String name) { version.setName(name); return this; }
        public VersionBuilder description(String description) { version.setDescription(description); return this; }
        public VersionBuilder snapshot(String snapshot) { version.setSnapshot(snapshot); return this; }
        public VersionBuilder project(Project project) { version.setProject(project); return this; }
        public Version build() { return version; }
    }
}
