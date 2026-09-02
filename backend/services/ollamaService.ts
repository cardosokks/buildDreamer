import { cleanHtmlExtractAssets, resilientJsonParse, extractHtmlFromRawText } from './gemini';

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export const RECOMMENDED_LOW_SPEC_MODELS = [
  { id: 'qwen2.5-coder:1.5b', name: 'Qwen 2.5 Coder (1.5B) - Ultra Leve & Rápido', vram: '~1.2 GB RAM', tag: 'Recomendado para PC Fraco' },
  { id: 'llama3.2:1b', name: 'Llama 3.2 (1B) - Mínimo Consumo', vram: '~1.0 GB RAM', tag: 'Ideal para Laptops Antigos' },
  { id: 'llama3.2:3b', name: 'Llama 3.2 (3B) - Equilíbrio Perfeito', vram: '~2.5 GB RAM', tag: 'Ótima Qualidade' },
  { id: 'deepseek-r1:1.5b', name: 'DeepSeek R1 (1.5B) - Raciocínio Leve', vram: '~1.3 GB RAM', tag: 'Raciocínio Rápido' },
  { id: 'gemma2:2b', name: 'Gemma 2 (2B) - Google Compact', vram: '~1.8 GB RAM', tag: 'Boa Criatividade' },
  { id: 'mistral:7b', name: 'Mistral (7B) - Alta Fidelidade', vram: '~4.5 GB RAM', tag: 'Médio Porte' }
];

export async function testOllamaConnection(endpointUrl: string = 'http://localhost:11434'): Promise<{
  success: boolean;
  message: string;
  models?: OllamaModelInfo[];
  endpoint: string;
}> {
  let cleanUrl = (endpointUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${cleanUrl}/api/tags`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Bypass-Tunnel-Reminder': 'true'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 404 && errText.trim().startsWith('<')) {
        return {
          success: false,
          message: `A URL fornecida não parece ser do Ollama. Se você estiver usando o Ngrok, verifique se apontou para a porta 11434 e não para a porta do app.`,
          endpoint: cleanUrl
        };
      }
      return {
        success: false,
        message: `Ollama respondeu com status HTTP ${res.status}`,
        endpoint: cleanUrl
      };
    }

    const data: any = await res.json();
    const models: OllamaModelInfo[] = data.models || [];

    return {
      success: true,
      message: `Ollama conectado com sucesso! ${models.length} modelo(s) detectado(s).`,
      models,
      endpoint: cleanUrl
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Não foi possível conectar ao Ollama em ${cleanUrl}. Certifique-se de que o Ollama está rodando ('ollama serve') e com OLLAMA_ORIGINS="*" se estiver em porta remota.`,
      endpoint: cleanUrl
    };
  }
}

function handleOllamaErrorResponse(status: number, errText: string, model: string, endpoint: string): Error {
  const isHtml = errText.trim().startsWith('<') || errText.includes('<!DOCTYPE html>') || errText.includes('<html>');
  
  if (status === 502 || status === 503 || status === 504 || isHtml) {
    return new Error(
      `O serviço do Ollama local não está acessível (Status ${status}). ` +
      `Isso significa que o seu túnel de conexão (Ngrok/LocalTunnel) em "${endpoint}" está ativo, mas o servidor do Ollama local não respondeu.\n\n` +
      `Para resolver este problema de conexão na sua máquina local, siga estes passos:\n` +
      `1. Verifique se o aplicativo do Ollama está rodando no seu computador (com 'ollama serve' ou aberto em segundo plano).\n` +
      `2. No terminal local, garanta que o modelo está instalado rodando: "ollama run ${model}"\n` +
      `3. Certifique-se de que o Ngrok está redirecionando para a porta correta do Ollama (11434). O comando recomendado é: "ngrok http 11434"\n` +
      `4. Atualize a URL do endpoint nas configurações se o Ngrok tiver sido reiniciado.`
    );
  }
  
  return new Error(`Ollama retornou status ${status}: ${errText.substring(0, 300)}`);
}

