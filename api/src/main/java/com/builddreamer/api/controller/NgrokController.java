package com.builddreamer.api.controller;

import com.builddreamer.api.service.NgrokService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/ngrok")
public class NgrokController {

    private final NgrokService ngrokService;

    public NgrokController(NgrokService ngrokService) {
        this.ngrokService = ngrokService;
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        return ResponseEntity.ok(ngrokService.getStatus());
    }

    @PostMapping("/start")
    public ResponseEntity<?> startTunnel(
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
        Map<String, Object> status = ngrokService.startTunnel(token, target);
        return ResponseEntity.ok(status);
    }

    @PostMapping("/stop")
    public ResponseEntity<?> stopTunnel() {
        ngrokService.stopTunnel();
        return ResponseEntity.ok(Map.of("success", true, "message", "Ngrok tunnel stopped"));
    }
}
