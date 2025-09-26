import { z } from 'zod';
// ADICIONADO: Importando a biblioteca de rate limit
import rateLimit from 'express-rate-limit';

// ADICIONADO: Helper para usar middlewares do Express em funções da Vercel
const applyMiddleware = middleware => (request, response) =>
  new Promise((resolve, reject) => {
    middleware(request, response, result =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });

// ADICIONADO: Configuração do rate limiter
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // Janela de 15 minutos
	max: 30, // Permite 30 requisições a cada 15 minutos por IP (suficiente para uma conversa)
	message: { message: 'Muitas requisições. Por favor, aguarde um pouco.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (request) => { // Importante para Vercel
        return request.headers['x-forwarded-for']?.split(',').shift() 
            || request.headers['x-vercel-forwarded-for'] 
            || request.socket.remoteAddress;
    },
});

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
  // ADICIONADO: Aplica o middleware de rate limit no início da função
  try {
    await applyMiddleware(limiter)(request, response);
  } catch (error) {
    // A biblioteca já envia a resposta de erro 429, então só precisamos parar a execução
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Apenas o método POST é permitido.' });
  }

  const validation = requestSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({ message: 'Estrutura do histórico inválida.' });
  }

  const { history } = validation.data;
  // REVERTIDO: Buscando a chave de API do Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Chave de API do Gemini não configurada no servidor.' });
  }

  // REVERTIDO: Usando o modelo estável gemini-pro
  const modelName = "gemini-pro";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    // REVERTIDO: O payload para a API do Google Gemini
    const payload = { contents: history };
    
    const geminiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
        const errorBody = await geminiResponse.json();
        console.error("Erro detalhado do Google:", errorBody);
        throw new Error(`Erro na API do Gemini: ${geminiResponse.statusText}`);
    }

    const result = await geminiResponse.json();
    
    // REVERTIDO: O caminho para a resposta na API do Gemini
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