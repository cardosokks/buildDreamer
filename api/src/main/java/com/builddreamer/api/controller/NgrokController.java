package com.builddreamer.api.controller;

import com.builddreamer.api.model.User;
import com.builddreamer.api.repository.UserRepository;
import com.builddreamer.api.service.NgrokService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/ngrok")
public class NgrokController {

    private final NgrokService ngrokService;
    private final UserRepository userRepository;

    public NgrokController(NgrokService ngrokService, UserRepository userRepository) {
        this.ngrokService = ngrokService;
        this.userRepository = userRepository;
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        return ResponseEntity.ok(ngrokService.getStatus());
    }

    @PostMapping("/start")
    public ResponseEntity<?> startTunnel(
            @AuthenticationPrincipal String userId,
            @RequestHeader(name = "x-ngrok-token", required = false) String headerToken,
            @RequestBody(required = false) Map<String, Object> body) {
        String token = headerToken;
        String target = null;
        if (body != null) {
            if (token == null || token.trim().isEmpty()) {
                token = (String) body.get("authtoken");
            }
            if (token == null || token.trim().isEmpty()) {
                token = (String) body.get("token");
            }
            target = (String) body.get("target");
        }

        if ((token == null || token.trim().isEmpty()) && userId != null) {
            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isPresent() && userOpt.get().getNgrokAuthToken() != null) {
                token = userOpt.get().getNgrokAuthToken().trim();
            }
        }

        Map<String, Object> status = ngrokService.startTunnel(token, target);
        return ResponseEntity.ok(status);
    }

    @PostMapping("/stop")
    public ResponseEntity<?> stopTunnel() {
        ngrokService.stopTunnel();
        return ResponseEntity.ok(Map.of("success", true, "message", "Ngrok tunnel stopped"));
    }
}
