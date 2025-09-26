import { z } from 'zod';

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

  const { history } = validation.data;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Chave de API não configurada no servidor.' });
  }

  // REVISADO: Trocado para o modelo estável e amplamente disponível 'gemini-pro'.
  const modelName = "gemini-pro";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    const payload = { contents: history };
    
    const geminiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.json();
        console.error("Erro detalhado do Google:", errorBody);
        throw new Error(`Erro na API do Gemini: ${geminiResponse.statusText}`);
    }

    const result = await geminiResponse.json();
    
    // Adicionando uma verificação extra para casos onde a IA pode se recusar a responder
    if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content) {
        console.warn("Resposta da IA bloqueada ou vazia:", result);
        throw new Error("A IA não forneceu uma resposta. Tente reformular sua pergunta.");
    }

    const text = result.candidates[0].content.parts[0].text;

    return response.status(200).json({ result: text });

  } catch (error) {
    console.error("Erro na API do Gemini:", error);
    return response.status(500).json({ message: error.message || 'Ocorreu um erro ao processar sua solicitação.' });
  }
}