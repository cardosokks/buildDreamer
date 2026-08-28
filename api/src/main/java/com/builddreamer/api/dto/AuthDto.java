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

    public static class AuthResponse {
        private String token;
        private String userId;
        private String email;
        private String name;

        public AuthResponse() {}
        public AuthResponse(String token, String userId, String email, String name) {
            this.token = token;
            this.userId = userId;
            this.email = email;
            this.name = name;
        }

        public String getToken() { return token; }
        public void setToken(String token) { this.token = token; }
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public static AuthResponseBuilder builder() {
            return new AuthResponseBuilder();
        }

        public static class AuthResponseBuilder {
            private final AuthResponse response = new AuthResponse();

            public AuthResponseBuilder token(String token) { response.setToken(token); return this; }
            public AuthResponseBuilder userId(String userId) { response.setUserId(userId); return this; }
            public AuthResponseBuilder email(String email) { response.setEmail(email); return this; }
            public AuthResponseBuilder name(String name) { response.setName(name); return this; }
            public AuthResponse build() { return response; }
        }
    }
}
