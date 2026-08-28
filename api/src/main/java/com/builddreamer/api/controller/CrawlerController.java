package com.builddreamer.api.controller;

import com.builddreamer.api.service.LeadCrawlerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/crawler")
public class CrawlerController {

    private final LeadCrawlerService crawlerService;

    public CrawlerController(LeadCrawlerService crawlerService) {
        this.crawlerService = crawlerService;
    }

    /**
     * GET /api/crawler/search?query=&city=&state=&page= (legacy query-param support)
     */
    @GetMapping("/search")
    public ResponseEntity<?> searchLeadsGet(
            @RequestParam String query,
            @RequestParam String city,
            @RequestParam(required = false) String state,
            @RequestParam(defaultValue = "1") int page) {
        try {
            List<Map<String, Object>> leads = crawlerService.searchLeads(query, city, state, page);
            return ResponseEntity.ok(Map.of("leads", leads, "hasMore", !leads.isEmpty()));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }

    /**
     * POST /api/crawler/search — main endpoint used by Dashboard.tsx handleSearchLeads
     * Body: { niche, city, state, country, page, limit, onlyWithoutWebsite, hasPhoneOnly, minRating }
     */
    @PostMapping("/search")
    public ResponseEntity<?> searchLeadsPost(
            @AuthenticationPrincipal String userId,
            @RequestBody Map<String, Object> body) {
        try {
            String niche = (String) body.getOrDefault("niche", "");
            String city = (String) body.getOrDefault("city", "");
            String state = (String) body.getOrDefault("state", "");
            Number pageNum = (Number) body.getOrDefault("page", 1);
            Number limitNum = (Number) body.getOrDefault("limit", 40);
            boolean onlyWithoutWebsite = Boolean.TRUE.equals(body.get("onlyWithoutWebsite"));
            boolean hasPhoneOnly = Boolean.TRUE.equals(body.get("hasPhoneOnly"));
            Number minRatingNum = (Number) body.getOrDefault("minRating", 0);
            double minRating = minRatingNum.doubleValue();

            List<Map<String, Object>> leads = crawlerService.searchLeads(niche, city, state, pageNum.intValue());

            // Apply filters in memory
            List<Map<String, Object>> filtered = new ArrayList<>();
            for (Map<String, Object> lead : leads) {
                if (onlyWithoutWebsite) {
                    Object website = lead.get("website");
                    if (website != null && !website.toString().isEmpty()) continue;
                }
                if (hasPhoneOnly) {
                    Object phone = lead.get("phone");
                    if (phone == null || phone.toString().isEmpty()) continue;
                }
                if (minRating > 0) {
                    Object rating = lead.get("rating");
                    if (rating == null) continue;
                    try {
                        double r = Double.parseDouble(rating.toString());
                        if (r < minRating) continue;
                    } catch (NumberFormatException ignored) {}
                }
                filtered.add(lead);
            }

            int limit = limitNum.intValue();
            boolean hasMore = filtered.size() >= limit;
            List<Map<String, Object>> page = filtered.size() > limit ? filtered.subList(0, limit) : filtered;

            return ResponseEntity.ok(Map.of("leads", page, "hasMore", hasMore));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
