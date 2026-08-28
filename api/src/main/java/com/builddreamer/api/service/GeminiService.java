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

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> generateAIResponse(
            String prompt,
            Map<String, String> context,
            String customApiKey,
            String customModel,
            List<String> registeredModels
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
            candidateModels.addAll(Arrays.asList("gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"));
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

            try {
                System.out.println("[AI Engine] Tentando gerar com o modelo: " + modelToTry);
                
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

                String requestBody = objectMapper.writeValueAsString(payload);
                String apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + modelToTry + ":generateContent?key=" + activeKey;

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(apiUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(120))
                        .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                
                if (response.statusCode() != 200) {
                    throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
                }

                JsonNode rootNode = objectMapper.readTree(response.body());
                String rawText = rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText("{}");
                
                Map<String, Object> parsed = resilientJsonParse(rawText);
                parsed.put("_usedModel", modelToTry);
                return parsed;

            } catch (Exception error) {
                System.err.println("[AI Engine] Tentativa com o modelo " + modelToTry + " falhou: " + error.getMessage());
                lastError = error;

                boolean is429 = error.getMessage().contains("429");
                boolean is503 = error.getMessage().contains("503");
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
        String text = rawString.trim();
        if (text.startsWith("```")) {
            text = text.replaceAll("^```(?:json)?\\s*", "").replaceAll("```\\s*$", "").trim();
        }
        try {
            return objectMapper.readValue(text, new TypeReference<Map<String, Object>>() {});
        } catch (Exception ex) {
            System.err.println("Resilient JSON parse failed. Raw string was: " + rawString);
            throw ex;
        }
    }
}
