package com.builddreamer.api.repository;

import com.builddreamer.api.model.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, String> {
    Optional<ProjectMember> findByProjectIdAndUserId(String projectId, String userId);
    List<ProjectMember> findByProjectId(String projectId);
    void deleteByProjectIdAndUserId(String projectId, String userId);
}
