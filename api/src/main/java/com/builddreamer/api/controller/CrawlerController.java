package com.builddreamer.api.controller;

import com.builddreamer.api.service.LeadCrawlerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/crawler")
public class CrawlerController {

    private final LeadCrawlerService crawlerService;

    public CrawlerController(LeadCrawlerService crawlerService) {
        this.crawlerService = crawlerService;
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchLeads(
            @RequestParam String query,
            @RequestParam String city,
            @RequestParam(required = false) String state,
            @RequestParam(defaultValue = "1") int page) {
        try {
            List<Map<String, Object>> leads = crawlerService.searchLeads(query, city, state, page);
            return ResponseEntity.ok(leads);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", ex.getMessage()));
        }
    }
}
