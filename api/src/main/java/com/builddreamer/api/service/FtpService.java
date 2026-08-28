package com.builddreamer.api.service;

import org.apache.commons.net.ftp.FTP;
import org.apache.commons.net.ftp.FTPClient;
import org.springframework.stereotype.Service;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@Service
public class FtpService {

    public boolean testConnection(String host, int port, String user, String password) {
        FTPClient ftpClient = new FTPClient();
        try {
            ftpClient.connect(host, port);
            boolean login = ftpClient.login(user, password);
            ftpClient.logout();
            return login;
        } catch (IOException ex) {
            return false;
        } finally {
            if (ftpClient.isConnected()) {
                try {
                    ftpClient.disconnect();
                } catch (IOException ignored) {}
            }
        }
    }

    public void uploadDirectory(String host, int port, String user, String password, String localDirPath, String remoteDirPath) throws IOException {
        FTPClient ftpClient = new FTPClient();
        try {
            ftpClient.connect(host, port);
            if (!ftpClient.login(user, password)) {
                throw new IOException("Failed to login to FTP server");
            }
            ftpClient.enterLocalPassiveMode();
            ftpClient.setFileType(FTP.BINARY_FILE_TYPE);

            File localDir = new File(localDirPath);
            uploadDirectoryRecursive(ftpClient, localDir, remoteDirPath);

            ftpClient.logout();
        } finally {
            if (ftpClient.isConnected()) {
                try {
                    ftpClient.disconnect();
                } catch (IOException ignored) {}
            }
        }
    }

    private void uploadDirectoryRecursive(FTPClient ftpClient, File localFile, String remoteDirPath) throws IOException {
        if (localFile.isDirectory()) {
            ftpClient.makeDirectory(remoteDirPath);
            File[] files = localFile.listFiles();
            if (files != null) {
                for (File file : files) {
                    uploadDirectoryRecursive(ftpClient, file, remoteDirPath + "/" + file.getName());
                }
            }
        } else {
            try (FileInputStream srcStream = new FileInputStream(localFile)) {
                ftpClient.storeFile(remoteDirPath, srcStream);
            }
        }
    }

    @org.springframework.scheduling.annotation.Async
    public void uploadSinglePageToFTP(
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
        String host = System.getenv("FTP_HOST") != null ? System.getenv("FTP_HOST") : "localhost";
        int port = 21;
        try {
            if (System.getenv("FTP_PORT") != null) port = Integer.parseInt(System.getenv("FTP_PORT"));
        } catch (Exception ignored) {}
        String user = System.getenv("FTP_USER") != null ? System.getenv("FTP_USER") : "ftpuser";
        String password = System.getenv("FTP_PASSWORD") != null ? System.getenv("FTP_PASSWORD") : "ftppassword";

        FTPClient ftpClient = new FTPClient();
        try {
            ftpClient.connect(host, port);
            if (!ftpClient.login(user, password)) {
                System.err.println("FTP Login failed for host: " + host);
                return;
            }
            ftpClient.enterLocalPassiveMode();
            ftpClient.setFileType(FTP.BINARY_FILE_TYPE);

            String baseDir = "/projects/" + safeName;
            ftpClient.makeDirectory(baseDir);
            if (!isHomepage) {
                ftpClient.makeDirectory(baseDir + "/pages");
            }
            ftpClient.makeDirectory(baseDir + "/css");
            ftpClient.makeDirectory(baseDir + "/js");

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

            String htmlDest = isHomepage ? baseDir + "/index.html" : baseDir + "/pages/" + pageSlug + ".html";
            try (java.io.InputStream htmlStream = new java.io.ByteArrayInputStream(htmlContent.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                ftpClient.storeFile(htmlDest, htmlStream);
            }
            try (java.io.InputStream cssStream = new java.io.ByteArrayInputStream((css != null ? css : "").getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                ftpClient.storeFile(baseDir + "/css/" + pageSlug + ".css", cssStream);
            }
            try (java.io.InputStream jsStream = new java.io.ByteArrayInputStream((js != null ? js : "").getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                ftpClient.storeFile(baseDir + "/js/" + pageSlug + ".js", jsStream);
            }

            ftpClient.logout();
            System.out.println("FTP: Página " + pageSlug + " do projeto " + safeName + " enviada com sucesso para " + htmlDest);
        } catch (Exception ex) {
            System.err.println("FTP: Erro ao enviar página " + pageSlug + " do projeto " + safeName + ": " + ex.getMessage());
        } finally {
            if (ftpClient.isConnected()) {
                try { ftpClient.disconnect(); } catch (IOException ignored) {}
            }
        }
    }
}
