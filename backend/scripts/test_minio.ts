import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('--- TESTANDO CONEXÃO MINIO ---');
  const configPath = path.join(process.cwd(), 'backend', 'data', 'minio_config.json');
  if (!fs.existsSync(configPath)) {
    console.error('Arquivo minio_config.json não encontrado!');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log('Configurações lidas:', {
    endpoint: config.endpoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    bucket: config.bucket,
  });

  const cleanEndpoint = (config.endpoint || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  let port = parseInt(config.port, 10);
  if (isNaN(port)) {
    port = config.useSSL ? 443 : 80;
  }

  const client = new Minio.Client({
    endPoint: cleanEndpoint,
    port,
    useSSL: !!config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    pathStyle: true,
  });

  try {
    console.log('Verificando se o bucket existe...');
    const bucketExists = await client.bucketExists(config.bucket);
    console.log(`Bucket "${config.bucket}" existe?`, bucketExists);

    if (!bucketExists) {
      console.log('Criando bucket...');
      await client.makeBucket(config.bucket, 'us-east-1');
      console.log('Bucket criado com sucesso!');
    }

    console.log('Testando upload de arquivo de teste...');
    const testContent = Buffer.from('MinIO está funcionando perfeitamente no BuildDreamer!');
    const objectName = `test_${Date.now()}.txt`;
    
    await client.putObject(config.bucket, objectName, testContent, testContent.length, {
      'Content-Type': 'text/plain',
    });
    console.log(`Upload concluído! Arquivo enviado como: ${objectName}`);

    console.log('Testando leitura do arquivo de teste...');
    const stream = await client.getObject(config.bucket, objectName);
    let data = '';
    for await (const chunk of stream) {
      data += chunk;
    }
    console.log('Leitura concluída! Conteúdo recebido:', data);

    console.log('Limpando arquivo de teste do MinIO...');
    await client.removeObject(config.bucket, objectName);
    console.log('Remoção concluída com sucesso!');
    console.log('\n🌟 CONEXÃO MINIO EXECUTADA COM 100% DE SUCESSO! 🌟');
  } catch (err: any) {
    console.error('\n❌ FALHA NO TESTE DO MINIO:', err.message || err);
    process.exit(1);
  }
}

run();
