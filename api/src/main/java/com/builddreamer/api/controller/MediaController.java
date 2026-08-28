package com.builddreamer.api.controller;

import com.builddreamer.api.model.Media;
import com.builddreamer.api.repository.MediaRepository;
import com.builddreamer.api.service.StorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final MediaRepository mediaRepository;
    private final StorageService storageService;
    private final String uploadDir = "uploads";

    public MediaController(MediaRepository mediaRepository, StorageService storageService) {
        this.mediaRepository = mediaRepository;
        this.storageService = storageService;
        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
    }

    @GetMapping
    public ResponseEntity<?> listMedia(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String projectId) {
        List<Media> list;
        if (projectId != null && !projectId.trim().isEmpty()) {
            list = mediaRepository.findByProjectId(projectId.trim());
        } else {
            list = mediaRepository.findByUserId(userId);
        }
        return ResponseEntity.ok(Map.of("media", list));
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String base64Data,
            @RequestParam(required = false) String filename,
            @RequestParam(required = false) MultipartFile file,
            @RequestBody(required = false) Map<String, Object> body) {
        
        try {
            String name = filename;
            byte[] fileBytes = null;
            String contentType = "image/png";
            long size = 0;
            String targetProjectId = projectId;

            if (body != null) {
                if (body.containsKey("name")) name = (String) body.get("name");
                if (body.containsKey("filename")) name = (String) body.get("filename");
                if (body.containsKey("projectId")) targetProjectId = (String) body.get("projectId");
                if (body.containsKey("mimeType")) contentType = (String) body.get("mimeType");
                if (body.containsKey("base64Data")) {
                    String b64 = (String) body.get("base64Data");
                    if (b64.contains(",")) {
                        b64 = b64.split(",")[1];
                    }
                    fileBytes = Base64.getDecoder().decode(b64);
                    size = fileBytes.length;
                }
            }

            if (fileBytes == null && file != null) {
                name = file.getOriginalFilename();
                fileBytes = file.getBytes();
                contentType = file.getContentType();
                size = file.getSize();
            } else if (fileBytes == null && base64Data != null) {
                String pureBase64 = base64Data;
                if (base64Data.contains(",")) {
                    pureBase64 = base64Data.split(",")[1];
                }
                fileBytes = Base64.getDecoder().decode(pureBase64);
                size = fileBytes.length;
            }

            if (fileBytes == null || name == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Payload de arquivo inválido ou ausente"));
            }

            // 1. Save to local disk
            String fileId = UUID.randomUUID().toString();
            String savedFilename = fileId + "_" + name;
            Path filePath = Paths.get(uploadDir, savedFilename);
            Files.write(filePath, fileBytes);

            // 2. Upload to MinIO S3 Storage
            try {
                storageService.uploadFile("media/" + savedFilename, fileBytes, contentType);
            } catch (Exception ignored) {}

            String url = "/uploads/" + savedFilename;

            Media media = Media.builder()
                    .id(fileId)
                    .name(name)
                    .url(url)
                    .size(size)
                    .mimeType(contentType)
                    .userId(userId)
                    .projectId(targetProjectId)
                    .build();

            mediaRepository.save(media);
            return ResponseEntity.ok(Map.of("media", media));

        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Falha ao enviar arquivo: " + ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMedia(@AuthenticationPrincipal String userId, @PathVariable String id) {
        Optional<Media> mediaOpt = mediaRepository.findByUserIdAndId(userId, id);
        if (mediaOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Media media = mediaOpt.get();
        try {
            // Delete file from disk
            String filename = media.getUrl().replace("/uploads/", "");
            Path filePath = Paths.get(uploadDir, filename);
            Files.deleteIfExists(filePath);
            
            // Delete from MinIO
            storageService.deleteObject("media/" + filename);
        } catch (Exception ignored) {}

        mediaRepository.delete(media);
        return ResponseEntity.ok(Map.of("message", "Media excluída com sucesso"));
    }
}
