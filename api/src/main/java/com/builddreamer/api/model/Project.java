package com.builddreamer.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "\"Project\"")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private String status = "development";

    @Column(unique = true)
    private String domain;

    private String favicon;

    @Column(name = "navbar_html", columnDefinition = "text")
    private String navbarHtml = "";

    @Column(name = "footer_html", columnDefinition = "text")
    private String footerHtml = "";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectMember> members;

    @JsonIgnore
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Page> pages;

    @JsonIgnore
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Asset> assets;

    @JsonIgnore
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Version> versions;

    @JsonIgnore
    @OneToMany(mappedBy = "project")
    private List<Lead> crmLeads;

    public Project() {}

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
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getFavicon() { return favicon; }
    public void setFavicon(String favicon) { this.favicon = favicon; }
    public String getNavbarHtml() { return navbarHtml; }
    public void setNavbarHtml(String navbarHtml) { this.navbarHtml = navbarHtml; }
    public String getFooterHtml() { return footerHtml; }
    public void setFooterHtml(String footerHtml) { this.footerHtml = footerHtml; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public List<ProjectMember> getMembers() { return members; }
    public void setMembers(List<ProjectMember> members) { this.members = members; }
    public List<Page> getPages() { return pages; }
    public void setPages(List<Page> pages) { this.pages = pages; }
    public List<Asset> getAssets() { return assets; }
    public void setAssets(List<Asset> assets) { this.assets = assets; }
    public List<Version> getVersions() { return versions; }
    public void setVersions(List<Version> versions) { this.versions = versions; }
    public List<Lead> getCrmLeads() { return crmLeads; }
    public void setCrmLeads(List<Lead> crmLeads) { this.crmLeads = crmLeads; }

    public static ProjectBuilder builder() {
        return new ProjectBuilder();
    }

    public static class ProjectBuilder {
        private final Project project = new Project();

        public ProjectBuilder name(String name) { project.setName(name); return this; }
        public ProjectBuilder description(String description) { project.setDescription(description); return this; }
        public ProjectBuilder status(String status) { project.setStatus(status); return this; }
        public ProjectBuilder domain(String domain) { project.setDomain(domain); return this; }
        public ProjectBuilder favicon(String favicon) { project.setFavicon(favicon); return this; }
        public ProjectBuilder navbarHtml(String navbarHtml) { project.setNavbarHtml(navbarHtml); return this; }
        public ProjectBuilder footerHtml(String footerHtml) { project.setFooterHtml(footerHtml); return this; }
        public ProjectBuilder createdAt(LocalDateTime createdAt) { project.setCreatedAt(createdAt); return this; }
        public ProjectBuilder updatedAt(LocalDateTime updatedAt) { project.setUpdatedAt(updatedAt); return this; }
        public Project build() { return project; }
    }
}
