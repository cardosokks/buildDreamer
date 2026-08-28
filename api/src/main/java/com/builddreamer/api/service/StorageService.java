package com.builddreamer.api.service;

import io.minio.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Service
public class StorageService {

    private final MinioClient minioClient;
    private final String bucketName;
    private final String endpoint;

    public StorageService() {
        String ep = System.getenv("MINIO_ENDPOINT");
        if (ep == null || ep.trim().isEmpty()) {
            ep = "http://minio:9000";
        }
        this.endpoint = ep;

        String accessKey = System.getenv("MINIO_ACCESS_KEY");
        if (accessKey == null || accessKey.trim().isEmpty()) {
            accessKey = "admin";
        }

        String secretKey = System.getenv("MINIO_SECRET_KEY");
        if (secretKey == null || secretKey.trim().isEmpty()) {
            secretKey = "minioadmin123";
        }

        String bName = System.getenv("MINIO_BUCKET");
        if (bName == null || bName.trim().isEmpty()) {
            bName = "builddreamer";
        }
        this.bucketName = bName;

        MinioClient client = null;
        try {
            client = MinioClient.builder()
                    .endpoint(this.endpoint)
                    .credentials(accessKey, secretKey)
                    .build();

            boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(this.bucketName).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(this.bucketName).build());
                
                // Set public read access policy for the bucket so static website files & images can be loaded via HTTP
                String policy = "{\n" +
                        "  \"Version\": \"2012-10-17\",\n" +
                        "  \"Statement\": [\n" +
                        "    {\n" +
                        "      \"Effect\": \"Allow\",\n" +
                        "      \"Principal\": {\"AWS\": [\"*\"]},\n" +
                        "      \"Action\": [\"s3:GetObject\"],\n" +
                        "      \"Resource\": [\"arn:aws:s3:::" + this.bucketName + "/*\"]\n" +
                        "    }\n" +
                        "  ]\n" +
                        "}";
                client.setBucketPolicy(SetBucketPolicyArgs.builder().bucket(this.bucketName).config(policy).build());
            }
        } catch (Exception ex) {
            System.err.println("[MinIO Storage] Aviso ao inicializar MinioClient: " + ex.getMessage());
        }
        this.minioClient = client;
    }

    public void uploadFile(String objectName, byte[] content, String contentType) {
        if (minioClient == null) return;
        try (InputStream is = new ByteArrayInputStream(content)) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(is, content.length, -1)
                            .contentType(contentType != null ? contentType : "application/octet-stream")
                            .build()
            );
            System.out.println("[MinIO Storage] Arquivo enviado com sucesso: " + objectName);
        } catch (Exception ex) {
            System.err.println("[MinIO Storage] Erro ao enviar objeto " + objectName + ": " + ex.getMessage());
        }
    }

    @Async
    public void uploadSinglePage(
            String projectName,
            String pageSlug,
            String html,
            String css,
            String js,
            boolean isHomepage,
            String navbarHtml,
            String footerHtml
    ) {
        String safeName = projectName.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        String relativePrefix = isHomepage ? "." : "..";
        String nav = navbarHtml != null ? navbarHtml : "";
        String foot = footerHtml != null ? footerHtml : "";
        String bodyContent = nav + "\n" + (html != null ? html : "") + "\n" + foot;

        String htmlContent = "<!DOCTYPE html>\n" +
                "<html lang=\"pt-br\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\">\n" +
                "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                "  <script src=\"https://cdn.tailwindcss.com\"></script>\n" +
                "  <link rel=\"stylesheet\" href=\"" + relativePrefix + "/css/" + pageSlug + ".css\">\n" +
                "</head>\n" +
                "<body class=\"bg-slate-950 text-slate-100 min-h-screen\">\n" +
                "  " + bodyContent + "\n" +
                "  <script src=\"" + relativePrefix + "/js/" + pageSlug + ".js\"></script>\n" +
                "</body>\n" +
                "</html>";

        String baseDir = "projects/" + safeName;
        String htmlDest = isHomepage ? baseDir + "/index.html" : baseDir + "/pages/" + pageSlug + ".html";

        uploadFile(htmlDest, htmlContent.getBytes(StandardCharsets.UTF_8), "text/html; charset=utf-8");
        uploadFile(baseDir + "/css/" + pageSlug + ".css", (css != null ? css : "").getBytes(StandardCharsets.UTF_8), "text/css; charset=utf-8");
        uploadFile(baseDir + "/js/" + pageSlug + ".js", (js != null ? js : "").getBytes(StandardCharsets.UTF_8), "application/javascript; charset=utf-8");
    }

    public void deleteObject(String objectName) {
        if (minioClient == null) return;
        try {
            minioClient.removeObject(RemoveObjectArgs.builder().bucket(bucketName).object(objectName).build());
        } catch (Exception ex) {
            System.err.println("[MinIO Storage] Erro ao remover objeto " + objectName + ": " + ex.getMessage());
        }
    }

    public String getObjectUrl(String objectName) {
        return endpoint + "/" + bucketName + "/" + objectName;
    }
}
