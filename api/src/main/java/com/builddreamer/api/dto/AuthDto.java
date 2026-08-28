package com.builddreamer.api.dto;

public class AuthDto {

    public static class LoginRequest {
        private String email;
        private String password;

        public LoginRequest() {}
        public LoginRequest(String email, String password) {
            this.email = email;
            this.password = password;
        }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class SignupRequest {
        private String email;
        private String password;
        private String name;

        public SignupRequest() {}
        public SignupRequest(String email, String password, String name) {
            this.email = email;
            this.password = password;
            this.name = name;
        }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
    }

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

        public UserResponse() {}
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

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
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
    }

    public static class AuthResponse {
        private String token;
        private UserResponse user;

        public AuthResponse() {}
        public AuthResponse(String token, UserResponse user) {
            this.token = token;
            this.user = user;
        }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public UserResponse getUser() { return user; }
        public void setUser(UserResponse user) { this.user = user; }
    }
}
