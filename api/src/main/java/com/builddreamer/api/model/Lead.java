package com.builddreamer.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "\"Lead\"")
public class Lead {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String name;

    private String company;

    private String phone;

    private String email;

    private String website;

    private String address;

    private String rating;

    @Column(name = "deal_value", nullable = false)
    private double dealValue = 0.0;

    @Column(nullable = false)
    private String status = "PROSPECT";

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false)
    private String origin = "MANUAL";

    @Column(name = "tags", columnDefinition = "text")
    private String tags;

    @Column(name = "last_contact_date")
    private LocalDateTime lastContactDate;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Lead() {}

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
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getWebsite() { return website; }
    public void setWebsite(String website) { this.website = website; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getRating() { return rating; }
    public void setRating(String rating) { this.rating = rating; }
    public double getDealValue() { return dealValue; }
    public void setDealValue(double dealValue) { this.dealValue = dealValue; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public LocalDateTime getLastContactDate() { return lastContactDate; }
    public void setLastContactDate(LocalDateTime lastContactDate) { this.lastContactDate = lastContactDate; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static LeadBuilder builder() {
        return new LeadBuilder();
    }

    public static class LeadBuilder {
        private final Lead lead = new Lead();

        public LeadBuilder name(String name) { lead.setName(name); return this; }
        public LeadBuilder company(String company) { lead.setCompany(company); return this; }
        public LeadBuilder phone(String phone) { lead.setPhone(phone); return this; }
        public LeadBuilder email(String email) { lead.setEmail(email); return this; }
        public LeadBuilder website(String website) { lead.setWebsite(website); return this; }
        public LeadBuilder address(String address) { lead.setAddress(address); return this; }
        public LeadBuilder rating(String rating) { lead.setRating(rating); return this; }
        public LeadBuilder dealValue(double dealValue) { lead.setDealValue(dealValue); return this; }
        public LeadBuilder status(String status) { lead.setStatus(status); return this; }
        public LeadBuilder origin(String origin) { lead.setOrigin(origin); return this; }
        public LeadBuilder notes(String notes) { lead.setNotes(notes); return this; }
        public LeadBuilder tags(String tags) { lead.setTags(tags); return this; }
        public LeadBuilder user(User user) { lead.setUser(user); return this; }
        public LeadBuilder project(Project project) { lead.setProject(project); return this; }
        public Lead build() { return lead; }
    }
}
