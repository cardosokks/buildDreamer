import { ProxyAgent, setGlobalDispatcher, fetch as undiciFetch } from 'undici';

function isValidHttpUrl(stringToTest?: string): boolean {
  if (!stringToTest || typeof stringToTest !== 'string' || stringToTest.trim() === '') return false;
  try {
    const url = new URL(stringToTest.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

const rawEnvProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.AI_PROXY_URL;
const defaultProxyUrl = isValidHttpUrl(rawEnvProxy) ? rawEnvProxy!.trim() : undefined;

if (defaultProxyUrl) {
  try {
    const proxyAgent = new ProxyAgent(defaultProxyUrl);
    setGlobalDispatcher(proxyAgent);
    console.log(`[AI Proxy Engine] Proxy global ativado: ${defaultProxyUrl.replace(/:[^:@]+@/, ':***@')}`);
  } catch (err) {
    console.error('[AI Proxy Engine] Falha ao configurar proxy global:', err);
  }
}

/**
 * Extrai HTML puro de qualquer texto, inclusive blocos markdown e conversacionais
 */
export function extractHtmlFromRawText(text: string): string {
  let cleaned = text.trim();

  // 1. Tentar extrair do bloco de código markdown ```html ... ``` ou ```xml ... ``` ou ``` ... ```
  const codeBlockRegex = /```(?:html|xml|javascript|json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(codeBlockRegex);
  if (match && match[1] && match[1].trim()) {
    cleaned = match[1].trim();
  }

  // 2. Se ainda contiver texto conversacional antes de uma tag HTML (ex: "Aqui está: <div..."), extrair a partir da primeira tag HTML
  const firstTag = cleaned.indexOf('<');
  const lastTag = cleaned.lastIndexOf('>');
  if (firstTag !== -1 && lastTag !== -1 && lastTag > firstTag) {
    const candidate = cleaned.slice(firstTag, lastTag + 1).trim();
    // Validar se o candidato começa com tag HTML ou possui tags válidas
    if (candidate.startsWith('<') && candidate.endsWith('>')) {
      cleaned = candidate;
    }
  }

  return cleaned;
}

/**
 * Limpa o HTML removendo tags <style> e <script> embutidas para garantir separação estrita
 */
export function cleanHtmlExtractAssets(rawHtml: string, existingCss = '', existingJs = '') {
  const extractedHtml = extractHtmlFromRawText(rawHtml);
  let cleanHtml = extractedHtml;
  let extractedCss = existingCss;
  let extractedJs = existingJs;

  // Extrair e remover tags <style> do HTML
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(extractedHtml)) !== null) {
    if (styleMatch[1] && styleMatch[1].trim()) {
      extractedCss = `${extractedCss}\n${styleMatch[1].trim()}`.trim();
    }
  }
  cleanHtml = cleanHtml.replace(styleRegex, '').trim();

  // Extrair e remover tags <script> do HTML (exceto CDNs externos como Tailwind)
  const scriptRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(extractedHtml)) !== null) {
    if (scriptMatch[1] && scriptMatch[1].trim()) {
      extractedJs = `${extractedJs}\n${scriptMatch[1].trim()}`.trim();
    }
  }
  cleanHtml = cleanHtml.replace(scriptRegex, '').trim();

  // Se o HTML contiver <body>, extrai apenas o conteúdo do corpo
  const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    cleanHtml = bodyMatch[1].trim();
  }

  // Remove marcações <html>, <head>, <!DOCTYPE> residuais para o canvas visual
  cleanHtml = cleanHtml
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .trim();

  return {
    html: cleanHtml,
    css: extractedCss,
    js: extractedJs
  };
}

/**
 * Utilitário auxiliar para extrair um valor de string escapado de um JSON quebrado
 */
function extractJsonField(text: string, keyName: string): string | null {
  // Encontrar o padrão "keyName" : " ou 'keyName' : ' ou simplesmente keyName: "
  const keyRegex = new RegExp(`"${keyName}"\\s*:\\s*(["'])`, 'i');
  const match = text.match(keyRegex);
  if (!match) {
    const keyRegexNoQuotes = new RegExp(`\\b${keyName}\\b\\s*:\\s*(["'])`, 'i');
    const matchNoQuotes = text.match(keyRegexNoQuotes);
    if (!matchNoQuotes) return null;
    return parseEscapedStringValue(text, matchNoQuotes.index! + matchNoQuotes[0].length, matchNoQuotes[1]);
  }
  return parseEscapedStringValue(text, match.index! + match[0].length, match[1]);
}

function parseEscapedStringValue(text: string, startIndex: number, quoteChar: string): string {
  let result = '';
  let i = startIndex;
  while (i < text.length) {
    const char = text[i];
    if (char === '\\') {
      const nextChar = text[i + 1];
      if (nextChar === '"' || nextChar === "'" || nextChar === '\\' || nextChar === '/' || nextChar === 'b' || nextChar === 'f' || nextChar === 'n' || nextChar === 'r' || nextChar === 't') {
        if (nextChar === 'n') result += '\n';
        else if (nextChar === 't') result += '\t';
        else if (nextChar === 'r') result += '\r';
        else result += nextChar;
        i += 2;
      } else {
        result += char;
        i++;
      }
    } else if (char === quoteChar) {
      break;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

/**
 * Tenta fazer o parse de JSON de forma ultra resiliente mesmo se houver caracteres de controle ou formatação variada
 */
export function resilientJsonParse(rawString: string): any {
  let text = rawString.trim();

  // Remove blocos de código markdown se existirem
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  } else if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  const formatResult = (obj: any) => {
    // Se não tiver 'html' mas tiver outro campo óbvio, mapear automaticamente
    let htmlContent = obj.html || obj.navbar || obj.footer || '';
    if (!htmlContent) {
      const keys = Object.keys(obj);
      const likelyKey = keys.find(k => {
        const kl = k.toLowerCase();
        return kl.includes('html') || kl.includes('code') || kl.includes('codigo') || kl.includes('markup') || kl.includes('body') || kl.includes('section') || kl.includes('secao') || kl.includes('content') || kl === 'response';
      });
      if (likelyKey) {
        htmlContent = obj[likelyKey];
      }
    }

    const cssContent = obj.css || obj.styles || obj.style || '';
    const jsContent = obj.js || obj.script || obj.scripts || '';
    const explanationContent = obj.explanation || obj.explicacao || obj.desc || obj.description || 'Código atualizado pela IA.';

    const cleaned = cleanHtmlExtractAssets(htmlContent, cssContent, jsContent);
    return {
      explanation: explanationContent,
      html: cleaned.html || htmlContent || '',
      css: cleaned.css || cssContent || '',
      js: cleaned.js || jsContent || '',
      navbar: obj.navbar || undefined,
      footer: obj.footer || undefined
    };
  };

  // 1. Parse JSON Direto
  try {
    const directParsed = JSON.parse(text);
    return formatResult(directParsed);
  } catch {}

  // 2. Extrair objeto JSON delimitado por chaves
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const trimmed = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(trimmed);
      return formatResult(parsed);
    } catch {
      try {
        // Tratar escapes de quebras de linha e tabs comuns
        const sanitized = trimmed.replace(/(?<!\\)"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
          return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        });
        const parsed = JSON.parse(sanitized);
        return formatResult(parsed);
      } catch {}
    }
  }

  // 3. Extrator de propriedades nativo ultra robusto (Trata aspas escapadas e quebra de chaves)
  const extHtml = extractJsonField(text, 'html') || extractJsonField(text, 'code') || extractJsonField(text, 'codigo') || extractJsonField(text, 'markup') || extractJsonField(text, 'content');
  const extCss = extractJsonField(text, 'css') || extractJsonField(text, 'styles') || extractJsonField(text, 'style');
  const extJs = extractJsonField(text, 'js') || extractJsonField(text, 'script') || extractJsonField(text, 'scripts');
  const extExpl = extractJsonField(text, 'explanation') || extractJsonField(text, 'explicacao') || extractJsonField(text, 'desc') || extractJsonField(text, 'description');

  if (extHtml !== null) {
    const cleaned = cleanHtmlExtractAssets(extHtml, extCss || '', extJs || '');
    return {
      explanation: extExpl || 'Conteúdo gerado via scanner resiliente.',
      html: cleaned.html || extHtml,
      css: cleaned.css || extCss || '',
      js: cleaned.js || extJs || '',
      navbar: undefined,
      footer: undefined
    };
  }

  // 4. Se não contiver nenhuma estrutura JSON, mas contiver tags HTML diretas, trata como HTML puro
  if (text.includes('<') && text.includes('>')) {
    const extractedHtml = extractHtmlFromRawText(text);
    if (extractedHtml && extractedHtml.trim().length > 10) {
      const cleaned = cleanHtmlExtractAssets(extractedHtml);
      return {
        explanation: 'Código HTML atualizado diretamente.',
        html: cleaned.html,
        css: cleaned.css,
        js: cleaned.js
      };
    }
  }

  throw new Error('Falha ao processar resposta JSON da IA.');
}

export interface AISkill {
  id: string;
  name: string;
  category?: string;
  description?: string;
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
    id: 'skill-parallax-gsap',
    name: 'Scroll Parallax & Transições Cinemáticas',
    category: 'animation',
    description: 'Efeitos de rolagem com velocidade diferencial, reveal suave de seções e zoom sutil em imagens.',
    promptSnippet: 'Implemente efeitos de Parallax cinemático: crie animações ativadas pelo scroll (reveal com transform translateY e opacity gradual) e utilize transform-style preserve-3d em cards ao passar o cursor (micro-tilt 3D suave).',
    enabled: true
  },
  {
    id: 'skill-hero-masterpiece',
    name: 'Hero Section de Alto Impacto & Glassmorphism',
    category: 'hero',
    description: 'Hero sections cinematográficas com tipografia imponente, badges luminosos, floating cards e CTAs com brilho pulsante.',
    promptSnippet: 'Crie uma Hero Section espetacular: use tipografia com gradiente metálico (bg-clip text), badges translúcidos com iluminação neon sutil, cards flutuantes de estatísticas e um botão de ação primária (CTA) com efeito de glow pulsante e gradiente suave.',
    enabled: true
  },
  {
    id: 'skill-micro-interactions',
    name: 'Micro-Interações & Feedback Visual Tátil',
    category: 'animation',
    description: 'Efeitos magnéticos nos botões, ripples suaves, indicadores de progresso de leitura e feedbacks táteis.',
    promptSnippet: 'Adicione micro-interações refinadas: efeitos de hover magnéticos ou elevação nos botões, ripples visuais ao clicar, bordas com gradiente animado em cards em destaque e barra de progresso de scroll discreta no topo da página.',
    enabled: true
  },
  {
    id: 'skill-cro-conversion',
    name: 'Gatilhos de Conversão (CRO) & Prova Social',
    category: 'conversion',
    description: 'Seções de depoimentos com estrelas douradas, contadores animados de métricas, cronômetros de urgência e WhatsApp flutuante.',
    promptSnippet: 'Otimize a página para alta conversão (CRO): adicione contador numérico animado para métricas de sucesso, grade de depoimentos com fotos circulares e 5 estrelas douradas, garantia visual e botão flutuante do WhatsApp no canto inferior direito com pulso de atenção.',
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

export interface AttachedFile {
  name: string;
  type: string;
  data: string; // Base64 ou texto plano
  isImage?: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateAIResponse = async (
  prompt: string, 
  context: { html: string; css: string; js: string },
  customApiKey?: string,
  customModel?: string,
  registeredModels?: string[],
  onModelAttempt?: (model: string, index: number, total: number) => void,
  customProxyUrl?: string,
  customSkills?: Array<{ id: string; name: string; promptSnippet: string; enabled: boolean }>,
  attachedFiles?: AttachedFile[]
) => {
  const activeKey = (customApiKey || process.env.GEMINI_API_KEY || '').trim();
  const proxyUrl = isValidHttpUrl(customProxyUrl) ? customProxyUrl!.trim() : defaultProxyUrl;

  let candidateModels: string[] = [];
  
  // Sanitização de modelos (impede modelos descontinuados/especializados e garante uso dos modelos ativos Gemini 3.x)
  const sanitizeModelName = (name: string): string | null => {
    if (!name || typeof name !== 'string') return null;
    let clean = name.trim();
    if (clean.startsWith('models/')) clean = clean.replace('models/', '');
    
    // Filtra modelos especializados que não servem para geração de código
    const invalidKeywords = ['-tts', '-image', 'gemma', 'imagen', 'embedding', '-customtools', 'bison', 'gecko', 'aqa', 'audio', 'vision-preview', 'veo', 'lyria'];
    if (invalidKeywords.some(kw => clean.toLowerCase().includes(kw))) {
      return null;
    }

    // Mapeamentos para modelos ativos (substitui modelos descontinuados ou instáveis que retornam 404/503)
    if (
      clean.includes('gemini-1.5') || 
      clean.includes('gemini-1.0') || 
      clean.includes('gemini-2.0') ||
      clean === 'gemini-2.5-flash' ||
      clean === 'gemini-2.5-pro' ||
      clean === 'gemini-pro' ||
      clean === 'gemini-flash-latest' ||
      clean === 'gemini-pro-latest'
    ) {
      return 'gemini-3.6-flash';
    }

    return clean;
  };

  const DEFAULT_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-3.1-pro-preview',
    'gemini-2.5-flash-lite'
  ];

  if (registeredModels && Array.isArray(registeredModels) && registeredModels.length > 0) {
    const sanitizedList = registeredModels
      .map(sanitizeModelName)
      .filter((m): m is string => m !== null && m.length > 3);

    candidateModels = [...sanitizedList];
    
    if (customModel) {
      const sanitizedCustom = sanitizeModelName(customModel);
      if (sanitizedCustom && !candidateModels.includes(sanitizedCustom)) {
        candidateModels.unshift(sanitizedCustom);
      }
    }
    
    // Garante que haja modelos estáveis de fallback
    for (const m of DEFAULT_MODELS) {
      if (!candidateModels.includes(m)) candidateModels.push(m);
    }
  } else if (customModel) {
    const sanitizedCustom = sanitizeModelName(customModel);
    if (sanitizedCustom) {
      candidateModels = [sanitizedCustom, ...DEFAULT_MODELS.filter(m => m !== sanitizedCustom)];
    } else {
      candidateModels = [...DEFAULT_MODELS];
    }
  } else {
    candidateModels = [...DEFAULT_MODELS];
  }

  // Remove duplicatas mantendo a ordem e filtra modelos inválidos/vazios
  candidateModels = [...new Set(candidateModels)].filter(m => m && typeof m === 'string' && m.length > 3);

  // Se customSkills for omitido ou vazio, usa DEFAULT_AI_SKILLS como fallback ativo
  const skillsToUse = (customSkills && Array.isArray(customSkills) && customSkills.length > 0)
    ? customSkills
    : DEFAULT_AI_SKILLS;

  let skillsDirective = '';
  if (skillsToUse && skillsToUse.length > 0) {
    const activeSkills = skillsToUse.filter(s => s.enabled !== false);
    if (activeSkills.length > 0) {
      skillsDirective = `
    ========================================================
    DIRETRIZES TÉCNICAS E SKILLS DE DESIGN OBRIGATÓRIAS ATIVAS (OBRIGATÓRIO INCORPORAR NO HTML, CSS E JS GENERADOS):
    Você DEVE aplicar ativamente e obrigatoriamente as seguintes habilidades de inteligência artificial no código retornado:
    ${activeSkills.map((s, idx) => `${idx + 1}. [SKILL: ${s.name.toUpperCase()}]:\n${s.promptSnippet}`).join('\n\n')}
    ========================================================
      `;
    }
  }

  // Monta referências de arquivos anexados
  let attachmentsTextDirective = '';
  const inlineImageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

  if (attachedFiles && attachedFiles.length > 0) {
    const textFiles = attachedFiles.filter(f => !f.isImage && !f.type.startsWith('image/'));
    const imageFiles = attachedFiles.filter(f => f.isImage || f.type.startsWith('image/'));

    if (textFiles.length > 0) {
      attachmentsTextDirective += `\n\nARQUIVOS DE REFERÊNCIA ANEXADOS PELO USUÁRIO (Código / Documentos / Exemplo):\n`;
      textFiles.forEach(f => {
        attachmentsTextDirective += `--- INÍCIO DO ARQUIVO: "${f.name}" (${f.type}) ---\n${f.data}\n--- FIM DO ARQUIVO: "${f.name}" ---\n\n`;
      });
    }

    if (imageFiles.length > 0) {
      attachmentsTextDirective += `\n\nIMAGENS E ATIVOS ENVIADOS PELO USUÁRIO (Logomarcas / Banners / Mockups):\n`;
      imageFiles.forEach(img => {
        attachmentsTextDirective += `- Imagem "${img.name}": O usuário enviou esta imagem em anexo. Se for uma logomarca ou foto, utilize o data URI diretamente na tag <img src="${img.data}" alt="${img.name}" /> nos locais pertinentes ou replique com precisão a estrutura visual solicitada.\n`;
        
        // Se o data for um Data URI (ex: data:image/png;base64,...), extrai o base64 puro para enviar ao Gemini Vision
        const match = img.data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          inlineImageParts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      });
    }
  }

  const systemPrompt = `
    Você é um Arquiteto de Software Frontend de Elite, Designer Visual Sênior e Engenheiro de Design System especializado em ferramentas visuais No-Code / Code-generation (estilo Webflow, Framer, v0.dev e Tailwind UI).

    Sua missão é atuar como o AI Copilot do nosso Visual Website Builder para criar sites de altíssimo impacto, estética ultra moderna, fluidez e interatividade de nível internacional.

    Você receberá um pedido em linguagem natural e o contexto atual da página:
    - HTML Atual
    - CSS Atual
    - JS Atual

    ${skillsDirective}
    ${attachmentsTextDirective}

    INSTRUÇÕES MANDATÓRIAS DE ARQUITETURA E SEPARAÇÃO DE CÓDIGO:
    1. SEPARAÇÃO TOTAL DE ARQUIVOS (HTML, CSS e JS TOTALMENTE SEPARADOS):
       - O campo "html" deve conter APENAS a estrutura visual com classes Tailwind semânticas.
       - NUNCA inclua tags <style>...</style> dentro do campo "html". Todo CSS customizado, animações @keyframes, efeitos de glow, glassmorphism ou regras extras DEVEM ficar exclusivamente no campo "css".
       - NUNCA inclua tags <script>...</script> dentro do campo "html". Toda interatividade, handlers de formulários, sliders, modais, observers de scroll ou animações Three.js/Canvas DEVEM ficar exclusivamente no campo "js".
    2. PADRÃO ESTÉTICO & DESIGN SYSTEM UNIVERSAL:
       - Use Tailwind CSS moderno, gradientes sutis, glassmorphism, tipografia elegante (Inter / Outfit) e design limpo.
       - Garanta que o layout seja 100% responsivo para mobile (375px) e desktop (1280px).
       - Mantenha IDs e classes semânticas.
       - Preserve o container <div id="canvas-root"> como nó raiz do conteúdo.
    3. ARQUIVOS ANEXADOS & LOGOMARCAS:
       - Se o usuário enviou uma logomarca (imagem ou SVG), posicione-a com destaque e elegância na Navbar (<nav>/<header>), Rodapé (<footer>) ou seções hero.
       - Se o usuário enviou um arquivo de código ou navbar de referência, replique a estrutura com perfeição mantendo o design responsivo.
    4. Retorne SEMPRE um objeto JSON estrito no formato abaixo:

    Formato da Resposta JSON OBRIGATÓRIO:
    {
      "explanation": "Breve resumo técnico e amigável das alterações aplicadas.",
      "html": "<apenas nós HTML sem tags <style> nem <script>>",
      "css": "/* Todo CSS adicional separado aqui */",
      "js": "// Todo JavaScript funcional separado aqui"
    }
  `;

  if (!activeKey) {
    throw new Error("Chave da API do Gemini não fornecida. Configure-a no menu de configurações do sistema ou no backend.");
  }

  let lastError: any = null;

  // Timeout por requisição para evitar que a IA fique pendurada se o upstream demorar (60 segundos)
  const REQUEST_TIMEOUT_MS = 60000;

  for (let i = 0; i < candidateModels.length; i++) {
    const modelToTry = candidateModels[i];
    if (onModelAttempt) {
      onModelAttempt(modelToTry, i + 1, candidateModels.length);
    }

    const versionsToTry = ['v1beta', 'v1'];
    let modelSuccess = false;
    
    for (const apiVersion of versionsToTry) {
      if (modelSuccess) break;

      const maxRetriesPerVersion = 2;
      for (let attempt = 0; attempt <= maxRetriesPerVersion; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const generationConfig: any = {
            responseMimeType: 'application/json',
            temperature: 0.35,
            topP: 0.95,
            maxOutputTokens: 8192
          };

          const userParts: any[] = [
            {
              text: `${systemPrompt}\n\nContexto do site:\nHTML: ${context.html}\nCSS: ${context.css}\nJS: ${context.js}\n\nPedido do Usuário: ${prompt}`
            },
            ...inlineImageParts
          ];

          const payload: any = {
            contents: [
              {
                role: 'user',
                parts: userParts
              }
            ],
            generationConfig
          };

          const fetchOptions: any = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          };

          if (proxyUrl) {
            fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
          }

          const urlObj = new URL(`https://generativelanguage.googleapis.com/${apiVersion}/models/${modelToTry}:generateContent`);
          
          // Suporte híbrido para Chave de API tradicional (AIzaSy) e Bearer Token de Container (AQ.Ab...)
          const isToken = activeKey.startsWith('AQ.') || !activeKey.startsWith('AIzaSy');
          if (isToken) {
            fetchOptions.headers['Authorization'] = `Bearer ${activeKey}`;
          } else {
            urlObj.searchParams.set('key', activeKey);
          }
          
          const apiUrl = urlObj.toString();

          const response = await undiciFetch(apiUrl, fetchOptions);
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errText = await response.text();
            let googleErrorMessage = '';
            try {
              const parsedError = JSON.parse(errText);
              googleErrorMessage = parsedError?.error?.message || '';
            } catch {}

            // Se for 404, não adianta tentar novamente esta versão do modelo
            if (response.status === 404) {
              console.warn(`[Gemini API] Modelo ${modelToTry} não encontrado em ${apiVersion}. Tentando alternativa...`);
              break; // Sai do loop de retries desta versão e tenta a próxima versão
            }

            // Se for erro temporário de alta demanda (503), quota (429) ou erro de servidor (500/502/504)
            const isTransient = [429, 500, 502, 503, 504].includes(response.status);
            if (isTransient && attempt < maxRetriesPerVersion) {
              const backoffMs = (attempt + 1) * 2000;
              console.warn(`[Gemini API] Modelo ${modelToTry} (${apiVersion}) retornou HTTP ${response.status} (${googleErrorMessage || 'Alta demanda / Temporário'}). Aguardando ${backoffMs}ms antes de tentar novamente (tentativa ${attempt + 1}/${maxRetriesPerVersion})...`);
              await sleep(backoffMs);
              continue; // Tenta novamente na próxima iteração do loop attempt
            }

            // Se esgotaram os retries ou é um erro permanente
            lastError = new Error(`Erro na API (${response.status}) ao chamar ${modelToTry} (${apiVersion}): ${googleErrorMessage || errText}`);
            console.warn(`[Gemini API] Modelo ${modelToTry} (${apiVersion}) falhou com HTTP ${response.status}. Passando para o próximo modelo candidato...`);
            break; // Sai do loop de retries desta versão
          }

          const resJson: any = await response.json();
          const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

          const parsed = resilientJsonParse(rawText);
          parsed._usedModel = modelToTry;
          console.log(`[AI Engine] Sucesso com o modelo: ${modelToTry} (${apiVersion})`);
          modelSuccess = true;
          return parsed;

        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            console.warn(`[AI Engine] Timeout na tentativa com ${modelToTry} (${apiVersion})`);
          } else {
            console.warn(`[AI Engine] Exceção em ${modelToTry} (${apiVersion}):`, error.message);
          }
          lastError = error;

          if (attempt < maxRetriesPerVersion) {
            await sleep(1500);
          }
        }
      }
    }
  }

  console.error("Erro na API do Gemini em todos os modelos candidatos:", lastError);
  throw new Error(`Erro ao gerar resposta da IA: ${lastError?.message || 'Falha de conexão com a API do Gemini'}`);
};

/**
 * Lista modelos disponíveis diretamente da API do Gemini
 */
export const listGeminiModels = async (customApiKey?: string, customProxyUrl?: string) => {
  const activeKey = (customApiKey || process.env.GEMINI_API_KEY || '').trim();
  const proxyUrl = isValidHttpUrl(customProxyUrl) ? customProxyUrl!.trim() : defaultProxyUrl;

  if (!activeKey) {
    throw new Error("Chave da API do Gemini não fornecida.");
  }

  const urlObj = new URL(`https://generativelanguage.googleapis.com/v1beta/models`);
  
  const fetchOptions: any = {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  };

  // Suporte híbrido para Chave de API tradicional (AIzaSy) e Bearer Token de Container (AQ.Ab...)
  const isToken = activeKey.startsWith('AQ.') || !activeKey.startsWith('AIzaSy');
  if (isToken) {
    fetchOptions.headers['Authorization'] = `Bearer ${activeKey}`;
  } else {
    urlObj.searchParams.set('key', activeKey);
  }

  const apiUrl = urlObj.toString();

  if (proxyUrl) {
    fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
  }

  const response = await undiciFetch(apiUrl, fetchOptions);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const data: any = await response.json();
  return data.models || [];
};
