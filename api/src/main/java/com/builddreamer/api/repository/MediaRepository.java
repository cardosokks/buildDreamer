package com.builddreamer.api.repository;

import com.builddreamer.api.model.Media;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface MediaRepository extends JpaRepository<Media, String> {
    List<Media> findByProjectId(String projectId);
    List<Media> findByUserId(String userId);
    Optional<Media> findByUserIdAndId(String userId, String id);
    void deleteByUserIdAndId(String userId, String id);
}
