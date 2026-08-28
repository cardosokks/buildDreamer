package com.builddreamer.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "\"User\"")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
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

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
