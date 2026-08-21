"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIResponse = void 0;
const genai_1 = require("@google/genai");
const apiKey = process.env.GEMINI_API_KEY;
const generateAIResponse = async (prompt, context, customApiKey, customModel, registeredModels, onModelAttempt) => {
    const activeKey = customApiKey || apiKey;
    // Usa estritamente os modelos cadastrados nas configurações pelo usuário
    let candidateModels = [];
    if (registeredModels && Array.isArray(registeredModels) && registeredModels.length > 0) {
        candidateModels = [...registeredModels];
        if (customModel && !candidateModels.includes(customModel)) {
            candidateModels.unshift(customModel);
        }
    }
    else if (customModel) {
        candidateModels = [customModel];
    }
    else {
        candidateModels = ['gemini-2.5-flash'];
    }
    const systemPrompt = `
    Você é um Arquiteto de Software Frontend de Elite e Engenheiro de Design System especializado em ferramentas visuais No-Code / Code-generation (estilo Webflow, Framer, v0.dev e Tailwind UI).

    Sua missão é atuar como o AI Copilot do nosso Visual Website Builder.
    Você receberá um pedido em linguagem natural e o contexto atual da página:
    - HTML Atual
    - CSS Atual
    - JS Atual

    INSTRUÇÕES MANDATÓRIAS:
    1. Analise o pedido do usuário ("adicione uma hero section neon", "mude o título para azul", "crie uma tabela de preços responsiva", etc.).
    2. Modifique o HTML/CSS/JS com máxima excelência estética:
       - Use Tailwind CSS moderno, gradientes sutis, glassmorphism e design limpo.
       - Garanta que o layout seja 100% responsivo para mobile (375px) e desktop (1280px).
       - Mantenha IDs e classes semânticas.
       - Preserve o container <div id="canvas-root"> como nó raiz do conteúdo.
    3. Retorne SEMPRE um objeto JSON estrito com o código completo atualizado e uma explicação amigável do que foi feito.

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
    const ai = new genai_1.GoogleGenAI({ apiKey: activeKey });
    let lastError = null;
    for (let i = 0; i < candidateModels.length; i++) {
        const modelToTry = candidateModels[i];
        if (onModelAttempt) {
            onModelAttempt(modelToTry, i + 1, candidateModels.length);
        }
        try {
            const response = await ai.models.generateContent({
                model: modelToTry,
                contents: [
                    { role: 'system', parts: [{ text: systemPrompt }] },
                    {
                        role: 'user',
                        parts: [
                            { text: `Contexto do site:\nHTML: ${context.html}\nCSS: ${context.css}\nJS: ${context.js}\n\nPedido do Usuário: ${prompt}` }
                        ]
                    }
                ],
                config: {
                    responseMimeType: 'application/json'
                }
            });
            let text = response.text || '{}';
            // Extract strictly the JSON object between first { and last } to avoid trailing commentary or tokens
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                text = text.slice(firstBrace, lastBrace + 1);
            }
            else {
                text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            }
            let parsed;
            try {
                parsed = JSON.parse(text);
            }
            catch (parseErr) {
                // Fallback: replace common invalid escape characters in large HTML/JS blobs
                const sanitized = text
                    .replace(/\\n/g, "\\n")
                    .replace(/\\'/g, "\\'")
                    .replace(/\\"/g, '\\"')
                    .replace(/\\&/g, "\\&")
                    .replace(/\\r/g, "\\r")
                    .replace(/\\t/g, "\\t")
                    .replace(/\\b/g, "\\b")
                    .replace(/\\f/g, "\\f");
                parsed = JSON.parse(sanitized);
            }
            parsed._usedModel = modelToTry;
            return parsed;
        }
        catch (error) {
            console.warn(`[Cascata IA] Tentativa com o modelo ${modelToTry} (${i + 1}/${candidateModels.length}) falhou:`, error.message);
            lastError = error;
            // Continue to next candidate model
        }
    }
    console.error("Erro na API do Gemini em todos os modelos candidatos:", lastError);
    throw new Error(`Erro ao gerar resposta da IA: ${lastError?.message || 'Cota esgotada em todos os modelos cadastrados'}`);
};
exports.generateAIResponse = generateAIResponse;
