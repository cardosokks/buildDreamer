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
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(20))
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

    private String sanitizeModelName(String rawModel) {
        if (rawModel == null || rawModel.trim().isEmpty()) return "gemini-3.6-flash";
        String m = rawModel.trim();
        if ("gemini-2.5-flash".equalsIgnoreCase(m) || "gemini-2.0-flash-exp".equalsIgnoreCase(m)) return "gemini-3.6-flash";
        if ("gemini-2.5-pro".equalsIgnoreCase(m) || "gemini-1.0-pro".equalsIgnoreCase(m)) return "gemini-3.1-pro-preview";
        return m;
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

        List<String> rawList = new ArrayList<>();
        if (customModel != null && !customModel.trim().isEmpty()) {
            rawList.add(customModel.trim());
        }
        if (registeredModels != null && !registeredModels.isEmpty()) {
            rawList.addAll(registeredModels);
        }
        rawList.addAll(Arrays.asList("gemini-3.6-flash", "gemini-3.1-pro-preview", "gemini-1.5-flash", "gemini-1.5-pro"));

        List<String> candidateModels = new ArrayList<>();
        for (String m : rawList) {
            String sanitized = sanitizeModelName(m);
            if (!candidateModels.contains(sanitized)) {
                candidateModels.add(sanitized);
            }
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

        String n8nWebhookUrl = System.getenv("N8N_WEBHOOK_URL");
        if (n8nWebhookUrl == null || n8nWebhookUrl.trim().isEmpty()) {
            n8nWebhookUrl = "http://n8n.192.168.18.39.nip.io/webhook/real-premise-agent";
        }

        String safeUserPrompt = (userPrompt != null && !userPrompt.trim().isEmpty()) ? userPrompt : "Gere o site solicitado";
        String safeSystemPrompt = (systemPrompt != null && !systemPrompt.trim().isEmpty()) ? systemPrompt : "Você é um mestre em desenvolvimento web HTML CSS e JS.";

        // FASE 1: Tentar a requisição no n8n percorrendo CADA modelo em sequência se houver erro
        System.out.println("[AI Engine] Iniciando tentativas via n8n com a fila de modelos: " + candidateModels);
        for (int i = 0; i < candidateModels.size(); i++) {
            String modelToTry = candidateModels.get(i);

            if (progressCallback != null) {
                try {
                    progressCallback.onProgress(modelToTry, i + 1, candidateModels.size());
                } catch (Exception ignored) {}
            }

            try {
                System.out.println("[AI Engine] n8n (" + (i + 1) + "/" + candidateModels.size() + ") - Testando modelo: " + modelToTry);

                Map<String, Object> n8nPayload = new HashMap<>();
                n8nPayload.put("userPrompt", safeUserPrompt);
                n8nPayload.put("systemPrompt", safeSystemPrompt);
                n8nPayload.put("prompt", safeUserPrompt);
                n8nPayload.put("chatInput", safeUserPrompt);
                n8nPayload.put("input", safeUserPrompt);
                n8nPayload.put("model", modelToTry);
                n8nPayload.put("apiKey", activeKey);

                String requestBody = objectMapper.writeValueAsString(n8nPayload);

                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(n8nWebhookUrl))
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(300))
                        .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() == 200) {
                    String respBody = response.body();

                    boolean hasErrorPhrase = respBody == null ||
                            respBody.contains("\"error\"") ||
                            respBody.contains("INVALID_ARGUMENT") ||
                            respBody.contains("no longer available") ||
                            respBody.contains("Bad request") ||
                            respBody.contains("not found") ||
                            respBody.contains("API key not valid");

                    if (hasErrorPhrase) {
                        System.err.println("[AI Engine] n8n respondeu erro no modelo " + modelToTry + ": " + respBody);
                        throw new RuntimeException("Erro retornado pelo n8n no modelo " + modelToTry + ": " + respBody);
                    }

                    String rawText = respBody;
                    try {
                        JsonNode rootNode = objectMapper.readTree(respBody);
                        if (rootNode.has("error")) {
                            throw new RuntimeException("Erro no JSON do n8n: " + rootNode.get("error").toString());
                        }
                        if (rootNode.has("response")) {
                            rawText = rootNode.get("response").asText();
                        } else if (rootNode.has("output")) {
                            rawText = rootNode.get("output").asText();
                        } else if (rootNode.has("text")) {
                            rawText = rootNode.get("text").asText();
                        } else if (rootNode.has("candidates") && rootNode.path("candidates").isArray() && rootNode.path("candidates").size() > 0) {
                            rawText = rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText(respBody);
                        } else if (rootNode.isArray() && rootNode.size() > 0) {
                            JsonNode firstItem = rootNode.get(0);
                            if (firstItem.has("error")) {
                                throw new RuntimeException("Item 0 do n8n contém erro: " + firstItem.get("error").toString());
                            }
                            if (firstItem.has("output")) rawText = firstItem.get("output").asText();
                            else if (firstItem.has("response")) rawText = firstItem.get("response").asText();
                            else if (firstItem.has("text")) rawText = firstItem.get("text").asText();
                        }
                    } catch (Exception parseEx) {
                        if (parseEx.getMessage() != null && parseEx.getMessage().contains("Erro")) {
                            throw parseEx;
                        }
                    }

                    Map<String, Object> parsed = resilientJsonParse(rawText);
                    String html = (String) parsed.get("html");
                    if (html == null || html.trim().isEmpty()) {
                        System.err.println("[AI Engine] Modelo " + modelToTry + " via n8n não gerou HTML. Tentando próximo modelo...");
                        throw new RuntimeException("n8n não retornou estrutura HTML válida para o modelo " + modelToTry);
                    }

                    parsed.put("_usedModel", modelToTry + " (via n8n real-premise-agent)");
                    System.out.println("[AI Engine] Sucesso total na geração via n8n com o modelo: " + modelToTry);
                    return parsed;
                } else {
                    System.err.println("[AI Engine] n8n retornou erro HTTP " + response.statusCode() + " para o modelo " + modelToTry + ". Tentando próximo modelo...");
                }
            } catch (Exception n8nEx) {
                System.err.println("[AI Engine] Falha no n8n para modelo " + modelToTry + ": " + n8nEx.getMessage() + ". Mudando para o próximo modelo...");
            }
        }

        // FASE 2: Se todos os modelos cadastrados falharam no n8n, tentar endpoint direto do Gemini como fallback
        System.err.println("[AI Engine] Todos os modelos cadastrados falharam via n8n. Recorrendo ao endpoint direto do Gemini...");
        Exception lastError = null;
        for (int i = 0; i < candidateModels.size(); i++) {
            String modelToTry = candidateModels.get(i);
            try {
                System.out.println("[AI Engine] Direct Gemini Fallback - Testando modelo: " + modelToTry);
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
                if (directResponse.statusCode() == 200) {
                    JsonNode rootNode = objectMapper.readTree(directResponse.body());
                    String rawText = rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText("{}");
                    Map<String, Object> parsed = resilientJsonParse(rawText);
                    parsed.put("_usedModel", modelToTry + " (direto)");
                    return parsed;
                } else {
                    System.err.println("[AI Engine] Endpoint direto retornou erro HTTP " + directResponse.statusCode() + ": " + directResponse.body());
                }
            } catch (Exception error) {
                System.err.println("[AI Engine] Fallback direto para " + modelToTry + " falhou: " + error.getMessage());
                lastError = error;
            }
        }

        throw new RuntimeException("Erro na geração com IA em todos os modelos cadastrados no n8n: " + (lastError != null ? lastError.getMessage() : "Sem resposta dos modelos"));
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
