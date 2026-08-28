package com.builddreamer.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "\"Page\"")
public class Page {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug;

    private String title;

    private String description;

    @Column(columnDefinition = "text", nullable = false)
    private String html = "<div></div>";

    @Column(columnDefinition = "text", nullable = false)
    private String css = "";

    @Column(columnDefinition = "text", nullable = false)
    private String js = "";

    @Column(name = "seo_title")
    private String seoTitle;

    @Column(name = "seo_description")
    private String seoDescription;

    @Column(name = "is_homepage", nullable = false)
    private boolean isHomepage = false;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Page() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getHtml() { return html; }
    public void setHtml(String html) { this.html = html; }
    public String getCss() { return css; }
    public void setCss(String css) { this.css = css; }
    public String getJs() { return js; }
    public void setJs(String js) { this.js = js; }
    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }
    public String getSeoDescription() { return seoDescription; }
    public void setSeoDescription(String seoDescription) { this.seoDescription = seoDescription; }
    public boolean isHomepage() { return isHomepage; }
    public void setHomepage(boolean homepage) { isHomepage = homepage; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static PageBuilder builder() {
        return new PageBuilder();
    }

    public static class PageBuilder {
        private final Page page = new Page();

        public PageBuilder name(String name) { page.setName(name); return this; }
        public PageBuilder slug(String slug) { page.setSlug(slug); return this; }
        public PageBuilder title(String title) { page.setTitle(title); return this; }
        public PageBuilder description(String description) { page.setDescription(description); return this; }
        public PageBuilder html(String html) { page.setHtml(html); return this; }
        public PageBuilder css(String css) { page.setCss(css); return this; }
        public PageBuilder js(String js) { page.setJs(js); return this; }
        public PageBuilder seoTitle(String seoTitle) { page.setSeoTitle(seoTitle); return this; }
        public PageBuilder seoDescription(String seoDescription) { page.setSeoDescription(seoDescription); return this; }
        public PageBuilder isHomepage(boolean isHomepage) { page.setHomepage(isHomepage); return this; }
        public PageBuilder project(Project project) { page.setProject(project); return this; }
        public Page build() { return page; }
    }
}
