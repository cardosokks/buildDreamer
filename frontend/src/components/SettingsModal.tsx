import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Key, Save, Trash2, Plus, Box, Sparkles, Cpu, Check, RotateCcw, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

interface SettingsModalProps {
  onClose: () => void;
}

export interface AISkill {
  id: string;
  name: string;
  category: '3d' | 'animation' | 'hero' | 'layout' | 'conversion' | 'custom';
  description: string;
  promptSnippet: string;
  enabled: boolean;
}

export const DEFAULT_AI_SKILLS: AISkill[] = [
  {
    id: 'skill-3d-canvas',
    name: 'Elementos 3D & Efeitos Canvas WebGL',
    category: '3d',
    description: 'Integra esferas 3D flutuantes, partículas interativas em Canvas e efeitos de profundidade com iluminação dinâmica.',
    promptSnippet: 'Incorpore elementos visuais 3D avançados: adicione no JS um canvas interativo com partículas flutuantes reativas ao mouse ou geometrias 3D abstratas (com iluminação neon, wireframe dinâmico e gradientes de profundidade). Crie sensação de tecnologia de ponta.',
    enabled: true
  },
  {
    id: 'skill-parallax-scroll',
    name: 'Parallax & Scroll Animations (AOS/GSAP Style)',
    category: 'animation',
    description: 'Revelação suave de elementos na rolagem, efeito parallax em seções e cards, e barras de progresso.',
    promptSnippet: 'Implemente animações ricas acionadas pelo scroll da página usando IntersectionObserver nativo no JS: elementos surgem com fade-up suave, stagger em listas de cards, efeito parallax suave em fundos e badges com scale sutil ao entrar na viewport. Classes no CSS com transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s.',
    enabled: true
  },
  {
    id: 'skill-hero-spectacular',
    name: 'Hero Section Espetacular & Ultra Impacto',
    category: 'hero',
    description: 'Hero sections cinematográficas com tipografia imersiva, badges brilhantes, CTAs duplos com gradiente pulsante e glassmorphism.',
    promptSnippet: 'Crie uma Hero Section espetacular de nível internacional: tipografia de impacto com gradientes de texto (bg-clip-text), subtítulo cativante, badges com micro-brilho neon pulsante ("✨ NOVO"), botão de CTA principal com gradiente vibrante e sombra expansiva, estatísticas em números destacados com contadores e cards flutuantes de prova social com glassmorphism.',
    enabled: true
  },
  {
    id: 'skill-micro-interactions',
    name: 'Micro-Interações & Efeito Magnético / Glow',
    category: 'animation',
    description: 'Efeito de glow que segue o cursor nos cards, botões magnéticos e feedback háptico visual em todos os cliques.',
    promptSnippet: 'Adicione micro-interações ultra responsivas: nos cards, aplique efeito de glow de borda no hover (border com gradiente ou spotlight que segue o cursor via JS simples), botões com leve elevação (hover:-translate-y-1) e clique suave (active:scale-95). Tooltips elegantes e feedback visual rico.',
    enabled: true
  },
  {
    id: 'skill-conversion-psychology',
    name: 'Arquitetura de Alta Conversão (CRO)',
    category: 'conversion',
    description: 'Gatilhos de urgência sutil, prova social com estrelas, tabelas comparativas e CTAs fixos com botão WhatsApp direto.',
    promptSnippet: 'Estruture o site com gatilhos psicológicos de alta conversão: selos de garantia ("⭐ 4.9/5 estrelas"), depoimentos com fotos circulares e nomes reais, comparativo "Sem nós vs Com nós", seção de FAQ com acordeão interativo no JS e botão flutuante de WhatsApp direto no canto inferior direito com pulso de atenção.',
    enabled: true
  },
  {
    id: 'skill-dark-luxury',
    name: 'Design System Dark Luxury & Glassmorphism',
    category: 'layout',
    description: 'Paletas luxuosas em tons de obsidian, violeta profundo, ouro champagne ou neon cyan com bordas translúcidas.',
    promptSnippet: 'Utilize estética Dark Luxury de alto padrão: fundo em tons profundos (#07020d, #0b0714), painéis com glassmorphism translúcido (bg-slate-900/60 backdrop-blur-xl border border-purple-500/20), tipografia moderna (Outfit para títulos e Inter para textos) e contrastes meticulosamente calculados.',
    enabled: true
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { token, user, login } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'models' | 'skills'>('profile');
  const [loading, setLoading] = useState(false);
  const [savingRemote, setSavingRemote] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // AI, Proxy, Ngrok & n8n credentials
  const [activeProvider, setActiveProvider] = useState<'ollama' | 'gemini'>(
    (localStorage.getItem('ai_active_provider') as 'ollama' | 'gemini') || 'ollama'
  );
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(
    localStorage.getItem('n8n_webhook_url') || 'http://n8n.192.168.18.39.nip.io/webhook/real-premise-agent'
  );
  const [ollamaServerUrl, setOllamaServerUrl] = useState(
    localStorage.getItem('ollama_server_url') || 'http://192.168.18.33:11434'
  );
  const [ollamaModel, setOllamaModel] = useState(
    localStorage.getItem('ollama_model') || 'cardosokks:latest'
  );
  const [geminiModel, setGeminiModel] = useState(
    localStorage.getItem('gemini_default_model') || 'gemini-3.6-flash'
  );

  const [ollamaModelsList, setOllamaModelsList] = useState<string[]>(() => {
    const stored = localStorage.getItem('ollama_available_models');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return ['cardosokks:latest'];
  });
  const [fetchingOllama, setFetchingOllama] = useState(false);

  const handleFetchOllamaModels = async () => {
    setFetchingOllama(true);
    try {
      const targetUrl = ollamaServerUrl.trim() || 'http://192.168.18.33:11434';
      const res = await fetch(`${API_URL}/api/ai/ollama/models?url=${encodeURIComponent(targetUrl)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          setOllamaModelsList(data.models);
          localStorage.setItem('ollama_available_models', JSON.stringify(data.models));
          if (!data.models.includes(ollamaModel)) {
            setOllamaModel(data.models[0]);
          }
          setSuccessMsg(`Buscado com sucesso! ${data.models.length} modelos encontrados no Ollama.`);
        }
      }
    } catch (err: any) {
      setErrorMsg("Erro ao buscar modelos do Ollama: " + err.message);
    } finally {
      setFetchingOllama(false);
    }
  };

  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [proxyUrl, setProxyUrl] = useState(localStorage.getItem('ai_proxy_url') || '');
  const [ngrokToken, setNgrokToken] = useState(localStorage.getItem('ngrok_authtoken') || '');

  // Models CRUD fields
  const getStoredModels = () => {
    const stored = localStorage.getItem('custom_gemini_models');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [];
  };

  const [models, setModels] = useState<Array<{ id: string; name: string }>>(getStoredModels());
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  // Skills CRUD State
  const getStoredSkills = (): AISkill[] => {
    const stored = localStorage.getItem('custom_ai_skills');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return DEFAULT_AI_SKILLS;
  };

  const [skills, setSkills] = useState<AISkill[]>(getStoredSkills());
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'3d' | 'animation' | 'hero' | 'layout' | 'conversion' | 'custom'>('animation');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillSnippet, setNewSkillSnippet] = useState('');
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  // Sincronizar configurações do Banco de Dados ao abrir o Modal
  useEffect(() => {
    if (!token) return;
    const loadUserSettingsFromDatabase = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/auth/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const s = data.settings;
          if (s) {
            if (s.name) setName(s.name);
            if (s.email) setEmail(s.email);
            if (s.geminiApiKey) {
              setGeminiKey(s.geminiApiKey);
              localStorage.setItem('gemini_api_key', s.geminiApiKey);
            }
            if (s.openaiApiKey) {
              setOpenaiKey(s.openaiApiKey);
              localStorage.setItem('openai_api_key', s.openaiApiKey);
            }
            if (s.aiProxyUrl) {
              setProxyUrl(s.aiProxyUrl);
              localStorage.setItem('ai_proxy_url', s.aiProxyUrl);
            }
            if (s.ngrokAuthToken) {
              setNgrokToken(s.ngrokAuthToken);
              localStorage.setItem('ngrok_authtoken', s.ngrokAuthToken);
            }
            if (s.customAiModels && Array.isArray(s.customAiModels)) {
              setModels(s.customAiModels);
              localStorage.setItem('custom_gemini_models', JSON.stringify(s.customAiModels));
            }
            if (s.customAiSkills && Array.isArray(s.customAiSkills)) {
              setSkills(s.customAiSkills);
              localStorage.setItem('custom_ai_skills', JSON.stringify(s.customAiSkills));
            }
            if (s.savedLeads && Array.isArray(s.savedLeads)) {
              localStorage.setItem('builddreamer_saved_leads', JSON.stringify(s.savedLeads));
            }
            if (s.filterPresets && Array.isArray(s.filterPresets)) {
              localStorage.setItem('builddreamer_filter_presets', JSON.stringify(s.filterPresets));
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar do banco:', err);
      } finally {
        setLoading(false);
      }
    };
    loadUserSettingsFromDatabase();
  }, [token]);

  // Função central para persistir qualquer alteração no Banco de Dados
  const saveToDatabase = async (payload: any) => {
    if (!token) return;
    setSavingRemote(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao salvar no banco');
      }
    } catch (e: any) {
      console.error('Falha ao sincronizar com banco de dados:', e);
    } finally {
      setSavingRemote(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      if (user) {
        const updatedUser = { ...user, name, email };
        login(token!, updatedUser);
        await saveToDatabase({ name });
        setSuccessMsg('Perfil atualizado e salvo no banco de dados!');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAIKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    
    // Atualiza localmente
    localStorage.setItem('ai_active_provider', activeProvider);
    localStorage.setItem('n8n_webhook_url', n8nWebhookUrl);
    localStorage.setItem('ollama_server_url', ollamaServerUrl);
    localStorage.setItem('ollama_model', ollamaModel);
    localStorage.setItem('gemini_default_model', geminiModel);
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('openai_api_key', openaiKey);
    localStorage.setItem('ai_proxy_url', proxyUrl);
    localStorage.setItem('ngrok_authtoken', ngrokToken);

    // Salva no banco de dados
    await saveToDatabase({
      activeProvider,
      n8nWebhookUrl,
      ollamaServerUrl,
      ollamaModel,
      geminiModel,
      geminiApiKey: geminiKey,
      openaiApiKey: openaiKey,
      aiProxyUrl: proxyUrl,
      ngrokAuthToken: ngrokToken
    });

    setSuccessMsg('Configurações de IA (Agente, n8n, Ollama, Gemini) salvas com sucesso!');
    setLoading(false);
  };

  const handleDownloadN8nWorkflow = () => {
    const codeMapNode = [
      "const body = $json.body || {};",
      "let pages = body.pages || [];",
      "if (typeof pages === 'string') { try { pages = JSON.parse(pages); } catch(e) {} }",
      "if (!Array.isArray(pages) || pages.length === 0) {",
      "  pages = [{ slug: body.slug || 'index', name: body.name || 'Página Inicial', html: body.html || body.userPrompt || '<div></div>', css: body.css || '', js: body.js || '', customPrompt: body.customPrompt || '' }];",
      "}",
      `const provider = (body.provider || body.agent || '${activeProvider}').toLowerCase();`,
      `const ollamaModel = body.ollamaModel || '${ollamaModel}';`,
      `const ollamaUrl = body.ollamaUrl || '${ollamaServerUrl}';`,
      `const geminiModel = body.model || body.geminiModel || '${geminiModel}';`,
      `const apiKey = body.apiKey || '${geminiKey}';`,
      "const customAiSkills = body.customAiSkills || '';",
      "let projectMediaUrls = body.projectMediaUrls || [];",
      "if (typeof projectMediaUrls === 'string') { try { projectMediaUrls = JSON.parse(projectMediaUrls); } catch(e) {} }",
      "let siteMappingText = '=========================================\\nMAPA GERAL DA ESTRUTURA E CONTEÚDO DO SITE\\n=========================================\\n\\n';",
      "pages.forEach((p, index) => {",
      "  siteMappingText += 'PÁGINA ' + (index + 1) + ': ' + p.name + ' (slug: ' + p.slug + ')\\n';",
      "  siteMappingText += 'Diretrizes Específicas: ' + (p.customPrompt || 'Manter estrutura e melhorar o design') + '\\n';",
      "  siteMappingText += 'Tamanho do HTML Original: ' + (p.html ? p.html.length : 0) + ' caracteres\\n';",
      "  siteMappingText += '-----------------------------------------\\n\\n';",
      "});",
      "if (projectMediaUrls.length > 0) {",
      "  siteMappingText += 'BANCO DE MÍDIAS E IMAGENS REGISTRADAS PARA O SITE:\\n';",
      "  projectMediaUrls.forEach((mUrl, mIdx) => { siteMappingText += ' - Imagem ' + (mIdx + 1) + ': ' + mUrl + '\\n'; });",
      "  siteMappingText += '\\n';",
      "}",
      "return pages.map((page, index) => {",
      "  return { json: { pageIndex: index + 1, totalPages: pages.length, slug: page.slug || 'index', name: page.name || 'Página', html: page.html || '', css: page.css || '', js: page.js || '', customPrompt: page.customPrompt || '', provider, ollamaModel, ollamaUrl, geminiModel, apiKey, customAiSkills, siteMappingText, projectMediaUrls } };",
      "});"
    ].join("\n");

    const codeAggregateNode = [
      "const items = $input.all();",
      "const remasteredPages = items.map((item, index) => {",
      "  const inputJson = item.json;",
      "  let parsed = {};",
      "  try {",
      "    const rawText = inputJson.message?.content || inputJson.candidates?.[0]?.content?.parts?.[0]?.text || inputJson.text || '{}';",
      "    let cleanText = rawText.replace(/<think>[\\s\\S]*?<\\/think>/gi, '').trim();",
      "    if (cleanText.includes('```')) {",
      "      const match = cleanText.match(/```(?:json)?\\s*([\\s\\S]*?)\\s*```/i);",
      "      if (match && match[1]) cleanText = match[1].trim();",
      "    }",
      "    const start = cleanText.indexOf('{');",
      "    const end = cleanText.lastIndexOf('}');",
      "    if (start !== -1 && end > start) cleanText = cleanText.substring(start, end + 1);",
      "    parsed = JSON.parse(cleanText);",
      "  } catch (e) {",
      "    parsed = { html: inputJson.html || '<div></div>', css: inputJson.css || '', js: inputJson.js || '' };",
      "  }",
      "  return { slug: inputJson.slug || 'index', name: inputJson.name || ('Página ' + (index + 1)), html: parsed.html || inputJson.html || '<div></div>', css: parsed.css || inputJson.css || '', js: parsed.js || inputJson.js || '' };",
      "});",
      "return { json: { explanation: 'Site remasterizado com sucesso via workflow n8n', pages: remasteredPages } };"
    ].join("\n");

    const workflowJson = {
      name: "real-premise-agent",
      nodes: [
        { parameters: { httpMethod: "POST", path: "real-premise-agent", responseMode: "responseNode" }, name: "Webhook Trigger4", type: "n8n-nodes-base.webhook", typeVersion: 2.1, position: [16, 496] },
        { parameters: { jsCode: codeMapNode }, name: "Mapear Estrutura e Links do Site", type: "n8n-nodes-base.code", typeVersion: 2, position: [240, 496] },
        { parameters: { mode: "rules", options: { fallbackOutput: "extra" }, rules: { values: [{ conditions: { combinator: "and", conditions: [{ leftValue: "={{ $json.provider }}", operator: { operation: "equals", type: "string" }, rightValue: "ollama" }], options: { caseSensitive: false } } }] } }, name: "Verificar Agente", type: "n8n-nodes-base.switch", typeVersion: 3, position: [400, 496] },
        { parameters: { method: "POST", url: "={{ ($json.ollamaUrl || '" + ollamaServerUrl + "') + '/api/chat' }}", sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify({ model: $json.ollamaModel || '" + ollamaModel + "', messages: [ { role: 'system', content: 'Você é um Mestre Frontend Senior. Responda ESTRITAMENTE em JSON válido com a estrutura: {\\\"html\\\": \\\"...\\\", \\\"css\\\": \\\"...\\\", \\\"js\\\": \\\"...\\\"}. Crie um design HTML5 moderno com Tailwind CSS.' }, { role: 'user', content: 'REMASTERIZAR PÁGINA (' + $json.pageIndex + '/' + $json.totalPages + '): ' + $json.name + ' (slug: ' + $json.slug + ')\\n\\n' + $json.siteMappingText + '\\nSKILLS E HABILIDADES DE DESIGN:\\n' + $json.customAiSkills + '\\n\\nDIRETRIZES DA PÁGINA:\\n' + $json.customPrompt + '\\n\\nHTML DA PÁGINA:\\n' + $json.html } ], stream: false, format: 'json', options: { temperature: 0.35, num_predict: 8192 } }) }}", options: { batching: { batch: { batchSize: 1, batchInterval: 1000 } } } }, name: "Refazer Página com Ollama", type: "n8n-nodes-base.httpRequest", typeVersion: 4.3, position: [500, 380] },
        { parameters: { method: "POST", url: "=https://generativelanguage.googleapis.com/v1beta/models/{{ $json.geminiModel || '" + geminiModel + "' }}:generateContent?key={{ $json.apiKey }}", sendHeaders: true, headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] }, sendBody: true, specifyBody: "json", jsonBody: "={{ JSON.stringify({ systemInstruction: { parts: [{ text: 'Você é um Mestre Frontend Senior. Responda ESTRITAMENTE em JSON válido com as chaves: {\\\"html\\\": \\\"...\\\", \\\"css\\\": \\\"...\\\", \\\"js\\\": \\\"...\\\"}. Crie um layout HTML5 moderno com Tailwind CSS elegante.' }] }, contents: [{ role: 'user', parts: [{ text: 'PÁGINA ATUAL (' + $json.pageIndex + '/' + $json.totalPages + '): ' + $json.name + ' (slug: ' + $json.slug + ')\\n\\n' + $json.siteMappingText + '\\nSKILLS E HABILIDADES DE DESIGN:\\n' + $json.customAiSkills + '\\n\\nDIRETRIZES DA PÁGINA:\\n' + $json.customPrompt + '\\n\\nHTML DA PÁGINA:\\n' + $json.html }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 8192 } }) }}", options: { batching: { batch: { batchSize: 1, batchInterval: 1000 } } } }, name: "Refazer Página com Gemini", type: "n8n-nodes-base.httpRequest", typeVersion: 4.3, position: [500, 600] },
        { parameters: { jsCode: codeAggregateNode }, name: "Agrupar Páginas no JSON Padronizado", type: "n8n-nodes-base.code", typeVersion: 2, position: [740, 496] },
        { parameters: { options: {} }, name: "Respond to Webhook4", type: "n8n-nodes-base.respondToWebhook", typeVersion: 1.5, position: [960, 496] }
      ],
      connections: {
        "Webhook Trigger4": { main: [[{ node: "Mapear Estrutura e Links do Site", type: "main", index: 0 }]] },
        "Mapear Estrutura e Links do Site": { main: [[{ node: "Verificar Agente", type: "main", index: 0 }]] },
        "Verificar Agente": { main: [[{ node: "Refazer Página com Ollama", type: "main", index: 0 }], [{ node: "Refazer Página com Gemini", type: "main", index: 0 }]] },
        "Refazer Página com Ollama": { main: [[{ node: "Agrupar Páginas no JSON Padronizado", type: "main", index: 0 }]] },
        "Refazer Página com Gemini": { main: [[{ node: "Agrupar Páginas no JSON Padronizado", type: "main", index: 0 }]] },
        "Agrupar Páginas no JSON Padronizado": { main: [[{ node: "Respond to Webhook4", type: "main", index: 0 }]] }
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workflowJson, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "builddreamer-n8n-workflow.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelId || !newModelName) return;

    if (models.some(m => m.id === newModelId)) {
      setErrorMsg('Este ID de modelo já está cadastrado.');
      return;
    }

    const updated = [...models, { id: newModelId, name: newModelName }];
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    await saveToDatabase({ customAiModels: updated });
    
    setNewModelId('');
    setNewModelName('');
    setSuccessMsg('Modelo adicionado e salvo no banco de dados!');
  };

  const handleDeleteModel = async (id: string) => {
    const updated = models.filter(m => m.id !== id);
    setModels(updated);
    localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
    await saveToDatabase({ customAiModels: updated });
    setSuccessMsg('Modelo excluído e sincronizado no banco de dados!');
  };

  const [fetchingApiModels, setFetchingApiModels] = useState(false);

  const handleFetchApiModels = async () => {
    setFetchingApiModels(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeKey = geminiKey || localStorage.getItem('gemini_api_key') || '';

    const safeHeader = (val: string) => {
      try { return btoa(unescape(encodeURIComponent(val))); } catch { return ''; }
    };

    try {
      const res = await fetch(`${API_URL}/api/ai/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-gemini-key': safeHeader(activeKey)
        }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao buscar modelos na API do Gemini');
      }

      const data = await res.json();
      const apiModels: Array<{ id: string; name: string }> = data.models || [];

      if (apiModels.length === 0) {
        setErrorMsg('Nenhum modelo de geração de conteúdo encontrado para este token.');
        return;
      }

      // Adiciona apenas os modelos que ainda não estão na lista
      const existingIds = new Set(models.map(m => m.id));
      const newDiscovered = apiModels.filter(m => !existingIds.has(m.id));

      if (newDiscovered.length === 0) {
        setSuccessMsg(`Todos os ${apiModels.length} modelos retornados pela API já estão cadastrados!`);
      } else {
        const updated = [...models, ...newDiscovered];
        setModels(updated);
        localStorage.setItem('custom_gemini_models', JSON.stringify(updated));
        await saveToDatabase({ customAiModels: updated });
        setSuccessMsg(`Sucesso! ${newDiscovered.length} novos modelos foram encontrados na sua chave e salvos no banco.`);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Erro ao conectar à API do Gemini');
    } finally {
      setFetchingApiModels(false);
    }
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillSnippet.trim()) {
      setErrorMsg('Nome da Skill e Diretriz de Prompt são obrigatórios.');
      return;
    }

    let updated: AISkill[];
    if (editingSkillId) {
      updated = skills.map(s => s.id === editingSkillId ? {
        ...s,
        name: newSkillName.trim(),
        category: newSkillCategory,
        description: newSkillDesc.trim(),
        promptSnippet: newSkillSnippet.trim()
      } : s);
      setEditingSkillId(null);
      setSuccessMsg('Skill atualizada e salva no banco de dados!');
    } else {
      const newSkill: AISkill = {
        id: `skill-${Date.now()}`,
        name: newSkillName.trim(),
        category: newSkillCategory,
        description: newSkillDesc.trim(),
        promptSnippet: newSkillSnippet.trim(),
        enabled: true
      };
      updated = [...skills, newSkill];
      setSuccessMsg('Nova Skill cadastrada e salva no banco de dados!');
    }

    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });

    setNewSkillName('');
    setNewSkillDesc('');
    setNewSkillSnippet('');
  };

  const handleToggleSkill = async (id: string) => {
    const updated = skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });
  };

  const handleDeleteSkill = async (id: string) => {
    const updated = skills.filter(s => s.id !== id);
    setSkills(updated);
    localStorage.setItem('custom_ai_skills', JSON.stringify(updated));
    await saveToDatabase({ customAiSkills: updated });
    setSuccessMsg('Skill removida do banco de dados.');
  };

  const handleStartEditSkill = (s: AISkill) => {
    setEditingSkillId(s.id);
    setNewSkillName(s.name);
    setNewSkillCategory(s.category);
    setNewSkillDesc(s.description);
    setNewSkillSnippet(s.promptSnippet);
  };

  const handleResetDefaultSkills = async () => {
    setSkills(DEFAULT_AI_SKILLS);
    localStorage.setItem('custom_ai_skills', JSON.stringify(DEFAULT_AI_SKILLS));
    await saveToDatabase({ customAiSkills: DEFAULT_AI_SKILLS });
    setSuccessMsg('Skills restauradas para os padrões e salvas no banco!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          Configurações do Sistema
        </h2>

        {/* Tab switcher */}
        <div className="grid grid-cols-4 gap-2 p-1 bg-slate-950 border border-slate-850 rounded-xl mb-6">
          <button 
            onClick={() => { setActiveTab('profile'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'profile' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <User className="w-3.5 h-3.5" />
            Perfil
          </button>
          <button 
            onClick={() => { setActiveTab('ai'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'ai' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Key className="w-3.5 h-3.5" />
            Chaves API
          </button>
          <button 
            onClick={() => { setActiveTab('models'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'models' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Box className="w-3.5 h-3.5" />
            Modelos IA
          </button>
          <button 
            onClick={() => { setActiveTab('skills'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${activeTab === 'skills' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Skills IA ({skills.filter(s => s.enabled).length})
          </button>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-350 text-xs font-medium">
            ✅ {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-350 text-xs font-medium">
            ❌ {errorMsg}
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-2">Nome Completo</label>
                <input 
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-2">Endereço de E-mail</label>
                <input 
                  type="email"
                  required
                  placeholder="nome@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs text-white"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-505 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Save className="w-4 h-4" />
                  Salvar Perfil
                </button>
              </div>
            </form>
          )}

          {activeTab === 'ai' && (
            <form onSubmit={handleSaveAIKeys} className="space-y-4">
              {/* Seleção do Agente Ativo & Webhook n8n */}
              <div className="p-3.5 bg-slate-950/80 border border-purple-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Provedor de IA Padrão (Agente)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Processamento via n8n</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveProvider('ollama')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeProvider === 'ollama'
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Cpu className="w-4 h-4 text-cyan-300" />
                    Ollama Local
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveProvider('gemini')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeProvider === 'gemini'
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Google Gemini
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-350 mb-1">Webhook URL do n8n</label>
                  <input 
                    type="url"
                    required
                    placeholder="http://n8n.192.168.18.39.nip.io/webhook/real-premise-agent"
                    value={n8nWebhookUrl}
                    onChange={(e) => setN8nWebhookUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs text-white font-mono"
                  />
                </div>

                {/* Download Workflow Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadN8nWorkflow}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-850 border border-purple-500/40 text-purple-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Box className="w-4 h-4 text-purple-400" />
                    Baixar Workflow n8n (.json) pré-configurado
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1 text-center">
                    Baixa o arquivo `.json` do workflow configurado com o Ollama e Gemini prontos para importar no n8n.
                  </p>
                </div>
              </div>

              {/* Servidor e Modelo do Ollama */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    Configurações do Ollama Local
                  </h4>
                  <button
                    type="button"
                    onClick={handleFetchOllamaModels}
                    disabled={fetchingOllama}
                    className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/30 text-cyan-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${fetchingOllama ? 'animate-spin' : ''}`} />
                    Buscar Modelos via API
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">URL do Servidor Ollama</label>
                    <input 
                      type="text"
                      placeholder="http://192.168.18.33:11434"
                      value={ollamaServerUrl}
                      onChange={(e) => setOllamaServerUrl(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Modelo Ollama Padrão</label>
                    {ollamaModelsList.length > 0 ? (
                      <select
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-cyan-300 font-mono focus:outline-none cursor-pointer"
                      >
                        {ollamaModelsList.map((m) => (
                          <option key={m} value={m} className="bg-slate-950 text-white">
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text"
                        placeholder="cardosokks:latest"
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white font-mono"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Gemini Key & Modelo Padrão */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Configurações do Google Gemini
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Gemini API Key</label>
                    <input 
                      type="password"
                      placeholder="AIzaSy..."
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Modelo Gemini Padrão</label>
                    <select
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-amber-300 focus:outline-none cursor-pointer"
                    >
                      <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2 flex items-center justify-between">
                  <span>Proxy para IA (HTTP / HTTPS / SOCKS5)</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-normal">Bypass de Bloqueio</span>
                </label>
                <input 
                  type="text"
                  placeholder="http://usuario:senha@ip-proxy:porta ou http://proxy.servidor.com:8080"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-455 mb-2 flex items-center justify-between">
                  <span>Ngrok Authtoken</span>
                  <span className="text-[10px] text-cyan-400 font-mono font-normal">Acesso Global ao Dashboard</span>
                </label>
                <input 
                  type="password"
                  placeholder="2xxxx_xxxxxxxxxxxxxxxxxxxx"
                  value={ngrokToken}
                  onChange={(e) => setNgrokToken(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs text-white font-mono"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-505 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Save className="w-4 h-4" />
                  Salvar Configurações de IA
                </button>
              </div>
            </form>
          )}

          {activeTab === 'models' && (
            <div className="space-y-6">

              {/* Sincronização Automática via API Token */}
              <div className="p-4 bg-purple-950/25 border border-purple-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Buscar Modelos Disponíveis na API
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Consulta a API oficial do Gemini com seu token e cadastra automaticamente os modelos liberados na sua conta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchApiModels}
                    disabled={fetchingApiModels}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {fetchingApiModels ? 'Consultando...' : 'Sincronizar Modelos'}
                  </button>
                </div>
              </div>
              
              {/* Add New Custom Model Manualmente */}
              <form onSubmit={handleAddModel} className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider">Adicionar Manualmente</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">ID do Modelo</label>
                    <input 
                      type="text"
                      required
                      placeholder="gemini-2.0-flash"
                      value={newModelId}
                      onChange={(e) => setNewModelId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Nome de Exibição</label>
                    <input 
                      type="text"
                      required
                      placeholder="Gemini 2.5 Flash"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Manualmente
                </button>
              </form>

              {/* Models List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider">
                  Modelos Cadastrados ({models.length})
                </h3>
                
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {models.map(m => (
                    <div 
                      key={m.id} 
                      className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{m.id}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteModel(m.id)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-850 rounded transition-all cursor-pointer"
                        title="Remover modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-5">
              {/* Header com Descrição e Botão Restaurar Padrões */}
              <div className="flex items-center justify-between gap-3 p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-pink-400" />
                    Skills & Diretrizes Avançadas da IA
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ative ou crie skills para turbinar a criação e o chat de IA com animações, objetos 3D, parallax e alta conversão.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaultSkills}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                  title="Restaurar lista de skills de fábrica"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restaurar Padrões
                </button>
              </div>

              {/* Formulário de Adicionar / Editar Skill */}
              <form onSubmit={handleSaveSkill} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-purple-400" />
                    {editingSkillId ? 'Editar Skill' : 'Criar Nova Skill Personalizada'}
                  </h4>
                  {editingSkillId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSkillId(null);
                        setNewSkillName('');
                        setNewSkillDesc('');
                        setNewSkillSnippet('');
                      }}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1">Nome da Skill</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Animações de Scroll GSAP"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Categoria</label>
                    <select
                      value={newSkillCategory}
                      onChange={(e: any) => setNewSkillCategory(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-purple-300 focus:border-purple-500 focus:outline-none cursor-pointer"
                    >
                      <option value="3d">3D & WebGL</option>
                      <option value="animation">Animações & Scroll</option>
                      <option value="hero">Hero Sections</option>
                      <option value="layout">Layout & Dark</option>
                      <option value="conversion">Conversão & CRO</option>
                      <option value="custom">Customizada</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Descrição Curta</label>
                  <input 
                    type="text"
                    placeholder="Ex: Transições suaves de cards e efeitos de fade ao rolar."
                    value={newSkillDesc}
                    onChange={(e) => setNewSkillDesc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                    <span>Instrução / Prompt Técnico da Skill (Injetado na IA)</span>
                    <span className="text-[9px] text-purple-400 font-mono">HTML, CSS, JS</span>
                  </label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="Ex: Crie animações de entrada com IntersectionObserver no JS e classes CSS separadas..."
                    value={newSkillSnippet}
                    onChange={(e) => setNewSkillSnippet(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-xs text-white font-mono focus:border-purple-500 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editingSkillId ? 'Salvar Alterações da Skill' : 'Adicionar Skill ao Sistema'}
                </button>
              </form>

              {/* Lista de Skills Cadastradas com Toggle Ativo/Inativo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider">
                    Skills Cadastradas ({skills.length})
                  </h4>
                  <span className="text-[10px] text-purple-400 font-mono">
                    {skills.filter(s => s.enabled).length} ativas na geração
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {skills.map(s => (
                    <div 
                      key={s.id} 
                      className={`p-3 border rounded-xl transition-all ${
                        s.enabled 
                          ? 'bg-slate-950/80 border-purple-500/40 shadow-sm' 
                          : 'bg-slate-950/30 border-slate-850 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              checked={s.enabled}
                              onChange={() => handleToggleSkill(s.id)}
                              className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                              title={s.enabled ? 'Skill Ativa' : 'Skill Inativa'}
                            />
                            <span className="text-xs font-bold text-white truncate">{s.name}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/30 font-mono">
                              {s.category}
                            </span>
                          </div>
                          {s.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1">{s.description}</p>
                          )}
                          <p className="text-[10px] text-slate-500 font-mono line-clamp-2 italic bg-slate-900/60 p-1.5 rounded border border-slate-850">
                            {s.promptSnippet}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditSkill(s)}
                            className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-850 rounded transition-all cursor-pointer"
                            title="Editar Skill"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSkill(s.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-850 rounded transition-all cursor-pointer"
                            title="Excluir Skill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end pt-6 border-t border-slate-800/60 mt-6 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
