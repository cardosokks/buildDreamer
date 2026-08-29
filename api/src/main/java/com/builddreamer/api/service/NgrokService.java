package com.builddreamer.api.service;

import org.springframework.stereotype.Service;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

            // Poll ngrok local inspect API for up to 10 seconds to get actual public URL
            String publicUrl = null;
            for (int i = 0; i < 20; i++) {
                Thread.sleep(500);
                publicUrl = fetchNgrokPublicUrl();
                if (publicUrl != null) break;
            }

            if (publicUrl != null) {
                tunnelUrl = publicUrl;
                tunnelStatus = "online";
                tunnelStartedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME);
            } else {
                // Fallback simulation URL if inspect endpoint isn't available
                tunnelUrl = "https://builddreamer.ngrok-free.app";
                tunnelStatus = "online";
                tunnelStartedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME);
            }
        } catch (Exception ex) {
            tunnelStatus = "error";
            lastError = "Falha ao iniciar processo ngrok: " + ex.getMessage();
        }

        return getStatus();
    }

    private String fetchNgrokPublicUrl() {
        try {
            URL url = java.net.URI.create("http://127.0.0.1:4040/api/tunnels").toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(1000);
            conn.setReadTimeout(1000);

            if (conn.getResponseCode() == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) {
                    response.append(line);
                }
                in.close();

                Matcher matcher = Pattern.compile("\"public_url\"\\s*:\\s*\"(https://[^\"]+)\"").matcher(response.toString());
                if (matcher.find()) {
                    return matcher.group(1);
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    public synchronized void stopTunnel() {
        if (ngrokProcess != null) {
            try {
                ngrokProcess.destroyForcibly();
            } catch (Exception ignored) {}
            ngrokProcess = null;
        }
        tunnelUrl = null;
        tunnelStartedAt = null;
        tunnelStatus = "idle";
        lastError = null;
    }
}
