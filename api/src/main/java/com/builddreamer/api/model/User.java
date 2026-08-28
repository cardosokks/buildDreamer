package com.builddreamer.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "\"User\"")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(unique = true, nullable = false)
    private String email;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    private String name;

    @Column(name = "gemini_api_key")
    private String geminiApiKey;

    @Column(name = "openai_api_key")
    private String openaiApiKey;

    @Column(name = "ai_proxy_url")
    private String aiProxyUrl;

    @Column(name = "ngrok_auth_token")
    private String ngrokAuthToken;

    @Column(name = "custom_ai_skills", columnDefinition = "text")
    private String customAiSkills;

    @Column(name = "custom_ai_models", columnDefinition = "text")
    private String customAiModels;

    @Column(name = "saved_leads", columnDefinition = "text")
    private String savedLeads;

    @Column(name = "filter_presets", columnDefinition = "text")
    private String filterPresets;

    @JsonIgnore
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectMember> projects;

    @JsonIgnore
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Lead> crmLeads;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public User() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getGeminiApiKey() { return geminiApiKey; }
    public void setGeminiApiKey(String geminiApiKey) { this.geminiApiKey = geminiApiKey; }
    public String getOpenaiApiKey() { return openaiApiKey; }
    public void setOpenaiApiKey(String openaiApiKey) { this.openaiApiKey = openaiApiKey; }
    public String getAiProxyUrl() { return aiProxyUrl; }
    public void setAiProxyUrl(String aiProxyUrl) { this.aiProxyUrl = aiProxyUrl; }
    public String getNgrokAuthToken() { return ngrokAuthToken; }
    public void setNgrokAuthToken(String ngrokAuthToken) { this.ngrokAuthToken = ngrokAuthToken; }
    public String getCustomAiSkills() { return customAiSkills; }
    public void setCustomAiSkills(String customAiSkills) { this.customAiSkills = customAiSkills; }
    public String getCustomAiModels() { return customAiModels; }
    public void setCustomAiModels(String customAiModels) { this.customAiModels = customAiModels; }
    public String getSavedLeads() { return savedLeads; }
    public void setSavedLeads(String savedLeads) { this.savedLeads = savedLeads; }
    public String getFilterPresets() { return filterPresets; }
    public void setFilterPresets(String filterPresets) { this.filterPresets = filterPresets; }
    public List<ProjectMember> getProjects() { return projects; }
    public void setProjects(List<ProjectMember> projects) { this.projects = projects; }
    public List<Lead> getCrmLeads() { return crmLeads; }
    public void setCrmLeads(List<Lead> crmLeads) { this.crmLeads = crmLeads; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static UserBuilder builder() {
        return new UserBuilder();
    }

    public static class UserBuilder {
        private final User user = new User();

        public UserBuilder email(String email) { user.setEmail(email); return this; }
        public UserBuilder password(String password) { user.setPassword(password); return this; }
        public UserBuilder name(String name) { user.setName(name); return this; }
        public UserBuilder geminiApiKey(String geminiApiKey) { user.setGeminiApiKey(geminiApiKey); return this; }
        public UserBuilder openaiApiKey(String openaiApiKey) { user.setOpenaiApiKey(openaiApiKey); return this; }
        public UserBuilder aiProxyUrl(String aiProxyUrl) { user.setAiProxyUrl(aiProxyUrl); return this; }
        public UserBuilder ngrokAuthToken(String ngrokAuthToken) { user.setNgrokAuthToken(ngrokAuthToken); return this; }
        public UserBuilder customAiSkills(String customAiSkills) { user.setCustomAiSkills(customAiSkills); return this; }
        public UserBuilder customAiModels(String customAiModels) { user.setCustomAiModels(customAiModels); return this; }
        public UserBuilder savedLeads(String savedLeads) { user.setSavedLeads(savedLeads); return this; }
        public UserBuilder filterPresets(String filterPresets) { user.setFilterPresets(filterPresets); return this; }
        public User build() { return user; }
    }
}
