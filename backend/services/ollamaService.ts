import { cleanHtmlExtractAssets } from './gemini';

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
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
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

  // Prompt simplificado e ultra conciso para modelos leves de 1B a 7B
  const systemPrompt = `Você é um Engenheiro Frontend especialista em Tailwind CSS e design moderno.
Sua missão: Modificar ou gerar o código da página web conforme o pedido do usuário.

REGRAS:
1. Retorne APENAS um JSON válido no formato:
{
  "explanation": "Breve resumo em português do que foi feito.",
  "html": "<código HTML com classes Tailwind sem tags style ou script>",
  "css": "/* CSS customizado opcional */",
  "js": "// JS interativo opcional"
}
2. O HTML deve ser limpo, moderno, responsivo e com classes Tailwind CSS.
${options.skillsDirective ? `\nDIRETRIZES EXTRAS:\n${options.skillsDirective}` : ''}`;

  // Se o contexto for muito grande em PC fraco, encurtamos ligeiramente para economizar memória VRAM
  let contextHtml = context.html || '';
  let contextCss = context.css || '';
  let contextJs = context.js || '';

  if (isLowSpec && contextHtml.length > 15000) {
    contextHtml = contextHtml.slice(0, 15000) + '\n<!-- [Conteúdo truncado para economia de memória] -->';
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

  const requestBody = {
    model,
    system: systemPrompt,
    prompt: userPrompt,
    stream: false,
    format: 'json',
    options: {
      temperature: isLowSpec ? 0.2 : 0.4,
      top_p: 0.9,
      num_predict: isLowSpec ? 3072 : 4096,
      num_ctx: isLowSpec ? 4096 : 8192,
      num_thread: 4
    }
  };

  const controller = new AbortController();
  // 120s de timeout para modelos locais em CPU mais lentas
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${cleanUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama HTTP ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    const rawResponse = data.response || '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      // Fallback para extração de JSON em blocos markdown ou texto
      const firstBrace = rawResponse.indexOf('{');
      const lastBrace = rawResponse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(rawResponse.slice(firstBrace, lastBrace + 1));
        } catch {}
      }
    }

    if (!parsed || (!parsed.html && !parsed.explanation)) {
      // Se o modelo 1B gerou HTML direto sem wrapper JSON:
      parsed = {
        explanation: 'Código atualizado pelo modelo local Ollama.',
        html: rawResponse.replace(/```(?:html|json)?/gi, '').replace(/```/g, '').trim(),
        css: '',
        js: ''
      };
    }

    const cleaned = cleanHtmlExtractAssets(parsed.html || '', parsed.css || '', parsed.js || '');

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
    throw new Error(`Erro ao processar com Ollama (${model}): ${error.message}`);
  }
}
