import * as ftp from 'basic-ftp';
import { Readable } from 'stream';

function getSafeProjectName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export async function uploadSinglePageToFTP(
  projectName: string,
  pageSlug: string,
  html: string,
  css: string,
  js: string
) {
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
    await client.ensureDir(`${baseDir}/pages`);
    await client.ensureDir(`${baseDir}/css`);
    await client.ensureDir(`${baseDir}/js`);

    // HTML boilerplate to bind CSS and JS
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="../css/${pageSlug}.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${html}
  <script src="../js/${pageSlug}.js"></script>
</body>
</html>`;

    // Upload files from streams
    await client.uploadFrom(Readable.from([htmlContent]), `${baseDir}/pages/${pageSlug}.html`);
    await client.uploadFrom(Readable.from([css]), `${baseDir}/css/${pageSlug}.css`);
    await client.uploadFrom(Readable.from([js]), `${baseDir}/js/${pageSlug}.js`);

    console.log(`FTP: Uploaded page ${pageSlug} for project ${safeName} successfully.`);
  } catch (error) {
    console.error(`FTP Error uploading page ${pageSlug} for project ${safeName}:`, error);
  } finally {
    client.close();
  }
}

export async function uploadProjectToFTP(
  projectName: string,
  pages: Array<{ slug: string; html: string; css: string; js: string }>
) {
  for (const page of pages) {
    await uploadSinglePageToFTP(projectName, page.slug, page.html, page.css, page.js);
  }
}
