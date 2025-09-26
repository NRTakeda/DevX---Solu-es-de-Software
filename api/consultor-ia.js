import { z } from 'zod';

// Schema para validar a entrada do front-end, com limite de 1000 caracteres na pergunta
const requestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ 
        text: z.string().max(1000, { message: 'Sua mensagem é muito longa. Por favor, seja mais conciso.' }) 
      })),
    })
  ),
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Apenas o método POST é permitido.' });
  }

  const validation = requestSchema.safeParse(request.body);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message || 'Dados de entrada inválidos.';
    return response.status(400).json({ message: firstError });
  }

  const { history } = validation.data;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Chave de API da DeepSeek não configurada no servidor.' });
  }

  const modelName = "deepseek-chat";
  const apiUrl = "https://api.deepseek.com/chat/completions";

  try {
    // A API da DeepSeek (e OpenAI) usa um formato de 'messages' diferente do Gemini.
    // Este código faz a "tradução" do formato do seu front-end para o formato que a DeepSeek espera.
    const messages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', // DeepSeek usa 'assistant' em vez de 'model'
        content: item.parts[0].text
    }));

    const payload = {
        model: modelName,
        messages: messages,
        // Limite de segurança para o tamanho da resposta da IA, para controlar custos.
        max_tokens: 250 
    };
    
    const deepseekResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}` // DeepSeek usa autenticação "Bearer"
        },
        body: JSON.stringify(payload)
    });

    if (!deepseekResponse.ok) {
        const errorBody = await deepseekResponse.json();
        console.error("Erro detalhado da DeepSeek:", errorBody);
        throw new Error(`Erro na API da DeepSeek: ${deepseekResponse.statusText}`);
    }

    const result = await deepseekResponse.json();
    
    if (!result.choices || result.choices.length === 0 || !result.choices[0].message) {
        console.warn("Resposta da IA da DeepSeek veio em formato inesperado:", result);
        throw new Error("A IA não forneceu uma resposta.");
    }

    // A resposta da DeepSeek vem em um caminho diferente do Gemini
    const text = result.choices[0].message.content;

    return response.status(200).json({ result: text });

  } catch (error) {
    console.error("Erro na API da DeepSeek:", error);
    return response.status(500).json({ message: error.message || 'Ocorreu um erro ao processar sua solicitação.' });
  }
}