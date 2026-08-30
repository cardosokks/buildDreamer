import fs from 'fs';
import path from 'path';
import * as Minio from 'minio';

let minioClient: Minio.Client | null = null;
let bucketEnsured = false;

function getMinioClient(): Minio.Client | null {
  if (minioClient) return minioClient;

  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  
  if (!endpoint || !accessKey || !secretKey) {
    return null;
  }

  const portStr = process.env.MINIO_PORT || '9000';
  const useSSL = process.env.MINIO_USE_SSL === 'true';

  let cleanEndpoint = endpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  let port = parseInt(portStr, 10);
  if (isNaN(port)) {
    port = useSSL ? 443 : 80;
  }

  try {
    minioClient = new Minio.Client({
      endPoint: cleanEndpoint,
      port,
      useSSL,
      accessKey,
      secretKey
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
    console.error('[MinIO] Erro ao garantir bucket:', err.message);
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
  if (!client) {
    throw new Error('[MinIO] Configuração do MinIO ausente ou inválida.');
  }
  
  const bucket = process.env.MINIO_BUCKET || 'builddreamer-assets';
  const publicUrlBase = process.env.MINIO_PUBLIC_URL || '';
  const projectFolder = projectId ? `projects/${projectId}/` : 'uploads/';

  try {
    const isReady = await ensureBucket(client, bucket);
    if (!isReady) {
      throw new Error('[MinIO] Falha ao preparar o bucket.');
    }
    
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectName = `${projectFolder}${Date.now()}_${safeFilename}`;
    
    await client.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': mimeType
    });
    
    let url = '';
    if (publicUrlBase) {
      url = `${publicUrlBase.replace(/\/+$/, '')}/${bucket}/${objectName}`;
    } else {
      const endpoint = process.env.MINIO_ENDPOINT || '';
      const port = process.env.MINIO_PORT || '9000';
      const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
      url = `${protocol}://${endpoint}:${port}/${bucket}/${objectName}`;
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
