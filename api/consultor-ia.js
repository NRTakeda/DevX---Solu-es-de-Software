import { z } from 'zod';

// O schema de entrada do front-end não muda
const requestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(['user', 'model']),
      parts: z.array(z.object({ text: z.string() })),
    })
  ),
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Apenas o método POST é permitido.' });
  }

  const validation = requestSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({ message: 'Estrutura do histórico inválida.' });
  }

  // REVISADO: Buscando a nova chave de API
  const { history } = validation.data;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Chave de API da DeepSeek não configurada no servidor.' });
  }

  // REVISADO: Endpoint e modelo da DeepSeek
  const modelName = "deepseek-chat";
  const apiUrl = "https://api.deepseek.com/chat/completions";

  try {
    // REVISADO: O formato do corpo da requisição (payload) da DeepSeek
    // é diferente do Google. Precisamos transformar os dados.
    const messages = history.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user', // DeepSeek usa 'assistant' em vez de 'model'
        content: item.parts[0].text
    }));

    const payload = {
        model: modelName,
        messages: messages,
    };
    
    // REVISADO: A chamada fetch agora usa o cabeçalho "Authorization: Bearer"
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
    
    // REVISADO: O caminho para o texto da resposta é diferente na DeepSeek
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