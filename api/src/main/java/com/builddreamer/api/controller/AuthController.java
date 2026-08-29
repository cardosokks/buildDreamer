package com.builddreamer.api.controller;

import com.builddreamer.api.config.JwtTokenProvider;
import com.builddreamer.api.dto.AuthDto;
import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> register(@RequestBody AuthDto.SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email já cadastrado"));
        }

        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName())
                .build();

        userRepository.save(user);

        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        AuthDto.UserResponse userResponse = new AuthDto.UserResponse(user);
        return ResponseEntity.ok(new AuthDto.AuthResponse(token, userResponse));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthDto.LoginRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());
        if (userOpt.isEmpty() || !passwordEncoder.matches(request.getPassword(), userOpt.get().getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciais inválidas"));
        }

        User user = userOpt.get();
        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        AuthDto.UserResponse userResponse = new AuthDto.UserResponse(user);
        return ResponseEntity.ok(new AuthDto.AuthResponse(token, userResponse));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(@AuthenticationPrincipal String userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        Map<String, Object> response = new HashMap<>();
        ObjectMapper mapper = new ObjectMapper();
        response.put("id", user.getId());
        response.put("email", user.getEmail());
        response.put("name", user.getName());
        response.put("geminiApiKey", user.getGeminiApiKey());
        response.put("openaiApiKey", user.getOpenaiApiKey());
        response.put("aiProxyUrl", user.getAiProxyUrl());
        response.put("ngrokAuthToken", user.getNgrokAuthToken());
        response.put("activeProvider", user.getActiveProvider());
        response.put("n8nWebhookUrl", user.getN8nWebhookUrl());
        response.put("ollamaServerUrl", user.getOllamaServerUrl());
        response.put("ollamaModel", user.getOllamaModel());

        // Parse JSON strings to objects so the frontend receives them as JSON arrays/objects
        try {
            response.put("customAiSkills", user.getCustomAiSkills() != null ? mapper.readTree(user.getCustomAiSkills()) : mapper.createArrayNode());
        } catch (Exception ex) {
            response.put("customAiSkills", Collections.emptyList());
        }
        try {
            response.put("customAiModels", user.getCustomAiModels() != null ? mapper.readTree(user.getCustomAiModels()) : mapper.createArrayNode());
        } catch (Exception ex) {
            response.put("customAiModels", Collections.emptyList());
        }
        try {
            response.put("customOllamaModels", user.getCustomOllamaModels() != null ? mapper.readTree(user.getCustomOllamaModels()) : mapper.createArrayNode());
        } catch (Exception ex) {
            response.put("customOllamaModels", Collections.emptyList());
        }
        try {
            response.put("savedLeads", user.getSavedLeads() != null ? mapper.readTree(user.getSavedLeads()) : mapper.createArrayNode());
        } catch (Exception ex) {
            response.put("savedLeads", Collections.emptyList());
        }
        try {
            response.put("filterPresets", user.getFilterPresets() != null ? mapper.readTree(user.getFilterPresets()) : mapper.createArrayNode());
        } catch (Exception ex) {
            response.put("filterPresets", Collections.emptyList());
        }

        return ResponseEntity.ok(response);
    }

    // GET /api/auth/settings — wraps the same user data in a 'settings' object
    @GetMapping("/settings")
    public ResponseEntity<?> getSettings(@AuthenticationPrincipal String userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User user = userOpt.get();
        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> settings = new HashMap<>();
        settings.put("geminiApiKey", user.getGeminiApiKey());
        settings.put("openaiApiKey", user.getOpenaiApiKey());
        settings.put("aiProxyUrl", user.getAiProxyUrl());
        settings.put("ngrokAuthToken", user.getNgrokAuthToken());
        settings.put("activeProvider", user.getActiveProvider());
        settings.put("n8nWebhookUrl", user.getN8nWebhookUrl());
        settings.put("ollamaServerUrl", user.getOllamaServerUrl());
        settings.put("ollamaModel", user.getOllamaModel());
        try {
            settings.put("customAiSkills", user.getCustomAiSkills() != null ? mapper.readTree(user.getCustomAiSkills()) : mapper.createArrayNode());
        } catch (Exception ex) { settings.put("customAiSkills", Collections.emptyList()); }
        try {
            settings.put("customAiModels", user.getCustomAiModels() != null ? mapper.readTree(user.getCustomAiModels()) : mapper.createArrayNode());
        } catch (Exception ex) { settings.put("customAiModels", Collections.emptyList()); }
        try {
            settings.put("customOllamaModels", user.getCustomOllamaModels() != null ? mapper.readTree(user.getCustomOllamaModels()) : mapper.createArrayNode());
        } catch (Exception ex) { settings.put("customOllamaModels", Collections.emptyList()); }
        try {
            settings.put("savedLeads", user.getSavedLeads() != null ? mapper.readTree(user.getSavedLeads()) : mapper.createArrayNode());
        } catch (Exception ex) { settings.put("savedLeads", Collections.emptyList()); }
        try {
            settings.put("filterPresets", user.getFilterPresets() != null ? mapper.readTree(user.getFilterPresets()) : mapper.createArrayNode());
        } catch (Exception ex) { settings.put("filterPresets", Collections.emptyList()); }

        return ResponseEntity.ok(Map.of("settings", settings));
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(@AuthenticationPrincipal String userId, @RequestBody Map<String, Object> settings) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        ObjectMapper mapper = new ObjectMapper();

        if (settings.containsKey("name")) user.setName((String) settings.get("name"));
        if (settings.containsKey("geminiApiKey")) user.setGeminiApiKey((String) settings.get("geminiApiKey"));
        if (settings.containsKey("openaiApiKey")) user.setOpenaiApiKey((String) settings.get("openaiApiKey"));
        if (settings.containsKey("aiProxyUrl")) user.setAiProxyUrl((String) settings.get("aiProxyUrl"));
        if (settings.containsKey("ngrokAuthToken")) user.setNgrokAuthToken((String) settings.get("ngrokAuthToken"));
        if (settings.containsKey("activeProvider")) user.setActiveProvider((String) settings.get("activeProvider"));
        if (settings.containsKey("n8nWebhookUrl")) user.setN8nWebhookUrl((String) settings.get("n8nWebhookUrl"));
        if (settings.containsKey("ollamaServerUrl")) user.setOllamaServerUrl((String) settings.get("ollamaServerUrl"));
        if (settings.containsKey("ollamaModel")) user.setOllamaModel((String) settings.get("ollamaModel"));

        if (settings.containsKey("customAiSkills")) {
            Object val = settings.get("customAiSkills");
            if (val instanceof String) {
                user.setCustomAiSkills((String) val);
            } else {
                try { user.setCustomAiSkills(mapper.writeValueAsString(val)); } catch (Exception ignored) {}
            }
        }
        if (settings.containsKey("customAiModels")) {
            Object val = settings.get("customAiModels");
            if (val instanceof String) {
                user.setCustomAiModels((String) val);
            } else {
                try { user.setCustomAiModels(mapper.writeValueAsString(val)); } catch (Exception ignored) {}
            }
        }
        if (settings.containsKey("customOllamaModels")) {
            Object val = settings.get("customOllamaModels");
            if (val instanceof String) {
                user.setCustomOllamaModels((String) val);
            } else {
                try { user.setCustomOllamaModels(mapper.writeValueAsString(val)); } catch (Exception ignored) {}
            }
        }
        if (settings.containsKey("savedLeads")) {
            Object val = settings.get("savedLeads");
            if (val instanceof String) {
                user.setSavedLeads((String) val);
            } else {
                try { user.setSavedLeads(mapper.writeValueAsString(val)); } catch (Exception ignored) {}
            }
        }
        if (settings.containsKey("filterPresets")) {
            Object val = settings.get("filterPresets");
            if (val instanceof String) {
                user.setFilterPresets((String) val);
            } else {
                try { user.setFilterPresets(mapper.writeValueAsString(val)); } catch (Exception ignored) {}
            }
        }

        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Configurações atualizadas com sucesso"));
    }

    @GetMapping("/time")
    public ResponseEntity<?> getTime() {
        return ResponseEntity.ok(Map.of(
            "time", java.time.Instant.now().toString(),
            "timezone", java.util.TimeZone.getDefault().getID()
        ));
    }
}
