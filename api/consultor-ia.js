import { z } from 'zod';
import { RateLimiterPostgres } from 'rate-limiter-flexible';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO RATE LIMITER COM SUPABASE (POSTGRES) ---

const pool = new Pool({
  // REVISÃO FINAL: Usando a URL do Prisma fornecida pela integração.
  // Esta é a nossa tentativa final para resolver o problema de conexão.
  connectionString: process.env.POSTGRES_PRISMA_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const rateLimiterOptions = {
  storeClient: pool,
  tableName: 'rate_limits',
  keyPrefix: 'ia_chat_limiter',
};

// Limiter para usuários anônimos (identificados por IP)
const limiterAnon = new RateLimiterPostgres({
  ...rateLimiterOptions,
  points: 2,
  duration: 60 * 60 * 24,
});

// Limiter para usuários autenticados (identificados por User ID)
const limiterAuth = new RateLimiterPostgres({
  ...rateLimiterOptions,
  points: 30,
  duration: 60 * 3,
});

async function getUserIdFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
        const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
        const { data: { user } } = await supabase.auth.getUser(token);
        return user ? user.id : null;
    } catch (error) {
        console.error("Erro ao validar token JWT:", error);
        return null;
    }
}

// --- LÓGICA DA API ---
// (O restante do arquivo permanece o mesmo)

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

const complexSystemPrompt = `Você é o "DevX Consultant"...`; // Seu prompt completo aqui

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Apenas o método POST é permitido.' });
  }

  try {
    const authHeader = request.headers.authorization;
    const userId = await getUserIdFromToken(authHeader);
    const ip = request.headers['x-forwarded-for']?.split(',').shift() || request.socket.remoteAddress;

    if (userId) {
      await limiterAuth.consume(userId);
    } else {
      await limiterAnon.consume(ip);
    }
  } catch (rateLimiterRes) {
    return response.status(429).json({ message: 'Limite de uso atingido. Tente novamente mais tarde.' });
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

    const payload = {
        model: modelName,
        messages: messages,
        max_tokens: 250
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