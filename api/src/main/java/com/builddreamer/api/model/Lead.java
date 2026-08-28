package com.builddreamer.api.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "\"Lead\"")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
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

    private String notes;
    private String category;
    private String niche;
    private String rating;
    private double dealValue;
    private String tags;

    @Builder.Default
    @Column(nullable = false)
    private String status = "PROSPECT";

    @Builder.Default
    @Column(nullable = false)
    private String origin = "MANUAL";

    @Column(name = "whatsapp_url")
    private String whatsappUrl;

    @Column(name = "site_evaluation", columnDefinition = "text")
    private String siteEvaluation;

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

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
