package com.builddreamer.api.repository;

import com.builddreamer.api.model.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PageRepository extends JpaRepository<Page, String> {
    List<Page> findByProjectId(String projectId);
    Optional<Page> findFirstByProjectIdAndSlug(String projectId, String slug);
    List<Page> findByProjectIdAndSlug(String projectId, String slug);
    Optional<Page> findByProjectIdAndId(String projectId, String id);
    boolean existsByProjectIdAndSlug(String projectId, String slug);
    void deleteByProjectIdAndId(String projectId, String id);
}
