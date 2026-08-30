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
        console.warn(`[MinIO] Erro ao criar bucket "${bucket}":`, err.message || err);
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
      console.warn('[MinIO] Erro ao verificar/garantir bucket:', err.message || err);
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
        } else {
          console.warn(`[MinIO] getObject falhou para ${objectName}, tentando fallback local:`, err.message || err);
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
