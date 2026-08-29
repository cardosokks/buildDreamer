package com.builddreamer.api.repository;

import com.builddreamer.api.model.LeadPreset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LeadPresetRepository extends JpaRepository<LeadPreset, String> {
    @Query("SELECT p FROM LeadPreset p WHERE p.user IS NOT NULL AND p.user.id = :userId ORDER BY p.createdAt DESC")
    List<LeadPreset> findAllByUserId(@Param("userId") String userId);

    @Query("SELECT p FROM LeadPreset p WHERE p.id = :id AND p.user IS NOT NULL AND p.user.id = :userId")
    Optional<LeadPreset> findByIdAndUserIdCustom(@Param("id") String id, @Param("userId") String userId);
}
