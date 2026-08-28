package com.builddreamer.api.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "\"LeadPreset\"")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadPreset {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    private String niche;
    private String city;
    private String state;
    private String country;

    @Builder.Default
    @Column(name = "only_without_website", nullable = false)
    private boolean onlyWithoutWebsite = false;

    @Builder.Default
    @Column(name = "only_with_website", nullable = false)
    private boolean onlyWithWebsite = false;

    @Builder.Default
    @Column(name = "has_phone", nullable = false)
    private boolean hasPhone = false;

    @Builder.Default
    @Column(name = "has_phone_only", nullable = false)
    private boolean hasPhoneOnly = false;

    @Builder.Default
    @Column(name = "has_whatsapp", nullable = false)
    private boolean hasWhatsapp = false;

    @Builder.Default
    @Column(name = "has_whatsapp_only", nullable = false)
    private boolean hasWhatsappOnly = false;

    @Column(name = "user_id_str")
    private String userId;

    @Builder.Default
    @Column(name = "min_rating", nullable = false)
    private double minRating = 0.0;

    @Builder.Default
    @Column(name = "min_reviews", nullable = false)
    private int minReviews = 0;

    @Builder.Default
    @Column(name = "sort_by", nullable = false)
    private String sortBy = "rating";

    @com.fasterxml.jackson.annotation.JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = true)
    private User user;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
