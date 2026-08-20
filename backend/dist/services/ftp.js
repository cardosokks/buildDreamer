"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSinglePageToFTP = uploadSinglePageToFTP;
exports.uploadProjectToFTP = uploadProjectToFTP;
const ftp = __importStar(require("basic-ftp"));
const stream_1 = require("stream");
function getSafeProjectName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
async function uploadSinglePageToFTP(projectName, pageSlug, html, css, js, isHomepage = false) {
    const safeName = getSafeProjectName(projectName);
    const client = new ftp.Client();
    client.ftp.verbose = false;
    const ftpHost = process.env.FTP_HOST || 'localhost';
    const ftpPort = parseInt(process.env.FTP_PORT || '21', 10);
    const ftpUser = process.env.FTP_USER || 'ftpuser';
    const ftpPassword = process.env.FTP_PASSWORD || 'ftppassword';
    try {
        await client.access({
            host: ftpHost,
            port: ftpPort,
            user: ftpUser,
            password: ftpPassword,
            secure: false
        });
        const baseDir = `/projects/${safeName}`;
        if (!isHomepage) {
            await client.ensureDir(`${baseDir}/pages`);
        }
        else {
            await client.ensureDir(baseDir);
        }
        await client.ensureDir(`${baseDir}/css`);
        await client.ensureDir(`${baseDir}/js`);
        // Determine correct relative prefix based on folder nesting
        const relativePrefix = isHomepage ? "." : "..";
        // HTML boilerplate to bind CSS and JS
        const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="${relativePrefix}/css/${pageSlug}.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${html}
  <script src="${relativePrefix}/js/${pageSlug}.js"></script>
</body>
</html>`;
        // Upload files to their appropriate destinations
        const htmlDest = isHomepage ? `${baseDir}/index.html` : `${baseDir}/pages/${pageSlug}.html`;
        await client.uploadFrom(stream_1.Readable.from([htmlContent]), htmlDest);
        await client.uploadFrom(stream_1.Readable.from([css]), `${baseDir}/css/${pageSlug}.css`);
        await client.uploadFrom(stream_1.Readable.from([js]), `${baseDir}/js/${pageSlug}.js`);
        console.log(`FTP: Uploaded page ${pageSlug} for project ${safeName} successfully. Destination: ${htmlDest}`);
    }
    catch (error) {
        console.error(`FTP Error uploading page ${pageSlug} for project ${safeName}:`, error);
    }
    finally {
        client.close();
    }
}
async function uploadProjectToFTP(projectName, pages) {
    for (const page of pages) {
        await uploadSinglePageToFTP(projectName, page.slug, page.html, page.css, page.js, page.isHomepage);
    }
}
