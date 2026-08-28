package com.builddreamer.api.dto;

import lombok.*;

public class AuthDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginRequest {
        private String email;
        private String password;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SignupRequest {
        private String email;
        private String password;
        private String name;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserResponse {
        private String id;
        private String email;
        private String name;
        private String geminiApiKey;
        private String openaiApiKey;
        private String aiProxyUrl;
        private String ngrokAuthToken;
        private String customAiSkills;
        private String customAiModels;
        private String savedLeads;
        private String filterPresets;

        public UserResponse(com.builddreamer.api.model.User user) {
            this.id = user.getId();
            this.email = user.getEmail();
            this.name = user.getName();
            this.geminiApiKey = user.getGeminiApiKey();
            this.openaiApiKey = user.getOpenaiApiKey();
            this.aiProxyUrl = user.getAiProxyUrl();
            this.ngrokAuthToken = user.getNgrokAuthToken();
            this.customAiSkills = user.getCustomAiSkills();
            this.customAiModels = user.getCustomAiModels();
            this.savedLeads = user.getSavedLeads();
            this.filterPresets = user.getFilterPresets();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuthResponse {
        private String token;
        private UserResponse user;
    }
}
