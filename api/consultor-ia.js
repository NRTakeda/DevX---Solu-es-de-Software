import { z } from 'zod';

const baseSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ 
        text: z.string()
      })),
    })
  ),
});

const refinedSchema = baseSchema.refine(data => {
    const lastMessage = data.history.length > 0 ? data.history[data.history.length - 1] : null;
    if (lastMessage && lastMessage.role === 'user') {
        const userText = lastMessage.parts[0]?.text || '';
        return userText.length <= 1000;
    }
    return true;
}, {
    message: 'Sua mensagem é muito longa. Por favor, seja mais conciso.'
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Apenas o método POST é permitido.' });
  }

  const validation = refinedSchema.safeParse(request.body);
  if (!validation.success) {
    const errorMessage = validation.error.errors[0]?.message || 'Dados de entrada inválidos.';
    return response.status(400).json({ message: errorMessage });
  }

  let { history } = validation.data;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Chave de API da DeepSeek não configurada no servidor.' });
  }

  const modelName = "deepseek-chat";
  const apiUrl = "https://api.deepseek.com/chat/completions";

  try {
    const messages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.parts[0].text
    }));

    const payload = {
        model: modelName,
        messages: messages,
        max_tokens: 150
    };
    
    const deepseekResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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

    const text = result.choices[0].message.content;

    return response.status(200).json({ result: text });

  } catch (error) {
    console.error("Erro na API da DeepSeek:", error);
    return response.status(500).json({ message: error.message || 'Ocorreu um erro ao processar sua solicitação.' });
  }
}