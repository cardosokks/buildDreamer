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

function loadConfig() {
  const envConfig = {
    endpoint: process.env.MINIO_ENDPOINT,
    port: process.env.MINIO_PORT || '9000',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET || 'builddreamer-assets',
    publicUrl: process.env.MINIO_PUBLIC_URL || ''
  };

  const configPath = path.join(process.cwd(), 'backend', 'data', 'minio_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (fileConfig.endpoint) {
        return {
          endpoint: envConfig.endpoint || fileConfig.endpoint,
          port: envConfig.port || fileConfig.port,
          useSSL: envConfig.useSSL !== undefined ? envConfig.useSSL : fileConfig.useSSL,
          accessKey: envConfig.accessKey || fileConfig.accessKey,
          secretKey: envConfig.secretKey || fileConfig.secretKey,
          bucket: envConfig.bucket || fileConfig.bucket,
          publicUrl: envConfig.publicUrl || fileConfig.publicUrl
        };
      }
    } catch (e) {
      console.error('[MinIO] Erro ao ler config file:', e);
    }
  }
  return envConfig;
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
      secretKey: config.secretKey
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
        await client.setBucketPolicy(bucket, readPolicy).catch(err => {
          console.warn(`[MinIO] Falha ao configurar bucket policy pública: ${err.message}`);
        });
      } catch (err: any) {
        if (isNetworkError(err)) {
          markMinioOffline();
          console.warn(`[MinIO] Servidor MinIO indisponível ao criar bucket (${err.message}). Usando armazenamento local.`);
          return false;
        }
        console.warn(`[MinIO] Erro ao criar bucket "${bucket}":`, err.message || err);
        return false;
      }
    }
    bucketEnsured = true;
    return true;
  } catch (err: any) {
    if (isNetworkError(err)) {
      markMinioOffline();
      console.warn(`[MinIO] Servidor MinIO indisponível. Usando armazenamento local.`);
    } else {
      console.warn('[MinIO] Erro ao verificar/garantir bucket:', err.message || err);
    }
    return false;
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
        } else {
          console.warn(`[MinIO] getObject falhou para ${objectName}, tentando fallback local:`, err.message || err);
        }
      }
    }
  }

  // Fallback para armazenamento de arquivo local
  const cleanPath = objectName.replace(/^uploads\//, '');
  const localFilePath = path.join(process.cwd(), 'backend', 'data', 'uploads', cleanPath);
  if (fs.existsSync(localFilePath)) {
    return fs.createReadStream(localFilePath);
  }

  throw new Error(`[Storage] Arquivo ${objectName} não encontrado no MinIO nem no disco local.`);
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
          const url = `/api/media/files/${objectName}`;
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
