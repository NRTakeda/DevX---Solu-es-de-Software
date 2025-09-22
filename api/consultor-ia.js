// /api/consultor-ia.js (Versão Conversacional)
import { z } from 'zod';

// Não precisamos mais do rate-limit aqui, pois o front-end controlará o fluxo.
// A Vercel já tem proteção contra abuso no plano Hobby.

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

  const modelName = "gemini-1.5-flash"; // Usamos o modelo mais rápido para uma conversa fluida
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
    const candidate = result.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
        throw new Error("A resposta da IA veio em um formato inesperado ou vazia.");
    }
    const text = candidate.content.parts[0].text;

    return response.status(200).json({ result: text });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: 'Ocorreu um erro ao processar sua solicitação.' });
  }
}
