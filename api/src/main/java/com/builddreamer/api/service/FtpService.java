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
}
