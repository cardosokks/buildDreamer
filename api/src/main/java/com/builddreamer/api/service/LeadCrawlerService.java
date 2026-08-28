package com.builddreamer.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LeadCrawlerService {

    private static final String[] USER_AGENTS = {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0"
    };

    private static final Pattern PHONE_REGEX = Pattern.compile("(?:\\+?55\\s?)?(?:\\(?([1-9]{2})\\)?\\s?)(?:(9\\s?\\d{4})[-\\s]?(\\d{4})|(\\d{4})[-\\s]?(\\d{4}))");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private String getRandomUserAgent() {
        return USER_AGENTS[new Random().nextInt(USER_AGENTS.length)];
    }

    public List<Map<String, Object>> searchLeads(String queryStr, String city, String state, int page) {
        List<Map<String, Object>> leads = new ArrayList<>();
        try {
            // Google Maps Scraper
            String searchQuery = queryStr + " em " + city + " " + (state != null ? state : "");
            String encodedQuery = URLEncoder.encode(searchQuery, StandardCharsets.UTF_8);
            String url = "https://www.google.com/search?tbm=map&authuser=0&hl=pt-BR&gl=br&q=" + encodedQuery 
                       + "&pb=!1s" + encodedQuery + "!7i30!10b1!12m3!1m2!1y12000!2y12000!2m1!1i0!4m1!1i30";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("User-Agent", getRandomUserAgent())
                    .header("Accept", "*/*")
                    .header("Accept-Language", "pt-BR,pt;q=0.9")
                    .header("Referer", "https://www.google.com/maps/")
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                String text = response.body().replaceFirst("^\\)\\]\\}'", "").trim();
                JsonNode root = objectMapper.readTree(text);
                JsonNode places = root.get(0).get(1);

                if (places != null && places.isArray()) {
                    for (int i = 0; i < places.size(); i++) {
                        JsonNode p = places.get(i);
                        if (p == null || p.get(14) == null) continue;
                        JsonNode info = p.get(14);
                        
                        String rawName = info.get(11) != null ? info.get(11).asText() : null;
                        if (rawName == null) continue;

                        String name = rawName.replaceAll("<[^>]+>", "").trim();
                        String category = info.get(13) != null && info.get(13).get(0) != null ? info.get(13).get(0).asText() : queryStr;
                        String address = info.get(39) != null ? info.get(39).asText() : (info.get(2) != null ? info.get(2).toString() : city);
                        
                        String rawPhone = info.get(178) != null && info.get(178).get(0) != null ? info.get(178).get(0).asText() : "Não informado";
                        if (info.get(3) != null && "Não informado".equals(rawPhone)) {
                            rawPhone = info.get(3).asText();
                        }
                        String phone = extractPhone(rawPhone);

                        double rating = info.get(4) != null && info.get(4).get(7) != null ? info.get(4).get(7).asDouble() : 4.5;
                        
                        String website = null;
                        if (info.get(7) != null && info.get(7).get(0) != null) {
                            String rawWeb = info.get(7).get(0).asText();
                            if (rawWeb != null && !rawWeb.toLowerCase().contains("instagram.com") 
                                && !rawWeb.toLowerCase().contains("facebook.com")) {
                                website = rawWeb;
                            }
                        }

                        Map<String, Object> lead = new HashMap<>();
                        lead.put("id", "gmaps-p" + page + "-" + System.currentTimeMillis() + "-" + i);
                        lead.put("name", name);
                        lead.put("company", name);
                        lead.put("phone", phone);
                        lead.put("email", null);
                        lead.put("website", website);
                        lead.put("address", address);
                        lead.put("rating", String.format(Locale.US, "%.1f", rating));
                        lead.put("status", "PROSPECT");
                        lead.put("origin", "CRAWLER");
                        lead.put("whatsappUrl", formatWhatsAppLink(phone));

                        leads.add(lead);
                    }
                }
            }

            // If empty, fetch from OpenStreetMap Nominatim API as a fallback
            if (leads.isEmpty()) {
                String osmUrl = "https://nominatim.openstreetmap.org/search?format=json&q=" 
                                + URLEncoder.encode(queryStr + " " + city, StandardCharsets.UTF_8);

                HttpRequest osmRequest = HttpRequest.newBuilder()
                        .uri(URI.create(osmUrl))
                        .header("User-Agent", getRandomUserAgent())
                        .timeout(Duration.ofSeconds(8))
                        .GET()
                        .build();

                HttpResponse<String> osmResponse = httpClient.send(osmRequest, HttpResponse.BodyHandlers.ofString());
                if (osmResponse.statusCode() == 200) {
                    JsonNode array = objectMapper.readTree(osmResponse.body());
                    if (array.isArray()) {
                        for (int i = 0; i < Math.min(array.size(), 10); i++) {
                            JsonNode node = array.get(i);
                            String displayName = node.get("display_name").asText();
                            String type = node.get("type").asText();
                            
                            Map<String, Object> lead = new HashMap<>();
                            lead.put("id", "osm-" + System.currentTimeMillis() + "-" + i);
                            lead.put("name", displayName.split(",")[0]);
                            lead.put("company", displayName.split(",")[0]);
                            lead.put("phone", "Não informado");
                            lead.put("email", null);
                            lead.put("website", null);
                            lead.put("address", displayName);
                            lead.put("rating", "4.0");
                            lead.put("status", "PROSPECT");
                            lead.put("origin", "CRAWLER");
                            lead.put("whatsappUrl", null);

                            leads.add(lead);
                        }
                    }
                }
            }
        } catch (Exception ex) {
            // Ignore error and return current list
        }
        return leads;
    }

    private String extractPhone(String val) {
        if (val == null) return "Não informado";
        Matcher matcher = PHONE_REGEX.matcher(val);
        if (matcher.find()) {
            return matcher.group(0).trim();
        }
        return val.trim();
    }

    private String formatWhatsAppLink(String phone) {
        if (phone == null || "Não informado".equals(phone)) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() == 10 || digits.length() == 11) {
            return "https://wa.me/55" + digits;
        }
        if (digits.length() == 12 || digits.length() == 13) {
            return "https://wa.me/" + digits;
        }
        return null;
    }
}
