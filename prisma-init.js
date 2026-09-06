import { execSync } from 'child_process';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMigration() {
  console.log('🔄 Iniciando verificação e sincronização do banco de dados para o Easypanel...');
  const maxRetries = 15;
  const retryInterval = 4000; // 4 segundos

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔌 Tentativa ${attempt}/${maxRetries} de conectar ao PostgreSQL...`);
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log('✅ Banco de dados sincronizado e pronto para o Easypanel!');
      return;
    } catch (error) {
      console.log(`⚠️ Banco de dados ainda não está pronto (ou indisponível). Retentando em ${retryInterval / 1000}s...`);
      if (attempt === maxRetries) {
        console.error('❌ Erro crítico: Não foi possível conectar ao banco de dados após várias tentativas.');
        process.exit(1);
      }
      await delay(retryInterval);
    }
  }
}

runMigration();
