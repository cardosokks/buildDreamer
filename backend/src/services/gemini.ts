import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

export const generateAIResponse = async (
  prompt: string, 
  context: { html: string; css: string; js: string },
  customApiKey?: string,
  customModel?: string
) => {
  const activeKey = customApiKey || apiKey;
  const activeModel = customModel || 'gemini-3.5-flash';

  if (!activeKey) {
    throw new Error("Chave da API do Gemini não fornecida. Configure-a no menu de configurações do sistema ou no backend.");
  }

  const ai = new GoogleGenAI({ apiKey: activeKey });

  const systemPrompt = `
    Você é um assistente de desenvolvimento web especialista em frontend.
    Você receberá um pedido em linguagem natural e o contexto atual do site:
    - HTML Atual
    - CSS Atual
    - JS Atual

    Você DEVE retornar os arquivos inteiros (HTML, CSS e JS) completamente reescritos e editados com a mudança solicitada. Não retorne comandos de alteração pontuais, retorne o código completo final já modificado.

    REGRAS DE ESTILIZAÇÃO E DESIGN:
    - Se o usuário ou o site solicitar um widget de chat do WhatsApp ou botão de contato flutuante, você deve OBRIGATORIAMENTE estilizar esses componentes usando tons de vermelho (ex: bg-red-600, bg-red-700, text-red-100) em vez do verde clássico do WhatsApp. Isso inclui o botão de gatilho flutuante, o cabeçalho do popup de chat e qualquer botão interno.

    Formato da Resposta JSON esperado:
    {
      "explanation": "Breve explicação das mudanças feitas",
      "html": "código HTML completo atualizado com a alteração",
      "css": "código CSS completo atualizado com a alteração",
      "js": "código JS completo atualizado com a alteração"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: activeModel,
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

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Erro na API do Gemini:", error);
    throw new Error(`Erro ao gerar resposta da IA: ${error.message}`);
  }
};
