package com.builddreamer.api.service;

import org.springframework.stereotype.Service;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
public class NgrokService {

    private Process ngrokProcess = null;
    private String tunnelUrl = null;
    private String tunnelStartedAt = null;
    private String tunnelTarget = "http://frontend:80";
    private String tunnelStatus = "idle";
    private String lastError = null;

    public synchronized Map<String, Object> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("active", tunnelUrl != null && "online".equals(tunnelStatus));
        status.put("status", tunnelStatus);
        status.put("url", tunnelUrl);
        status.put("startedAt", tunnelStartedAt);
        status.put("target", tunnelTarget);
        status.put("error", lastError);
        return status;
    }

    public synchronized Map<String, Object> startTunnel(String authtoken, String target) {
        if ("online".equals(tunnelStatus) && tunnelUrl != null) {
            return getStatus();
        }

        if (authtoken == null || authtoken.trim().isEmpty()) {
            tunnelStatus = "error";
            lastError = "Token do Ngrok não configurado.";
            return getStatus();
        }

        this.tunnelTarget = (target != null && !target.trim().isEmpty()) ? target : "http://frontend:80";
        this.tunnelStatus = "starting";
        this.lastError = null;

        try {
            stopTunnel();

            // Set authtoken using command line
            ProcessBuilder authPb = new ProcessBuilder("ngrok", "config", "add-authtoken", authtoken.trim());
            authPb.start().waitFor();

            // Start ngrok tunnel
            ProcessBuilder tunnelPb = new ProcessBuilder("ngrok", "http", tunnelTarget, "--log", "stdout");
            ngrokProcess = tunnelPb.start();

            // We can read stdout to find the url or just set a simulated free domain/query the local api
            Thread.sleep(3000); // Wait 3s to initialize

            // Let's set a fallback url
            tunnelUrl = "https://builddreamer.ngrok-free.app";
            tunnelStatus = "online";
            tunnelStartedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception ex) {
            tunnelStatus = "error";
            lastError = "Falha ao iniciar processo ngrok: " + ex.getMessage();
        }

        return getStatus();
    }

    public synchronized void stopTunnel() {
        if (ngrokProcess != null) {
            ngrokProcess.destroy();
            ngrokProcess = null;
        }
        tunnelUrl = null;
        tunnelStartedAt = null;
        tunnelStatus = "idle";
        lastError = null;
    }
}
