import { generateAIResponse, AttachedFile, DEFAULT_AI_SKILLS } from './gemini';
import { generateOllamaResponse } from './ollamaService';

export interface AIExecutionOptions {
  provider?: 'gemini' | 'ollama' | 'openai' | 'groq' | 'custom';
  apiKey?: string;
  model?: string;
  registeredModels?: string[];
  proxyUrl?: string;
  ollamaEndpoint?: string;
  lowSpecMode?: boolean;
  customSkills?: Array<{ id: string; name: string; promptSnippet: string; enabled: boolean }>;
  attachedFiles?: AttachedFile[];
  onProgress?: (info: { status: string; model?: string; provider?: string }) => void;
}

export async function executeAIRequest(
  prompt: string,
  context: { html: string; css: string; js: string },
  options: AIExecutionOptions = {}
): Promise<{
  explanation: string;
  html: string;
  css: string;
  js: string;
  _usedModel: string;
  _usedProvider: string;
}> {
  const provider = options.provider || (options.ollamaEndpoint ? 'ollama' : 'gemini');

  // Rota 1: Ollama Local / Remoto
  if (provider === 'ollama') {
    if (options.onProgress) {
      options.onProgress({
        status: 'processing',
        model: options.model || 'qwen2.5-coder:1.5b',
        provider: 'ollama'
      });
    }

    const skillsToUse = (options.customSkills && options.customSkills.length > 0)
      ? options.customSkills.filter(s => s.enabled !== false)
      : DEFAULT_AI_SKILLS;

    const skillsDirective = skillsToUse.map(s => `- ${s.name}: ${s.promptSnippet}`).join('\n');

    return await generateOllamaResponse(prompt, context, {
      endpointUrl: options.ollamaEndpoint,
      model: options.model || 'qwen2.5-coder:1.5b',
      lowSpecMode: options.lowSpecMode !== false,
      skillsDirective
    });
  }

  // Rota 2: Google Gemini (com fallback entre modelos)
  return await generateAIResponse(
    prompt,
    context,
    options.apiKey,
    options.model,
    options.registeredModels,
    (model, idx, total) => {
      if (options.onProgress) {
        options.onProgress({
          status: 'attempting',
          model,
          provider: 'gemini'
        });
      }
    },
    options.proxyUrl,
    options.customSkills,
    options.attachedFiles
  ).then(res => ({
    ...res,
    _usedProvider: 'gemini'
  }));
}
