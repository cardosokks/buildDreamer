package com.builddreamer.api.repository;

import com.builddreamer.api.model.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AssetRepository extends JpaRepository<Asset, String> {
    List<Asset> findByProjectId(String projectId);
    void deleteByProjectIdAndId(String projectId, String id);
}
