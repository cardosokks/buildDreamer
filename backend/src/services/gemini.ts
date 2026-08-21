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
 * Tenta fazer o parse de JSON de forma ultra resiliente mesmo se houver caracteres de controle / quebras de linha não escapadas
 */
function resilientJsonParse(rawString: string): any {
  let text = rawString.trim();

  // Remove marcações markdown ```json ... ```
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  // Tenta parse direto
  try {
    return JSON.parse(text);
  } catch {}

  // Localiza o bloco JSON mais externo
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const trimmed = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(trimmed);
    } catch {}
  }

  // Se ainda falhou, extrai campos html, css, js ou explanation via regex
  const htmlMatch = text.match(/"html"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:css|js|explanation)"/);
  const cssMatch = text.match(/"css"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:js|html|explanation)"/);
  const jsMatch = text.match(/"js"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:css|html|explanation)"/);
  const explMatch = text.match(/"explanation"\s*:\s*"([\s\S]*?)"/);

  if (htmlMatch) {
    return {
      explanation: explMatch ? explMatch[1] : 'Página gerada pela IA.',
      html: htmlMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
      css: cssMatch ? cssMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '',
      js: jsMatch ? jsMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : ''
    };
  }

  throw new Error('Falha ao processar resposta JSON da IA.');
}

export const generateAIResponse = async (
  prompt: string, 
  context: { html: string; css: string; js: string },
  customApiKey?: string,
  customModel?: string,
  registeredModels?: string[],
  onModelAttempt?: (model: string, index: number, total: number) => void,
  customProxyUrl?: string
) => {
  const activeKey = customApiKey || process.env.GEMINI_API_KEY;
  const proxyUrl = isValidHttpUrl(customProxyUrl) ? customProxyUrl!.trim() : defaultProxyUrl;

  // Modelos candidatos em cascata ultra-rápidos
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

  const systemPrompt = `
    Você é um Arquiteto de Software Frontend de Elite e Engenheiro de Design System especializado em ferramentas visuais No-Code / Code-generation (estilo Webflow, Framer, v0.dev e Tailwind UI).

    Sua missão é atuar como o AI Copilot do nosso Visual Website Builder.
    Você receberá um pedido em linguagem natural e o contexto atual da página:
    - HTML Atual
    - CSS Atual
    - JS Atual

    INSTRUÇÕES MANDATÓRIAS:
    1. Modifique o HTML/CSS/JS com máxima excelência estética:
       - Use Tailwind CSS moderno, gradientes sutis, glassmorphism e design limpo.
       - Garanta que o layout seja 100% responsivo para mobile (375px) e desktop (1280px).
       - Mantenha IDs e classes semânticas.
       - Preserve o container <div id="canvas-root"> como nó raiz do conteúdo.
    2. Retorne SEMPRE um objeto JSON estrito com o código completo atualizado e uma explicação amigável do que foi feito.

    Formato da Resposta JSON OBRIGATÓRIO:
    {
      "explanation": "Breve resumo técnico e amigável das alterações aplicadas.",
      "html": "<código HTML completo e atualizado>",
      "css": "/* CSS customizado adicional se necessário */",
      "js": "// JavaScript interativo se necessário"
    }
  `;

  if (!activeKey) {
    throw new Error("Chave da API do Gemini não fornecida. Configure-a no menu de configurações do sistema ou no backend.");
  }

  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const modelToTry = candidateModels[i];
    if (onModelAttempt) {
      onModelAttempt(modelToTry, i + 1, candidateModels.length);
    }

    try {
      const isGemini25 = modelToTry.includes('2.5') || modelToTry.includes('2.0');
      
      const generationConfig: any = {
        responseMimeType: 'application/json',
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 8192
      };

      if (isGemini25) {
        generationConfig.thinkingConfig = {
          thinkingBudget: 0
        };
      }

      const payload: any = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${systemPrompt}\n\nContexto do site:\nHTML: ${context.html}\nCSS: ${context.css}\nJS: ${context.js}\n\nPedido do Usuário: ${prompt}`
              }
            ]
          }
        ],
        generationConfig
      };

      const fetchOptions: any = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      };

      if (proxyUrl) {
        fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
      }

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${activeKey}`;

      const response = await undiciFetch(apiUrl, fetchOptions);

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
      console.warn(`[AI Engine] Tentativa com o modelo ${modelToTry} (${i + 1}/${candidateModels.length}) falhou:`, error.message);
      lastError = error;
    }
  }

  console.error("Erro na API do Gemini em todos os modelos candidatos:", lastError);
  throw new Error(`Erro ao gerar resposta da IA: ${lastError?.message || 'Falha de conexão com a API do Gemini'}`);
};
