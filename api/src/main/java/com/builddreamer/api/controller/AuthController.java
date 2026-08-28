package com.builddreamer.api.controller;

import com.builddreamer.api.config.JwtTokenProvider;
import com.builddreamer.api.dto.AuthDto;
import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

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

    @PostMapping("/register")
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
        return ResponseEntity.ok(AuthDto.AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .build());
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthDto.LoginRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());
        if (userOpt.isEmpty() || !passwordEncoder.matches(request.getPassword(), userOpt.get().getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Credenciais inválidas"));
        }

        User user = userOpt.get();
        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        return ResponseEntity.ok(AuthDto.AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .name(user.getName())
                .build());
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(@AuthenticationPrincipal String userId) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("email", user.getEmail());
        response.put("name", user.getName());
        response.put("geminiApiKey", user.getGeminiApiKey());
        response.put("openaiApiKey", user.getOpenaiApiKey());
        response.put("aiProxyUrl", user.getAiProxyUrl());
        response.put("ngrokAuthToken", user.getNgrokAuthToken());
        response.put("customAiSkills", user.getCustomAiSkills());
        response.put("customAiModels", user.getCustomAiModels());
        response.put("savedLeads", user.getSavedLeads());
        response.put("filterPresets", user.getFilterPresets());

        return ResponseEntity.ok(response);
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSettings(@AuthenticationPrincipal String userId, @RequestBody Map<String, Object> settings) {
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        if (settings.containsKey("name")) user.setName((String) settings.get("name"));
        if (settings.containsKey("geminiApiKey")) user.setGeminiApiKey((String) settings.get("geminiApiKey"));
        if (settings.containsKey("openaiApiKey")) user.setOpenaiApiKey((String) settings.get("openaiApiKey"));
        if (settings.containsKey("aiProxyUrl")) user.setAiProxyUrl((String) settings.get("aiProxyUrl"));
        if (settings.containsKey("ngrokAuthToken")) user.setNgrokAuthToken((String) settings.get("ngrokAuthToken"));
        if (settings.containsKey("customAiSkills")) user.setCustomAiSkills((String) settings.get("customAiSkills"));
        if (settings.containsKey("customAiModels")) user.setCustomAiModels((String) settings.get("customAiModels"));
        if (settings.containsKey("savedLeads")) user.setSavedLeads((String) settings.get("savedLeads"));
        if (settings.containsKey("filterPresets")) user.setFilterPresets((String) settings.get("filterPresets"));

        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Configurações atualizadas com sucesso"));
    }
}
