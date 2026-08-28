package com.builddreamer.api.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Service
public class GeminiService {

    @Value("${GEMINI_API_KEY:}")
    private String defaultApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(120))
            .build();

    @FunctionalInterface
    public interface ProgressCallback {
        void onProgress(String model, int attempt, int total);
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> generateAIResponse(
            String prompt,
            Map<String, String> context,
            String customApiKey,
            String customModel,
            List<String> registeredModels
    ) throws Exception {
        return generateAIResponse(prompt, context, customApiKey, customModel, registeredModels, null);
    }

    public Map<String, Object> generateAIResponse(
            String prompt,
            Map<String, String> context,
            String customApiKey,
            String customModel,
            List<String> registeredModels,
            ProgressCallback progressCallback
    ) throws Exception {
        String activeKey = (customApiKey != null && !customApiKey.trim().isEmpty()) ? customApiKey : defaultApiKey;
        if (activeKey == null || activeKey.trim().isEmpty()) {
            activeKey = System.getenv("GEMINI_API_KEY");
        }
        if (activeKey == null || activeKey.trim().isEmpty()) {
            throw new IllegalArgumentException("Chave da API do Gemini não fornecida.");
        }

        List<String> candidateModels = new ArrayList<>();
        if (registeredModels != null && !registeredModels.isEmpty()) {
            candidateModels.addAll(registeredModels);
            if (customModel != null && !candidateModels.contains(customModel)) {
                candidateModels.add(0, customModel);
            }
        } else if (customModel != null) {
            candidateModels.add(customModel);
        } else {
            candidateModels.addAll(Arrays.asList("gemini-3.6-flash", "gemini-3.1-pro-preview"));
        }

        String systemPrompt = "Você é um Arquiteto de Software Frontend de Elite e Designer Visual Sênior.\n" +
                "Retorne SEMPRE um objeto JSON estrito no formato abaixo:\n" +
                "{\n" +
                "  \"explanation\": \"Breve resumo técnico das alterações.\",\n" +
                "  \"html\": \"<apenas nós HTML com Tailwind>\",\n" +
                "  \"css\": \"/* CSS customizado */\",\n" +
                "  \"js\": \"// JS funcional\"\n" +
                "}\n" +
                "OTIMIZAÇÃO DE TOKENS E COMPACTAÇÃO: Escreva código HTML/CSS extremamente conciso, limpo e enxuto. Limite o HTML a no máximo 120-150 linhas. Evite seções repetitivas longas ou SVGs complexos para não estourar os tokens.";

        String htmlContext = context.getOrDefault("html", "<div></div>");
        String cssContext = context.getOrDefault("css", "");
        String jsContext = context.getOrDefault("js", "");

        String userPrompt = String.format(
                "CONTEXTO DA PÁGINA ATUAL:\n" +
                "--- INÍCIO HTML ---\n%s\n--- FIM HTML ---\n\n" +
                "--- INÍCIO CSS ---\n%s\n--- FIM CSS ---\n\n" +
                "--- INÍCIO JS ---\n%s\n--- FIM JS ---\n\n" +
                "REQUISITO DE ALTERAÇÃO: %s",
                htmlContext, cssContext, jsContext, prompt
        );

        Exception lastError = null;
        int modelRetries = 0;
        String lastModelTried = "";

        for (int i = 0; i < candidateModels.size(); i++) {
            String modelToTry = candidateModels.get(i);
            if (!modelToTry.equals(lastModelTried)) {
                modelRetries = 0;
                lastModelTried = modelToTry;
            }

            if (progressCallback != null) {
                try {
                    progressCallback.onProgress(modelToTry, i + 1, candidateModels.size());
                } catch (Exception ignored) {}
            }

            try {
                System.out.println("[AI Engine] Tentando gerar via n8n real-premise-agent com o modelo: " + modelToTry);
                
                try {
                    String n8nWebhookUrl = System.getenv("N8N_WEBHOOK_URL");
                    if (n8nWebhookUrl == null || n8nWebhookUrl.trim().isEmpty()) {
                        n8nWebhookUrl = "http://n8n.192.168.18.39.nip.io/webhook/real-premise-agent";
                    }

                    Map<String, Object> n8nPayload = new HashMap<>();
                    n8nPayload.put("userPrompt", userPrompt);
                    n8nPayload.put("systemPrompt", systemPrompt);
                    n8nPayload.put("model", modelToTry);
                    n8nPayload.put("apiKey", activeKey);

                    String requestBody = objectMapper.writeValueAsString(n8nPayload);

                    HttpRequest request = HttpRequest.newBuilder()
                            .uri(URI.create(n8nWebhookUrl))
                            .header("Content-Type", "application/json")
                            .timeout(Duration.ofSeconds(30))
                            .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                            .build();

                    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                    
                    if (response.statusCode() == 200) {
                        JsonNode rootNode = objectMapper.readTree(response.body());
                        String rawText = rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText("{}");
                        Map<String, Object> parsed = resilientJsonParse(rawText);
                        parsed.put("_usedModel", modelToTry + " (via n8n real-premise-agent)");
                        return parsed;
                    }
                } catch (Exception n8nEx) {
                    System.err.println("[AI Engine] Falha/timeout no n8n real-premise-agent: " + n8nEx.getMessage() + ". Recorrendo ao endpoint direto do Gemini...");
                }

                // Fallback to direct Gemini API
                System.out.println("[AI Engine] Utilizando endpoint direto do Gemini para o modelo: " + modelToTry);
                Map<String, Object> payload = new HashMap<>();
                Map<String, Object> systemInstruction = new HashMap<>();
                Map<String, Object> partsObj = new HashMap<>();
                partsObj.put("text", systemPrompt);
                systemInstruction.put("parts", Collections.singletonList(partsObj));
                payload.put("systemInstruction", systemInstruction);

                Map<String, Object> contents = new HashMap<>();
                contents.put("role", "user");
                Map<String, Object> userParts = new HashMap<>();
                userParts.put("text", userPrompt);
                contents.put("parts", Collections.singletonList(userParts));
                payload.put("contents", Collections.singletonList(contents));

                Map<String, Object> generationConfig = new HashMap<>();
                generationConfig.put("responseMimeType", "application/json");
                generationConfig.put("temperature", 0.35);
                generationConfig.put("maxOutputTokens", 8192);
                payload.put("generationConfig", generationConfig);

                String directRequestBody = objectMapper.writeValueAsString(payload);
                String apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + modelToTry + ":generateContent?key=" + activeKey;

                HttpRequest directRequest = HttpRequest.newBuilder()
                        .uri(URI.create(apiUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(120))
                        .POST(HttpRequest.BodyPublishers.ofString(directRequestBody, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> directResponse = httpClient.send(directRequest, HttpResponse.BodyHandlers.ofString());
                
                if (directResponse.statusCode() != 200) {
                    throw new RuntimeException("HTTP " + directResponse.statusCode() + ": " + directResponse.body());
                }

                JsonNode rootNode = objectMapper.readTree(directResponse.body());
                String rawText = rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText("{}");
                
                Map<String, Object> parsed = resilientJsonParse(rawText);
                parsed.put("_usedModel", modelToTry);
                return parsed;

            } catch (Exception error) {
                System.err.println("[AI Engine] Tentativa com o modelo " + modelToTry + " falhou: " + error.getMessage());
                lastError = error;

                String errMsg = (error != null && error.getMessage() != null) ? error.getMessage() : "";
                boolean is429 = errMsg.contains("429");
                boolean is503 = errMsg.contains("503");
                if ((is429 || is503) && modelRetries < 3) {
                    modelRetries++;
                    long waitTime = is429 ? 45000 : 15000;
                    System.out.println("[AI Engine] Erro temporário (" + (is429 ? "429" : "503") + ") detectado. Aguardando " + (waitTime / 1000) + " segundos... (Tentativa " + modelRetries + "/3)");
                    Thread.sleep(waitTime);
                    i--; // Try same model again
                }
            }
        }

        throw new RuntimeException("Erro na API do Gemini em todos os modelos candidatos: " + (lastError != null ? lastError.getMessage() : "Desconhecido"));
    }

    private Map<String, Object> resilientJsonParse(String rawString) throws Exception {
        if (rawString == null || rawString.trim().isEmpty()) {
            return new HashMap<>();
        }
        String text = rawString.trim();
        if (text.startsWith("```")) {
            text = text.replaceAll("^```(?:json)?\\s*", "").replaceAll("```\\s*$", "").trim();
        }
        try {
            return objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {});
        } catch (Exception primaryEx) {
            try {
                String repaired = text;
                long openQuotes = repaired.chars().filter(ch -> ch == '"').count();
                if (openQuotes % 2 != 0) {
                    repaired = repaired + "\"";
                }
                if (!repaired.endsWith("}")) {
                    repaired = repaired + "}";
                }
                return objectMapper.readValue(repaired, new TypeReference<Map<String, Object>>() {});
            } catch (Exception repairEx) {
                Map<String, Object> fallback = new HashMap<>();
                fallback.put("explanation", extractRegexGroup(text, "\"explanation\"\\s*:\\s*\"([^\"]*)\""));
                fallback.put("html", extractRegexGroup(text, "\"html\"\\s*:\\s*\"([^\"]*)\""));
                fallback.put("css", extractRegexGroup(text, "\"css\"\\s*:\\s*\"([^\"]*)\""));
                fallback.put("js", extractRegexGroup(text, "\"js\"\\s*:\\s*\"([^\"]*)\""));
                
                String extractedHtml = (String) fallback.get("html");
                if (extractedHtml != null && !extractedHtml.trim().isEmpty()) {
                    return fallback;
                }
                
                // Se a IA retornou HTML bruto diretamente sem a estrutura JSON solicitada
                if (text.contains("<") && text.contains(">")) {
                    Map<String, Object> htmlFallback = new HashMap<>();
                    htmlFallback.put("html", text);
                    htmlFallback.put("css", "");
                    htmlFallback.put("js", "");
                    htmlFallback.put("explanation", "HTML retornado e processado diretamente.");
                    return htmlFallback;
                }
                
                System.err.println("[AI Engine] Erro ao analisar JSON da IA. String bruta: " + rawString);
                throw primaryEx;
            }
        }
    }

    private String extractRegexGroup(String text, String regex) {
        try {
            java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.DOTALL);
            java.util.regex.Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                return matcher.group(1).replace("\\n", "\n").replace("\\\"", "\"");
            }
        } catch (Exception ignored) {}
        return "";
    }
}
