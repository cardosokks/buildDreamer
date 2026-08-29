package com.builddreamer.api.repository;

import com.builddreamer.api.model.Lead;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LeadRepository extends JpaRepository<Lead, String> {
    @Query("SELECT l FROM Lead l LEFT JOIN FETCH l.project WHERE l.user.id = :userId")
    List<Lead> findByUserId(@Param("userId") String userId);

    @Query("SELECT l FROM Lead l LEFT JOIN FETCH l.project WHERE l.user.id = :userId AND l.id = :id")
    Optional<Lead> findByUserIdAndId(@Param("userId") String userId, @Param("id") String id);

    void deleteByUserIdAndId(String userId, String id);
}
