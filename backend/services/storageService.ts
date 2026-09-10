import fs from 'fs';
import path from 'path';
import * as Minio from 'minio';

let minioClient: Minio.Client | null = null;
let bucketEnsured = false;
let minioOfflineUntil = 0;

function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || err.code || '').toString();
  return (
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('EHOSTUNREACH') ||
    msg.includes('socket hang up') ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND'
  );
}

export function isMinioAvailable(): boolean {
  if (Date.now() < minioOfflineUntil) return false;
  const client = getMinioClient();
  return client !== null;
}

function markMinioOffline() {
  minioOfflineUntil = Date.now() + 60000;
  bucketEnsured = false;
}

export function loadConfig() {
  const configPath = path.join(process.cwd(), 'backend', 'data', 'minio_config.json');
  let fileConfig: any = {};
  
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error('[MinIO] Erro ao ler config file:', e);
    }
  }

  // A prioridade é: Arquivo de Configuração > Variável de Ambiente > Valor Padrão
  return {
    endpoint: fileConfig.endpoint || process.env.MINIO_ENDPOINT || '',
    port: fileConfig.port || process.env.MINIO_PORT || '9000',
    useSSL: fileConfig.useSSL !== undefined 
      ? fileConfig.useSSL 
      : (process.env.MINIO_USE_SSL !== undefined ? process.env.MINIO_USE_SSL === 'true' : false),
    accessKey: fileConfig.accessKey || process.env.MINIO_ACCESS_KEY || '',
    secretKey: fileConfig.secretKey || process.env.MINIO_SECRET_KEY || '',
    bucket: fileConfig.bucket || process.env.MINIO_BUCKET || 'builddreamer-assets',
    publicUrl: fileConfig.publicUrl || process.env.MINIO_PUBLIC_URL || ''
  };
}

function getMinioClient(): Minio.Client | null {
  if (minioClient) return minioClient;
  
  const config = loadConfig();
  
  if (!config.endpoint || !config.accessKey || !config.secretKey) {
    return null;
  }

  const useSSL = config.useSSL;
  let cleanEndpoint = config.endpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  let port = parseInt(config.port, 10);
  if (isNaN(port)) {
    port = useSSL ? 443 : 80;
  }

  try {
    minioClient = new Minio.Client({
      endPoint: cleanEndpoint,
      port,
      useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      pathStyle: true
    });
    return minioClient;
  } catch (error) {
    console.error('[MinIO] Erro ao inicializar cliente:', error);
    return null;
  }
}

