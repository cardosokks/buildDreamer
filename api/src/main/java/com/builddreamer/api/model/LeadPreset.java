package com.builddreamer.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "\"LeadPreset\"")
public class LeadPreset {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String niche;

    @Column(nullable = false)
    private String city;

    private String state;
    private String country = "Brasil";

    @Column(name = "onlyWithoutWebsite", nullable = false)
    private boolean onlyWithoutWebsite = false;

    @Column(name = "onlyWithWebsite", nullable = false)
    private boolean onlyWithWebsite = false;

    @Column(name = "hasPhoneOnly", nullable = false)
    private boolean hasPhoneOnly = false;

    @Column(name = "hasWhatsappOnly", nullable = false)
    private boolean hasWhatsappOnly = false;

    @Column(name = "minRating", nullable = false)
    private double minRating = 0.0;

    @Column(name = "userId", nullable = false)
    private String userId;

    @Column(name = "createdAt", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updatedAt", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public LeadPreset() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getNiche() { return niche; }
    public void setNiche(String niche) { this.niche = niche; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public boolean isOnlyWithoutWebsite() { return onlyWithoutWebsite; }
    public void setOnlyWithoutWebsite(boolean onlyWithoutWebsite) { this.onlyWithoutWebsite = onlyWithoutWebsite; }
    public boolean isOnlyWithWebsite() { return onlyWithWebsite; }
    public void setOnlyWithWebsite(boolean onlyWithWebsite) { this.onlyWithWebsite = onlyWithWebsite; }
    public boolean isHasPhoneOnly() { return hasPhoneOnly; }
    public void setHasPhoneOnly(boolean hasPhoneOnly) { this.hasPhoneOnly = hasPhoneOnly; }
    public boolean isHasWhatsappOnly() { return hasWhatsappOnly; }
    public void setHasWhatsappOnly(boolean hasWhatsappOnly) { this.hasWhatsappOnly = hasWhatsappOnly; }
    public double getMinRating() { return minRating; }
    public void setMinRating(double minRating) { this.minRating = minRating; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
