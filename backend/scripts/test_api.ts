async function runTests() {
  console.log('--- TESTANDO AS ROTAS DE API DO SISTEMA ---');
  const baseUrl = 'http://127.0.0.1:3000';

  const endpoints = [
    { name: 'Healthcheck', path: '/health', method: 'GET', expectedStatus: 200 },
    { name: 'Pronto/Readiness', path: '/ready', method: 'GET', expectedStatus: 200 },
    { name: 'Projetos Protegidos (sem Token)', path: '/api/projects', method: 'GET', expectedStatus: 401 },
    { name: 'Mídias Protegidas (sem Token)', path: '/api/media', method: 'GET', expectedStatus: 401 },
    { name: 'SEO de Páginas Protegido (sem Token)', path: '/api/pages/123', method: 'PUT', expectedStatus: 401 },
    { name: 'Signup (Erro de validação esperado)', path: '/api/auth/signup', method: 'POST', body: {}, expectedStatus: 400 },
    { name: 'Login (Erro de validação esperado)', path: '/api/auth/login', method: 'POST', body: {}, expectedStatus: 400 },
  ];

  let successCount = 0;

  for (const ep of endpoints) {
    try {
      const options: any = {
        method: ep.method,
        headers: ep.body ? { 'Content-Type': 'application/json' } : {},
      };
      if (ep.body) {
        options.body = JSON.stringify(ep.body);
      }

      const res = await fetch(`${baseUrl}${ep.path}`, options);
      const isOk = res.status === ep.expectedStatus;

      console.log(`[${isOk ? 'OK' : 'FALHA'}] ${ep.name} (${ep.method} ${ep.path})`);
      console.log(`  - Status esperado: ${ep.expectedStatus}, recebido: ${res.status}`);
      if (isOk) successCount++;
    } catch (err: any) {
      console.log(`[ERRO] Falha ao testar ${ep.name}:`, err.message || err);
    }
  }

  console.log(`\n--- RESULTADOS: ${successCount}/${endpoints.length} TESTES PASSARAM ---`);
  if (successCount === endpoints.length) {
    console.log('🌟 TODAS AS ROTAS DE API TESTADAS RESPONDERAM CONFORME ESPERADO! 🌟');
    process.exit(0);
  } else {
    console.error('❌ ALGUNS TESTES DE API FALHARAM. VERIFIQUE SE O SERVIDOR ESTÁ RODANDO CORRETAMENTE.');
    process.exit(1);
  }
}

runTests();
