import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO RATE LIMITER (VERSÃO SIMPLIFICADA) ---

const applyMiddleware = middleware => (request, response) =>
  new Promise((resolve, reject) => {
    middleware(request, response, result =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });

// Limiter para usuários anônimos (identificados por IP)
const limiterAnon = rateLimit({
	windowMs: 24 * 60 * 60 * 1000, // 24 horas
	max: 2, // 2 conversas (chamadas à API) por dia
	message: { message: 'Limite de uso para visitantes atingido. Por favor, crie uma conta ou tente novamente amanhã.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (request) => {
        return request.headers['x-forwarded-for']?.split(',').shift() 
            || request.headers['x-vercel-forwarded-for'] 
            || request.socket.remoteAddress;
    },
});

// Limiter para usuários autenticados (identificados por User ID)
const limiterAuth = rateLimit({
	windowMs: 3 * 60 * 1000, // 3 minutos
	max: 30, // 30 mensagens a cada 3 minutos
	message: { message: 'Limite de uso atingido. Tente novamente em alguns minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    // A chave será o ID do usuário, que definiremos dinamicamente
});


async function getUserIdFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
        const supabase = createSupabaseClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
        const { data: { user } } = await supabase.auth.getUser(token);
        return user ? user.id : null;
    } catch (error) {
        console.error("Erro ao validar token JWT:", error);
        return null;
    }
}

// --- LÓGICA DA API ---
const baseSchema = z.object({
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(z.object({ text: z.string() })),
  })),
});

const refinedSchema = baseSchema.refine(data => {
    const lastMessage = data.history.length > 0 ? data.history[data.history.length - 1] : null;
    if (lastMessage && lastMessage.role === 'user') {
        const userText = lastMessage.parts[0]?.text || '';
        return userText.length <= 1000;
    }
    return true;
}, { message: 'Sua mensagem é muito longa. Por favor, seja mais conciso.' });

const complexSystemPrompt = `Você é o "DevX Consultant"...`; // Seu prompt completo aqui

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Apenas o método POST é permitido.' });
  }

  const authHeader = request.headers.authorization;
  const userId = await getUserIdFromToken(authHeader);

  // Aplica o limiter correto com base no status do usuário
  if (userId) {
    // Para usuários logados, usamos o ID deles como chave
    request.rateLimit = { key: userId };
    await applyMiddleware(limiterAuth)(request, response);
  } else {
    // Para anônimos, a chave já é o IP (definido no keyGenerator)
    await applyMiddleware(limiterAnon)(request, response);
  }

  // Se a resposta já foi enviada pelo rate limiter, não continuamos
  if (response.headersSent) {
    return;
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

  const fullHistory = [{ role: 'user', parts: [{ text: complexSystemPrompt }] }, ...history];
  const modelName = "deepseek-chat";
  const apiUrl = "https://api.deepseek.com/chat/completions";

  try {
    const messages = fullHistory.map(item => ({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: item.parts[0].text
    }));
    const payload = { model: modelName, messages: messages, max_tokens: 250 };
    const deepseekResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload)
    });
    if (!deepseekResponse.ok) {
        const errorBody = await deepseekResponse.json();
        console.error("Erro detalhado da DeepSeek:", errorBody);
        throw new Error(`Erro na API da DeepSeek: ${deepseekResponse.statusText}`);
    }
    const result = await deepseekResponse.json();
    if (!result.choices || result.choices.length === 0 || !result.choices[0].message) {
        throw new Error("A IA não forneceu uma resposta.");
    }
    const text = result.choices[0].message.content;
    return response.status(200).json({ result: text });
  } catch (error) {
    console.error("Erro na API da DeepSeek:", error);
    return response.status(500).json({ message: error.message || 'Ocorreu um erro ao processar sua solicitação.' });
  }
}