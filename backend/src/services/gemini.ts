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
 * Limpa o HTML removendo tags <style> e <script> embutidas para garantir separação estrita
 */
export function cleanHtmlExtractAssets(rawHtml: string, existingCss = '', existingJs = '') {
  let cleanHtml = rawHtml;
  let extractedCss = existingCss;
  let extractedJs = existingJs;

  // Extrair e remover tags <style> do HTML
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(rawHtml)) !== null) {
    if (styleMatch[1] && styleMatch[1].trim()) {
      extractedCss = `${extractedCss}\n${styleMatch[1].trim()}`.trim();
    }
  }
  cleanHtml = cleanHtml.replace(styleRegex, '').trim();

  // Extrair e remover tags <script> do HTML (exceto CDNs externos como Tailwind)
  const scriptRegex = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(rawHtml)) !== null) {
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
 * Tenta fazer o parse de JSON de forma ultra resiliente mesmo se houver caracteres de controle
 */
function resilientJsonParse(rawString: string): any {
  let text = rawString.trim();

  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  try {
    const directParsed = JSON.parse(text);
    const cleaned = cleanHtmlExtractAssets(directParsed.html || '', directParsed.css || '', directParsed.js || '');
    return {
      ...directParsed,
      html: cleaned.html,
      css: cleaned.css,
      js: cleaned.js
    };
  } catch {}

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const trimmed = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(trimmed);
      const cleaned = cleanHtmlExtractAssets(parsed.html || '', parsed.css || '', parsed.js || '');
      return {
        ...parsed,
        html: cleaned.html,
        css: cleaned.css,
        js: cleaned.js
      };
    } catch {}
  }

  // Regex fallback
  const htmlMatch = text.match(/"html"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:css|js|explanation)"/);
  const cssMatch = text.match(/"css"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:js|html|explanation)"/);
  const jsMatch = text.match(/"js"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:css|html|explanation)"/);
  const explMatch = text.match(/"explanation"\s*:\s*"([\s\S]*?)"/);

  if (htmlMatch) {
    const rawH = htmlMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    const rawC = cssMatch ? cssMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
    const rawJ = jsMatch ? jsMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
    const cleaned = cleanHtmlExtractAssets(rawH, rawC, rawJ);

    return {
      explanation: explMatch ? explMatch[1] : 'Página gerada pela IA.',
      html: cleaned.html,
      css: cleaned.css,
      js: cleaned.js
    };
  }

  throw new Error('Falha ao processar resposta JSON da IA.');
}

export interface AttachedFile {
  name: string;
  type: string;
  data: string; // Base64 ou texto plano
  isImage?: boolean;
}

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
  const activeKey = customApiKey || process.env.GEMINI_API_KEY;
  const proxyUrl = isValidHttpUrl(customProxyUrl) ? customProxyUrl!.trim() : defaultProxyUrl;

  let candidateModels: string[] = [];
  if (registeredModels && Array.isArray(registeredModels) && registeredModels.length > 0) {
    candidateModels = [...registeredModels];
    if (customModel && !candidateModels.includes(customModel)) {
      candidateModels.unshift(customModel);
    }
  } else if (customModel) {
    candidateModels = [customModel];
  } else {
    candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-pro'];
  }

  // Monta as diretrizes de Skills Ativas
  let skillsDirective = '';
  if (customSkills && customSkills.length > 0) {
    const activeSkills = customSkills.filter(s => s.enabled !== false);
    if (activeSkills.length > 0) {
      skillsDirective = `
    DIRETRIZES TÉCNICAS E SKILLS DE DESIGN AVANÇADAS ATIVAS (OBRIGATÓRIO INCORPORAR):
    ${activeSkills.map((s, idx) => `${idx + 1}. [SKILL: ${s.name.toUpperCase()}]:\n${s.promptSnippet}`).join('\n\n')}
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

  // Timeout por requisição para evitar que a IA fique pendurada se o upstream demorar
  const REQUEST_TIMEOUT_MS = 30000;

  for (let i = 0; i < candidateModels.length; i++) {
    const modelToTry = candidateModels[i];
    if (onModelAttempt) {
      onModelAttempt(modelToTry, i + 1, candidateModels.length);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const isGemini25 = modelToTry.includes('2.5') || modelToTry.includes('2.0');
      
      const generationConfig: any = {
        responseMimeType: 'application/json',
        temperature: 0.35,
        topP: 0.95,
        maxOutputTokens: 8192
      };

      if (isGemini25) {
        // Desativa 'thinking' para respostas instantâneas sem latência de raciocínio desnecessária
        generationConfig.thinkingConfig = {
          thinkingBudget: 0
        };
      }

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

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${activeKey}`;

      const response = await undiciFetch(apiUrl, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const resJson: any = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

      const parsed = resilientJsonParse(rawText);
      parsed._usedModel = modelToTry;
      return parsed;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn(`[AI Engine] Tentativa com o modelo ${modelToTry} (${i + 1}/${candidateModels.length}) falhou:`, error.message);
      lastError = error;
    }
  }

  console.error("Erro na API do Gemini em todos os modelos candidatos:", lastError);
  throw new Error(`Erro ao gerar resposta da IA: ${lastError?.message || 'Falha de conexão com a API do Gemini'}`);
};
