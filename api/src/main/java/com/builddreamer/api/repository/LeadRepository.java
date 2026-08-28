package com.builddreamer.api.repository;

import com.builddreamer.api.model.Lead;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LeadRepository extends JpaRepository<Lead, String> {
    List<Lead> findByUserId(String userId);
    Optional<Lead> findByUserIdAndId(String userId, String id);
    void deleteByUserIdAndId(String userId, String id);
}
