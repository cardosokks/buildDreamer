package com.builddreamer.api.repository;

import com.builddreamer.api.model.LeadPreset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LeadPresetRepository extends JpaRepository<LeadPreset, String> {
    List<LeadPreset> findByUserIdOrderByCreatedAtDesc(String userId);
    Optional<LeadPreset> findByIdAndUserId(String id, String userId);
}
