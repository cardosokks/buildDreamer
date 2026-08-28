package com.builddreamer.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "\"Media\"")
public class Media {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String url;

    private Long size;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "project_id")
    private String projectId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Media() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public Long getSize() { return size; }
    public void setSize(Long size) { this.size = size; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static MediaBuilder builder() {
        return new MediaBuilder();
    }

    public static class MediaBuilder {
        private final Media media = new Media();

        public MediaBuilder id(String id) { media.setId(id); return this; }
        public MediaBuilder name(String name) { media.setName(name); return this; }
        public MediaBuilder url(String url) { media.setUrl(url); return this; }
        public MediaBuilder size(Long size) { media.setSize(size); return this; }
        public MediaBuilder mimeType(String mimeType) { media.setMimeType(mimeType); return this; }
        public MediaBuilder userId(String userId) { media.setUserId(userId); return this; }
        public MediaBuilder projectId(String projectId) { media.setProjectId(projectId); return this; }
        public Media build() { return media; }
    }
}