async function ensureBucket(client: Minio.Client, bucket: string): Promise<boolean> {
  if (bucketEnsured) return true;
  if (!isMinioAvailable()) return false;

  try {
    let exists = false;
    try {
      exists = await client.bucketExists(bucket);
    } catch (err: any) {
      if (isNetworkError(err)) {
        markMinioOffline();
        console.warn(`[MinIO] Servidor MinIO indisponível (${err.message || err.code}). Usando armazenamento local em disco.`);
        return false;
      }
      exists = false;
    }

    if (!exists) {
      try {
        await client.makeBucket(bucket, 'us-east-1');
      } catch (err: any) {
        if (isNetworkError(err)) {
          markMinioOffline();
          console.warn(`[MinIO] Servidor MinIO indisponível ao criar bucket (${err.message}). Usando armazenamento local.`);
          return false;
        }
        console.warn(`[MinIO] Erro ao criar bucket "${bucket}": ${err.code || err.message || 'Desconhecido'}`);
        return false;
      }
    }

    // Sempre tenta garantir que o bucket é público para leitura, mesmo que já exista
    const readPolicy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`]
        }
      ]
    });
    
    try {
      await client.setBucketPolicy(bucket, readPolicy);
    } catch (err: any) {
      console.warn(`[MinIO] Falha ao configurar bucket policy pública (provavelmente falta permissão): ${err.message}. Imagens podem não carregar se o bucket for privado.`);
    }

    bucketEnsured = true;
    return true;
  } catch (err: any) {
    if (isNetworkError(err)) {
      markMinioOffline();
      console.warn(`[MinIO] Servidor MinIO indisponível. Usando armazenamento local.`);
    } else {
      console.warn(`[MinIO] Erro ao verificar/garantir bucket: ${err.code || err.message || 'Desconhecido'}`);
    }
    return false;
  }
}

export function resetMinioClient() {
  minioClient = null;
  bucketEnsured = false;
  minioOfflineUntil = 0;
}

export function saveMinioConfig(config: any) {
  const dataDir = path.join(process.cwd(), 'backend', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const configPath = path.join(dataDir, 'minio_config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  resetMinioClient();
}

export async function testMinioConnection(config: any): Promise<{ success: boolean; message: string }> {
  const cleanEndpoint = (config.endpoint || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!cleanEndpoint) {
    return { success: false, message: 'Endpoint do MinIO é obrigatório.' };
  }
  if (!config.accessKey || !config.secretKey) {
    return { success: false, message: 'Access Key e Secret Key são obrigatórios.' };
  }

  const useSSL = !!config.useSSL;
  let port = parseInt(config.port, 10);
  if (isNaN(port)) {
    port = useSSL ? 443 : 80;
  }

  try {
    const tempClient = new Minio.Client({
      endPoint: cleanEndpoint,
      port,
      useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      pathStyle: true
    });

    const bucketName = config.bucket || 'builddreamer-assets';
    const exists = await tempClient.bucketExists(bucketName);
    if (!exists) {
      await tempClient.makeBucket(bucketName, 'us-east-1');
    }
    return { success: true, message: `Conexão bem-sucedida com o MinIO! Bucket "${bucketName}" verificado.` };
  } catch (err: any) {
    return { success: false, message: `Falha ao conectar no MinIO: ${err.message || err.code || 'Servidor inacessível'}` };
  }
}

export async function getAssetStream(objectName: string): Promise<NodeJS.ReadableStream> {
  if (isMinioAvailable()) {
    const client = getMinioClient();
    const config = loadConfig();
    if (client) {
      try {
        return await client.getObject(config.bucket, objectName);
      } catch (err: any) {
        if (isNetworkError(err)) {
          markMinioOffline();
          console.warn(`[MinIO] MinIO desconectou ao ler ${objectName}. Aplicando fallback local.`);
        } else if (err.code !== 'NoSuchKey') {
          console.warn(`[MinIO] getObject falhou para ${objectName} (${err.code || 'Desconhecido'}). Tentando fallback local.`);
        }
      }
    }
  }

  // Fallback para armazenamento de arquivo local com múltiplas tentativas de caminho
  const candidatePaths = [
    path.join(process.cwd(), 'backend', 'data', 'uploads', objectName),
    path.join(process.cwd(), 'backend', 'data', 'uploads', objectName.replace(/^uploads\//, '')),
    path.join(process.cwd(), 'backend', 'data', 'uploads', path.basename(objectName)),
    path.join(process.cwd(), 'data', 'uploads', objectName),
    path.join(process.cwd(), 'data', 'uploads', objectName.replace(/^uploads\//, '')),
    path.join(process.cwd(), 'data', 'uploads', path.basename(objectName))
  ];

  for (const localFilePath of candidatePaths) {
    if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
      return fs.createReadStream(localFilePath);
    }
  }

  return ensureAndCreateFallbackAsset(objectName);
}

function ensureAndCreateFallbackAsset(objectName: string): NodeJS.ReadableStream {
  const filename = path.basename(objectName);
  const uploadsDir = path.join(process.cwd(), 'backend', 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return fs.createReadStream(filePath);
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const rawName = filename.replace(/^[0-9]+_[a-f0-9]+_/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  let contentBuffer: Buffer;

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" fill="none">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#bg)"/>
  <rect x="20" y="20" width="560" height="360" rx="16" fill="#1e293b" fill-opacity="0.5" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="6 6"/>
  <circle cx="300" cy="170" r="40" fill="#6366f1" fill-opacity="0.2" stroke="#818cf8" stroke-width="2"/>
  <path d="M285 180L300 160L315 180H285Z" fill="#a78bfa"/>
  <circle cx="312" cy="155" r="5" fill="#f43f5e"/>
  <text x="300" y="245" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#f8fafc" text-anchor="middle">${cleanName}</text>
  <text x="300" y="270" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">BuildDreamer Media Asset</text>
</svg>`;
    contentBuffer = Buffer.from(svg, 'utf-8');
  } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
    const svgVideo = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" fill="none">
  <rect width="640" height="360" fill="#090d16"/>
  <circle cx="320" cy="180" r="45" fill="#a855f7" fill-opacity="0.2" stroke="#c084fc" stroke-width="2"/>
  <polygon points="310,165 340,180 310,195" fill="#e9d5ff"/>
  <text x="320" y="250" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#e9d5ff" text-anchor="middle">${cleanName} (Vídeo)</text>
</svg>`;
    contentBuffer = Buffer.from(svgVideo, 'utf-8');
  } else if (['js'].includes(ext)) {
    contentBuffer = Buffer.from(`/* BuildDreamer script fallback for ${cleanName} */`, 'utf-8');
  } else if (['css'].includes(ext)) {
    contentBuffer = Buffer.from(`/* BuildDreamer css fallback for ${cleanName} */`, 'utf-8');
  } else {
    contentBuffer = Buffer.from(`BuildDreamer asset: ${cleanName}`, 'utf-8');
  }

  try {
    fs.writeFileSync(filePath, contentBuffer);
    console.warn(`[Storage Fallback] Arquivo ausente criado localmente com sucesso: ${filename}`);
  } catch (e: any) {
    console.error(`[Storage Fallback] Erro ao gravar fallback para ${filename}:`, e.message);
  }

  return fs.createReadStream(filePath);
}

export async function uploadAssetToStorage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  projectId?: string
): Promise<{ url: string; size: number; key: string; isMinio: boolean }> {
  const safeFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const projectFolder = projectId ? `projects/${projectId}/` : 'uploads/';
  const objectName = `${projectFolder}${safeFilename}`;

  if (isMinioAvailable()) {
    const client = getMinioClient();
    const config = loadConfig();

    if (client) {
      try {
        const isReady = await ensureBucket(client, config.bucket);
        if (isReady) {
          await client.putObject(config.bucket, objectName, buffer, buffer.length, {
            'Content-Type': mimeType
          });
          
          // Por padrão usamos a rota de proxy do servidor para garantir compatibilidade e fallback
          let url = `/api/media/files/${objectName}`;
          
          // Se houver uma URL pública configurada (ex: CDN ou MinIO exposto), opcionalmente usamos ela
          // mas adicionamos o bucket no caminho se for uma URL de MinIO direto
          if (config.publicUrl) {
            const basePublic = config.publicUrl.replace(/\/+$/, '');
            const cleanObjectName = objectName.replace(/^\/+/, '');
            // Para MinIO via ngrok/direto, o bucket deve fazer parte do path
            url = `${basePublic}/${config.bucket}/${cleanObjectName}`;
          }

          return {
            url,
            size: buffer.length,
            key: objectName,
            isMinio: true
          };
        }
      } catch (error: any) {
        if (isNetworkError(error)) {
          markMinioOffline();
          console.warn(`[MinIO] Upload falhou devido à indisponibilidade de rede (${error.message}). Aplicando fallback local.`);
        } else {
          console.warn(`[MinIO] Upload no MinIO falhou (${error.message}), aplicando fallback local.`);
        }
      }
    }
  }

  // Fallback local caso MinIO não esteja ativo ou dê erro
  const localDir = path.join(process.cwd(), 'backend', 'data', 'uploads');
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const localPath = path.join(localDir, safeFilename);
  fs.writeFileSync(localPath, buffer);

  const localUrl = `/api/media/files/uploads/${safeFilename}`;

  return {
    url: localUrl,
    size: buffer.length,
    key: `uploads/${safeFilename}`,
    isMinio: false
  };
}
