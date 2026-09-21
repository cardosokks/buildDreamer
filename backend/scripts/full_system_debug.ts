import { prisma } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'builddreamer_super_secret_jwt_key_2026';
const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  module: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function record(module: string, name: string, passed: boolean, details?: string) {
  results.push({ module, name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${module}] ${name} ${details ? `(${details})` : ''}`);
}

async function debugSystem() {
  console.log('\n======================================================');
  console.log('🔍 INICIANDO DIAGNÓSTICO E DEBUG GERAL DO SISTEMA');
  console.log('======================================================\n');

  // 1. Teste de Conexão com Banco de Dados / Store
  try {
    const userCount = await prisma.user.count ? await prisma.user.count() : (await prisma.user.findMany()).length;
    record('Database', 'Conexão e Leitura do Banco de Dados / Store', true, `${userCount} usuários registrados`);
  } catch (err: any) {
    record('Database', 'Conexão e Leitura do Banco de Dados / Store', false, err.message);
  }

  // 2. Health & Readiness HTTP Endpoints
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    record('Server', 'Endpoint GET /health', healthRes.status === 200 && healthJson.status === 'OK', `Status ${healthRes.status}`);

    const readyRes = await fetch(`${BASE_URL}/ready`);
    const readyJson = await readyRes.json();
    record('Server', 'Endpoint GET /ready', readyRes.status === 200 && readyJson.status === 'READY', `Status ${readyRes.status}`);
  } catch (err: any) {
    record('Server', 'Endpoints de Servidor HTTP', false, err.message);
  }

  // 3. Auth Flow Test (Signup, Login, Token)
  let authToken = '';
  let testUserId = '';
  const testEmail = `debug_user_${Date.now()}@builddreamer.local`;
  const testPassword = 'Password123!@#';

  try {
    const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Debug User',
        email: testEmail,
        password: testPassword,
        role: 'OWNER'
      })
    });
    const signupData = await signupRes.json();
    if (signupRes.status === 201 && signupData.token) {
      authToken = signupData.token;
      testUserId = signupData.user.id;
      record('Auth', 'Criação de Usuário (Signup POST /api/auth/signup)', true, `ID: ${testUserId}`);
    } else {
      record('Auth', 'Criação de Usuário (Signup)', false, signupData.error || `HTTP ${signupRes.status}`);
    }

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    if (loginRes.status === 200 && loginData.token) {
      record('Auth', 'Autenticação de Usuário (Login POST /api/auth/login)', true, `Token JWT emitido`);
    } else {
      record('Auth', 'Autenticação de Usuário (Login)', false, loginData.error || `HTTP ${loginRes.status}`);
    }
  } catch (err: any) {
    record('Auth', 'Módulo de Autenticação', false, err.message);
  }

  // 4. User Profile & Settings
  try {
    const profileRes = await fetch(`${BASE_URL}/api/users/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const profileData = await profileRes.json();
    record('Users', 'Obter Perfil do Usuário Autenticado (GET /api/users/profile)', profileRes.status === 200 && profileData.email === testEmail, `Email: ${profileData.email}`);

    const updateProfileRes = await fetch(`${BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        geminiApiKey: 'test_gemini_key_12345',
        aiProxyUrl: 'https://proxy.builddreamer.local'
      })
    });
    const updatedUser = await updateProfileRes.json();
    record('Users', 'Atualização de Configurações de IA do Usuário (PUT /api/users/profile)', updateProfileRes.status === 200, 'Chave de IA e Proxy salvos');
  } catch (err: any) {
    record('Users', 'Módulo de Usuários', false, err.message);
  }

  // 5. Projects CRUD Flow
  let testProjectId = '';
  try {
    const createProjectRes = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Site de Teste de Diagnóstico',
        description: 'Projeto criado para validação de integridade',
        segment: 'Tecnologia',
        siteStyle: 'Moderno'
      })
    });
    const projectData = await createProjectRes.json();
    if (createProjectRes.status === 201 && projectData.id) {
      testProjectId = projectData.id;
      record('Projects', 'Criação de Projeto (POST /api/projects)', true, `ID: ${testProjectId}, Páginas: ${projectData.pages?.length}`);
    } else {
      record('Projects', 'Criação de Projeto (POST /api/projects)', false, projectData.error || `HTTP ${createProjectRes.status}`);
    }

    const listProjectsRes = await fetch(`${BASE_URL}/api/projects`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const projectsList = await listProjectsRes.json();
    const foundProject = Array.isArray(projectsList) && projectsList.some((p: any) => p.id === testProjectId);
    record('Projects', 'Listagem de Projetos (GET /api/projects)', listProjectsRes.status === 200 && foundProject, `Total de projetos: ${projectsList.length}`);

    const getProjectRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const singleProject = await getProjectRes.json();
    record('Projects', 'Detalhes do Projeto com Páginas (GET /api/projects/:id)', getProjectRes.status === 200 && singleProject.id === testProjectId, `Nome: ${singleProject.name}`);
  } catch (err: any) {
    record('Projects', 'Módulo de Projetos', false, err.message);
  }

  // 6. Pages CRUD Flow
  let testPageId = '';
  try {
    const projectRes = await fetch(`${BASE_URL}/api/projects/${testProjectId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const project = await projectRes.json();
    const homePage = project.pages?.find((p: any) => p.isHomepage || p.slug === 'index') || project.pages?.[0];
    if (homePage) {
      testPageId = homePage.id;
      record('Pages', 'Página Inicial (Homepage) Criada Automaticamente', true, `Slug: ${homePage.slug}, ID: ${homePage.id}`);

      const updatePageRes = await fetch(`${BASE_URL}/api/pages/${testPageId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          html: '<header class="p-4 bg-slate-900 text-white"><h1>Diagnóstico OK</h1></header><main class="p-8"><p>Página de teste validada.</p></main>',
          css: 'body { background: #0f172a; color: #fff; }',
          js: 'console.log("diagnóstico ativo");',
          seoTitle: 'Título SEO Diagnóstico',
          seoDescription: 'Descrição SEO Diagnóstico'
        })
      });
      const updatedPage = await updatePageRes.json();
      record('Pages', 'Atualização de Código HTML/CSS/JS e SEO (PUT /api/pages/:id)', updatePageRes.status === 200 && updatedPage.seoTitle === 'Título SEO Diagnóstico', 'Estrutura e SEO salvos');
    } else {
      record('Pages', 'Página Inicial (Homepage)', false, 'Nenhuma página inicial encontrada no projeto');
    }
  } catch (err: any) {
    record('Pages', 'Módulo de Páginas', false, err.message);
  }

  // 7. Media & Storage Flow with Project Isolation
  try {
    const mediaStatusRes = await fetch(`${BASE_URL}/api/media/status`);
    const mediaStatus = await mediaStatusRes.json();
    record('Media', 'Verificação de Status do Storage (GET /api/media/status)', mediaStatusRes.status === 200, `Storage: ${mediaStatus.storageType}`);

    // Upload a 1x1 transparent PNG base64
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const uploadRes = await fetch(`${BASE_URL}/api/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'pixel_diagnostico.png',
        mimeType: 'image/png',
        base64Data: `data:image/png;base64,${samplePngBase64}`,
        projectId: testProjectId
      })
    });
    const uploadData = await uploadRes.json();
    if (uploadRes.status === 201 && uploadData.media?.id) {
      const mediaId = uploadData.media.id;
      record('Media', 'Upload de Imagem com Isolamento por Projeto (POST /api/media/upload)', true, `Media ID: ${mediaId}, Projeto: ${uploadData.media.projectId}`);

      // Filter by projectId
      const listMediaProjRes = await fetch(`${BASE_URL}/api/media?projectId=${testProjectId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const listMediaProj = await listMediaProjRes.json();
      const hasMedia = Array.isArray(listMediaProj.media) && listMediaProj.media.some((m: any) => m.id === mediaId);
      record('Media', 'Listagem de Imagens Filtradas por Projeto (GET /api/media?projectId=...)', listMediaProjRes.status === 200 && hasMedia, `Mídias encontradas: ${listMediaProj.media.length}`);
    } else {
      record('Media', 'Upload de Imagem', false, uploadData.error || `HTTP ${uploadRes.status}`);
    }
  } catch (err: any) {
    record('Media', 'Módulo de Mídia & Armazenamento', false, err.message);
  }

  // 8. CRM Leads Flow
  let testLeadId = '';
  try {
    const createLeadRes = await fetch(`${BASE_URL}/api/leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Cliente Diagnóstico',
        company: 'Empresa Teste S.A.',
        phone: '+55 11 99999-9999',
        email: 'lead@empresa.com',
        dealValue: 15000,
        status: 'NEW',
        projectId: testProjectId
      })
    });
    const leadData = await createLeadRes.json();
    if (createLeadRes.status === 201 && leadData.id) {
      testLeadId = leadData.id;
      record('CRM', 'Criação de Lead (POST /api/leads)', true, `Lead ID: ${testLeadId}`);
    } else {
      record('CRM', 'Criação de Lead', false, leadData.error || `HTTP ${createLeadRes.status}`);
    }

    const listLeadsRes = await fetch(`${BASE_URL}/api/leads`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const leadsList = await listLeadsRes.json();
    record('CRM', 'Listagem de Leads (GET /api/leads)', listLeadsRes.status === 200 && Array.isArray(leadsList), `Total de leads: ${leadsList.length}`);
  } catch (err: any) {
    record('CRM', 'Módulo CRM / Leads', false, err.message);
  }

  // 9. Products & Sales Flow
  try {
    const createProductRes = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Site Institucional Premium',
        price: 2500,
        category: 'Desenvolvimento Web',
        sku: 'DEV-001',
        projectId: testProjectId
      })
    });
    const productData = await createProductRes.json();
    record('Products', 'Criação de Produto / Serviço (POST /api/products)', createProductRes.status === 201, `Produto: ${productData.name || 'OK'}`);

    const listProductsRes = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const productsList = await listProductsRes.json();
    record('Products', 'Listagem de Produtos (GET /api/products)', listProductsRes.status === 200 && Array.isArray(productsList), `Total: ${productsList.length}`);
  } catch (err: any) {
    record('Products', 'Módulo de Produtos', false, err.message);
  }

  // 10. Settings & Export
  try {
    const settingsRes = await fetch(`${BASE_URL}/api/settings`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const settingsData = await settingsRes.json();
    record('Settings', 'Obtenção de Configurações Globais (GET /api/settings)', settingsRes.status === 200, `Status: ${settingsRes.status}, Resp: ${JSON.stringify(settingsData).slice(0, 50)}`);

    const exportZipRes = await fetch(`${BASE_URL}/api/export/${testProjectId}/zip`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    record('Export', 'Geração de Pacote ZIP de Exportação (GET /api/export/:id/zip)', exportZipRes.status === 200, `Status: ${exportZipRes.status}, Content-Type: ${exportZipRes.headers.get('content-type')}`);
  } catch (err: any) {
    record('Export/Settings', 'Módulos de Exportação & Configurações', false, err.message);
  }

  // Summary
  console.log('\n======================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  console.log(`📊 RELATÓRIO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO (${failed} falhas)`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error('❌ Falhas encontradas nos seguintes módulos:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(` - [${r.module}] ${r.name}: ${r.details || 'Erro desconhecido'}`);
    });
    process.exit(1);
  } else {
    console.log('✨ TODOS OS MÓDULOS E ROTAS DO SISTEMA ESTÃO 100% OPERACIONAIS E SAUDÁVEIS!');
    process.exit(0);
  }
}

debugSystem().catch(err => {
  console.error('Erro fatal durante a execução do diagnóstico:', err);
  process.exit(1);
});