export async function generateOllamaResponse(
  prompt: string,
  context: { html: string; css: string; js: string },
  options: {
    endpointUrl?: string;
    model?: string;
    lowSpecMode?: boolean;
    skillsDirective?: string;
  } = {}
): Promise<{ explanation: string; html: string; css: string; js: string; _usedModel: string; _usedProvider: string }> {
  let cleanUrl = (options.endpointUrl || process.env.OLLAMA_HOST || 'http://localhost:11434').trim().replace(/\/+$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }

  const model = options.model || 'qwen2.5-coder:1.5b';
  const isLowSpec = options.lowSpecMode !== false; // Default true para proteger PCs modestos

  // Detectar se o modelo é um modelo de raciocínio/thinking para evitar conflito com format: 'json' do Ollama
  const modelLower = model.toLowerCase();
  const isReasoningModel = modelLower.includes('r1') || 
                           modelLower.includes('deepseek') || 
                           modelLower.includes('think') || 
                           modelLower.includes('reasoning') ||
                           modelLower.includes('qwen3.5');

  const useJsonFormat = !isReasoningModel;

  // Prompt simplificado e ultra conciso para modelos leves de 1B a 7B
  const systemPrompt = `Você é um Engenheiro Frontend especialista em Tailwind CSS e design moderno.
Sua missão: Modificar ou gerar o código da página web conforme o pedido do usuário.

REGRAS:
1. Retorne um JSON válido contendo exatamente as chaves:
{
  "explanation": "Breve resumo em português do que foi feito.",
  "html": "<código HTML com classes Tailwind sem tags style ou script>",
  "css": "/* CSS customizado opcional */",
  "js": "// JS interativo opcional"
}
2. O HTML deve ser limpo, moderno, responsivo e com classes Tailwind CSS.
${isReasoningModel ? '3. Você pode usar pensamento/raciocínio antes, mas certifique-se de que sua saída final contenha o objeto JSON completo com essas chaves.' : ''}
${options.skillsDirective ? `\nDIRETRIZES EXTRAS:\n${options.skillsDirective}` : ''}`;

  // Se o contexto for muito grande em PC fraco, encurtamos ligeiramente para economizar memória VRAM
  let contextHtml = context.html || '';
  let contextCss = context.css || '';
  let contextJs = context.js || '';

  if (isLowSpec && contextHtml.length > 10000) {
    contextHtml = contextHtml.slice(0, 10000) + '\n<!-- [Conteúdo truncado para economia de memória] -->';
  }

  const userPrompt = `Contexto atual da página:
HTML:
${contextHtml}

CSS:
${contextCss}

JS:
${contextJs}

Pedido de alteração:
${prompt}

Retorne exclusivamente o objeto JSON com "explanation", "html", "css", "js".`;

  const controller = new AbortController();
  // 360s (6 minutos) de timeout para modelos locais complexos em CPU
  const timeoutId = setTimeout(() => controller.abort(), 360000);

  try {
    // Usando /api/chat como principal por preservar os templates de chat do Ollama
    const chatRequestBody = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      ...(useJsonFormat ? { format: 'json' } : {}),
      options: {
        temperature: isLowSpec ? 0.2 : 0.4,
        top_p: 0.9,
        num_predict: isLowSpec ? 3072 : 4096,
        num_ctx: isLowSpec ? 8192 : 16384,
        num_thread: 4
      }
    };

    let response = await fetch(`${cleanUrl}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify(chatRequestBody),
      signal: controller.signal
    });

    let rawResponse = '';

    if (response.status === 404) {
      console.log('[OllamaService] /api/chat retornou 404. Fazendo fallback para /api/generate...');
      const generateRequestBody = {
        model,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        ...(useJsonFormat ? { format: 'json' } : {}),
        options: chatRequestBody.options
      };

      const genResponse = await fetch(`${cleanUrl}/api/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Bypass-Tunnel-Reminder': 'true'
        },
        body: JSON.stringify(generateRequestBody),
        signal: controller.signal
      });

      if (!genResponse.ok) {
        const errText = await genResponse.text().catch(() => '');
        throw handleOllamaErrorResponse(genResponse.status, errText, model, cleanUrl);
      }

      const genData: any = await genResponse.json();
      rawResponse = genData.response || '';
    } else if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw handleOllamaErrorResponse(response.status, errText, model, cleanUrl);
    } else {
      const chatData: any = await response.json();
      rawResponse = chatData.message?.content || chatData.response || '';
    }

    clearTimeout(timeoutId);

    let parsed: any;
    try {
      parsed = resilientJsonParse(rawResponse);
    } catch (parseErr) {
      console.warn('[OllamaService] resilientJsonParse falhou, usando extrator de HTML robusto. Erro:', parseErr);
      const extractedHtml = extractHtmlFromRawText(rawResponse);
      parsed = {
        explanation: 'Código atualizado pelo modelo local Ollama.',
        html: extractedHtml || rawResponse.replace(/```(?:html|json)?/gi, '').replace(/```/g, '').trim(),
        css: '',
        js: ''
      };
    }

    const cleaned = cleanHtmlExtractAssets(parsed.html || '', parsed.css || '', parsed.js || '');

    if (!cleaned.html || cleaned.html.trim().length < 15) {
      // Se ainda estiver vazio ou muito curto, tentamos um último esforço: usar extractHtmlFromRawText diretamente na resposta bruta
      const lastResortHtml = extractHtmlFromRawText(rawResponse);
      const lastResortCleaned = cleanHtmlExtractAssets(lastResortHtml);
      if (lastResortCleaned.html && lastResortCleaned.html.trim().length >= 15) {
        cleaned.html = lastResortCleaned.html;
        cleaned.css = lastResortCleaned.css || cleaned.css;
        cleaned.js = lastResortCleaned.js || cleaned.js;
      } else {
        console.error('[OllamaService] Resposta bruta recebida do Ollama:', rawResponse);
        throw new Error(`O modelo local Ollama (${model}) retornou uma resposta com código HTML vazio ou inválido.`);
      }
    }

    return {
      explanation: parsed.explanation || 'Alterações aplicadas com sucesso pelo modelo local Ollama.',
      html: cleaned.html,
      css: cleaned.css,
      js: cleaned.js,
      _usedModel: model,
      _usedProvider: 'ollama'
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      throw new Error(
        `O Ollama excedeu o limite de tempo de 6 minutos gerando com o modelo "${model}". ` +
        `Modelos como o qwen3.5:4b exigem bastante processamento e podem demorar mais se estiverem rodando apenas na CPU. ` +
        `Recomendamos: 1) Usar um modelo mais leve como "qwen2.5-coder:1.5b", 2) Ativar o "Modo de Baixo Desempenho" nas configurações, ou 3) Configurar aceleração por GPU no seu Ollama local.`
      );
    }
    throw new Error(`Erro ao processar com Ollama (${model}): ${error.message}`);
  }
}
