import fs from 'fs';
import path from 'path';
import * as Minio from 'minio';

let minioClient: Minio.Client | null = null;
let bucketEnsured = false;

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
          endpoint: fileConfig.endpoint,
          port: fileConfig.port || envConfig.port,
          useSSL: fileConfig.useSSL || envConfig.useSSL,
          accessKey: fileConfig.accessKey || envConfig.accessKey,
          secretKey: fileConfig.secretKey || envConfig.secretKey,
          bucket: fileConfig.bucket || envConfig.bucket,
          publicUrl: fileConfig.publicUrl || envConfig.publicUrl
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
  try {
    const exists = await client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1');
      // Tenta setar política pública
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
    }
    bucketEnsured = true;
    return true;
  } catch (err: any) {
    console.error('[MinIO] Erro ao garantir bucket. Detalhes:', err);
    return false;
  }
}

export async function uploadAssetToStorage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  projectId?: string
): Promise<{ url: string; size: number; key: string; isMinio: boolean }> {
  
  const client = getMinioClient();
  const config = loadConfig();
  
  if (!client) {
    throw new Error('[MinIO] Configuração do MinIO ausente ou inválida.');
  }
  
  const bucket = config.bucket;
  const publicUrlBase = config.publicUrl;
  const projectFolder = projectId ? `projects/${projectId}/` : 'uploads/';

  try {
    const isReady = await ensureBucket(client, bucket);
    if (!isReady) {
      throw new Error('[MinIO] Falha ao preparar o bucket.');
    }
    
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `${projectFolder}${safeFilename}`;
    
    await client.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': mimeType
    });
    
    let url = '';
    if (publicUrlBase) {
      url = `${publicUrlBase.replace(/\/+$/, '')}/${bucket}/${objectName}`;
    } else {
      const protocol = config.useSSL ? 'https' : 'http';
      url = `${protocol}://${config.endpoint}:${config.port}/${bucket}/${objectName}`;
    }
    
    return {
      url,
      size: buffer.length,
      key: objectName,
      isMinio: true
    };
  } catch (error: any) {
    console.error(`[MinIO] Upload falhou: ${error.message}`);
    throw new Error(`[MinIO] Falha no upload: ${error.message}`);
  }
}
