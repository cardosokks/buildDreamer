package com.builddreamer.api.controller;

import com.builddreamer.api.model.Media;
import com.builddreamer.api.repository.MediaRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final MediaRepository mediaRepository;
    private final String uploadDir = "uploads";

    public MediaController(MediaRepository mediaRepository) {
        this.mediaRepository = mediaRepository;
        // Make sure uploads directory exists
        File dir = new File(uploadDir);
        if (!dir.exists()) {
            dir.mkdirs();
        }
    }

    @GetMapping
    public ResponseEntity<List<Media>> listMedia(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(mediaRepository.findByUserId(userId));
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String base64Data,
            @RequestParam(required = false) String filename,
            @RequestParam(required = false) MultipartFile file) {
        
        try {
            String name;
            byte[] fileBytes;
            String contentType;
            long size;

            if (file != null) {
                name = file.getOriginalFilename();
                fileBytes = file.getBytes();
                contentType = file.getContentType();
                size = file.getSize();
            } else if (base64Data != null && filename != null) {
                name = filename;
                String pureBase64 = base64Data;
                if (base64Data.contains(",")) {
                    pureBase64 = base64Data.split(",")[1];
                }
                fileBytes = Base64.getDecoder().decode(pureBase64);
                contentType = "image/png"; // Default to image
                size = fileBytes.length;
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "No file payload found"));
            }

            // Save to disk
            String fileId = UUID.randomUUID().toString();
            String savedFilename = fileId + "_" + name;
            Path filePath = Paths.get(uploadDir, savedFilename);
            Files.write(filePath, fileBytes);

            String url = "/uploads/" + savedFilename;

            Media media = Media.builder()
                    .id(fileId)
                    .name(name)
                    .url(url)
                    .size(size)
                    .mimeType(contentType)
                    .userId(userId)
                    .projectId(projectId)
                    .build();

            mediaRepository.save(media);
            return ResponseEntity.ok(media);

        } catch (IOException ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed uploading file: " + ex.getMessage()));
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
        } catch (IOException ignored) {}

        mediaRepository.delete(media);
        return ResponseEntity.ok(Map.of("message", "Media excluída com sucesso"));
    }
}
