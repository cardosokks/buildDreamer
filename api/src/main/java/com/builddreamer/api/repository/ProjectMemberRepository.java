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
    @org.springframework.data.jpa.repository.Query("SELECT pm FROM ProjectMember pm JOIN FETCH pm.user WHERE pm.project.id = :projectId")
    List<ProjectMember> findByProjectIdWithUser(@org.springframework.data.repository.query.Param("projectId") String projectId);
    void deleteByProjectIdAndUserId(String projectId, String userId);
}
