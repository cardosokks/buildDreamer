package com.builddreamer.api.repository;

import com.builddreamer.api.model.Version;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface VersionRepository extends JpaRepository<Version, String> {
    List<Version> findByProjectId(String projectId);
    Optional<Version> findByProjectIdAndId(String projectId, String id);
}
