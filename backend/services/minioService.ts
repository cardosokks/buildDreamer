import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';

export interface MinioConfig {
  endpoint: string;
  port?: number;
  useSSL?: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl?: string;
}

let defaultMinioClient: Minio.Client | null = null;
let defaultBucketEnsured = false;

export function getEffectiveMinioConfig(overrides?: Partial<MinioConfig>): MinioConfig | null {
  const endpoint = overrides?.endpoint || process.env.MINIO_ENDPOINT || '';
  const accessKey = overrides?.accessKey || process.env.MINIO_ACCESS_KEY || '';
  const secretKey = overrides?.secretKey || process.env.MINIO_SECRET_KEY || '';
  const bucket = overrides?.bucket || process.env.MINIO_BUCKET || 'builddreamer-assets';
  const portStr = overrides?.port ? String(overrides.port) : process.env.MINIO_PORT || '9000';
  const useSSL = overrides?.useSSL !== undefined ? overrides.useSSL : process.env.MINIO_USE_SSL === 'true';
  const publicUrl = overrides?.publicUrl || process.env.MINIO_PUBLIC_URL || '';

  if (!endpoint || !accessKey || !secretKey) {
    return null;
  }

  // Sanitizar endpoint (remover http:// ou https:// se presente)
  let cleanEndpoint = endpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  
  let effectivePortStr = portStr;
  
  // Se estivermos rodando no Docker (service name 'app' geralmente) e o usuário tentar 'localhost',
  // traduzimos para o nome do serviço interno do docker 'minio'
  if ((cleanEndpoint === 'localhost' || cleanEndpoint === '127.0.0.1') && process.env.DATABASE_URL?.includes('@postgres')) {
    cleanEndpoint = 'minio';
    // Se a porta for a porta externa (12000), mudamos para a interna (9000)
    if (effectivePortStr === '12000') effectivePortStr = '9000';
  }

  let port = parseInt(effectivePortStr, 10);
  if (cleanEndpoint.includes(':')) {
    const parts = cleanEndpoint.split(':');
    cleanEndpoint = parts[0];
    port = parseInt(parts[1], 10);
  }

  return {
    endpoint: cleanEndpoint,
    port: isNaN(port) ? 9000 : port,
    useSSL,
    accessKey,
    secretKey,
    bucket,
    publicUrl: publicUrl ? publicUrl.replace(/\/+$/, '') : undefined
  };
}

export function createMinioClient(config: MinioConfig): Minio.Client {
  return new Minio.Client({
    endPoint: config.endpoint,
    port: config.port || (config.useSSL ? 443 : 9000),
    useSSL: !!config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    region: 'us-east-1', // Definir uma região padrão ajuda em alguns casos
    pathStyle: true      // Forçar pathStyle evita erros de DNS com buckets em localhost/IP
  });
}

export async function testMinioConnection(config: MinioConfig): Promise<{ success: boolean; message: string; buckets?: string[] }> {
  try {
    const client = createMinioClient(config);
    const buckets = await client.listBuckets();
    const bucketNames = buckets.map(b => b.name);

    // Verificar se o bucket especificado existe, senão criar
    const exists = await client.bucketExists(config.bucket).catch(() => false);
    if (!exists) {
      await client.makeBucket(config.bucket, 'us-east-1');
      bucketNames.push(config.bucket);

      // Definir política pública de leitura para permitir acesso direto às imagens
      const readPolicy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${config.bucket}/*`]
          }
        ]
      });
      try {
        await client.setBucketPolicy(config.bucket, readPolicy);
      } catch (policyErr) {
        console.warn('[MinIO] Aviso ao definir política pública do bucket:', policyErr);
      }
    }

    return {
      success: true,
      message: `Conexão estabelecida com sucesso! Bucket "${config.bucket}" pronto para uso.`,
      buckets: bucketNames
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Falha na conexão com MinIO: ${error.message || 'Verifique as credenciais e o endpoint.'}`
    };
  }
}

export async function uploadAssetToStorage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  overrides?: Partial<MinioConfig>
): Promise<{ url: string; size: number; key: string; isMinio: boolean }> {
  let publicUrl = '';
  let objectName = `uploads/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  let isMinio = false;

  try {
    const minioRes = await uploadBufferToMinio(buffer, filename, mimeType, overrides);
    publicUrl = minioRes.url;
    objectName = minioRes.key;
    isMinio = true;
  } catch (error) {
    console.warn(`[MinIO] Upload falhou ou não configurado. Usando fallback local para ${filename}.`);
    const uploadsDir = path.join(process.cwd(), 'front-end', 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const localFileName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadsDir, localFileName);
    fs.writeFileSync(filePath, buffer);
    publicUrl = `/uploads/${localFileName}`;
    objectName = localFileName;
  }

  return {
    url: publicUrl,
    size: buffer.length,
    key: objectName,
    isMinio
  };
}

export async function uploadBufferToMinio(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  overrides?: Partial<MinioConfig>
): Promise<{ url: string; size: number; key: string; isMinio: boolean }> {
  const config = getEffectiveMinioConfig(overrides);

  if (!config) {
    throw new Error('MinIO não configurado');
  }

  const client = createMinioClient(config);

  // Garantir existência do bucket
  const exists = await client.bucketExists(config.bucket).catch(() => false);
  if (!exists) {
    await client.makeBucket(config.bucket, 'us-east-1');
    const readPolicy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${config.bucket}/*`]
        }
      ]
    });
    try {
      await client.setBucketPolicy(config.bucket, readPolicy);
    } catch {}
  }

  const objectName = `uploads/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  
  await client.putObject(config.bucket, objectName, buffer, buffer.length, {
    'Content-Type': mimeType || 'application/octet-stream'
  });

  let publicUrl: string;
  if (config.publicUrl) {
    publicUrl = `${config.publicUrl}/${config.bucket}/${objectName}`;
  } else {
    const protocol = config.useSSL ? 'https' : 'http';
    const portPart = (config.port === 80 && !config.useSSL) || (config.port === 443 && config.useSSL) ? '' : `:${config.port}`;
    publicUrl = `${protocol}://${config.endpoint}${portPart}/${config.bucket}/${objectName}`;
  }

  return {
    url: publicUrl,
    size: buffer.length,
    key: objectName,
    isMinio: true
  };
}
