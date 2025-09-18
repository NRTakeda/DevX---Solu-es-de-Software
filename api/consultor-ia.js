import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const iaSchema = z.object({
  description: z.string().min(10, { message: 'A descrição deve ter pelo menos 10 caracteres.' }).max(2000),
});

const applyMiddleware = middleware => (request, response) =>
  new Promise((resolve, reject) => {
    middleware(request, response, result =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });

const keyGenerator = (request) => {
    return request.headers['x-forwarded-for']?.split(',').shift() 
        || request.headers['x-vercel-forwarded-for'] 
        || '127.0.0.1';
};

const limiter = rateLimit({
	windowMs: 10 * 60 * 1000, 
	max: 5, 
	message: { message: 'Muitas requisições. Tente novamente mais tarde.' },
    standardHeaders: true, 
    legacyHeaders: false, 
    keyGenerator: keyGenerator,
});

export default async function handler(request, response) {
  try {
    await applyMiddleware(limiter)(request, response);
  } catch (e) {
    return response.status(429).json({ message: 'Muitas requisições. Tente novamente mais tarde.' });
  }
  
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Apenas o método POST é permitido.' });
  }
  
  const validation = iaSchema.safeParse(request.body);
  if (!validation.success) {
    const errors = validation.error.format();
    return response.status(400).json({ message: errors.description?._errors[0] || 'Descrição inválida.' });
  }

  const { description } = validation.data;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ message: 'Chave de API não configurada no servidor.' });
  }

  const modelName = "gemini-1.5-flash";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `Você é um consultor de projetos de software. Um cliente descreveu a ideia: "${description}". Analise e faça o seguinte: 1. Recomende o tipo de solução de software mais adequada (ex: Plataforma Web customizada, E-commerce de alta performance, API robusta, etc.). 2. Liste 3 vantagens que esta solução trará, focando em tecnologia, escalabilidade e experiência do usuário. Termine com um apelo à ação, como 'Gostou da sugestão? Podemos desenvolver este projeto para você. Vamos conversar!'. Formate a resposta em Markdown com um título (####), um subtítulo (#####), e uma lista (>>>).`;

  try {
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    
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
    const text = result.candidates[0]?.content?.parts[0]?.text;

    if (!text) {
        throw new Error("Não foi possível gerar uma análise. Tente descrever sua ideia de outra forma.");
    }

    return response.status(200).json({ result: text });

  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: 'Ocorreu um erro ao processar sua solicitação.' });
  }
}