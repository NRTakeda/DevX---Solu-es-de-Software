import { z } from 'zod';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from '@vercel/kv';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO RATE LIMITER COM VERCEL KV (REDIS) ---

const redisClient = createClient({
  url: process.env.KV_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const rateLimiterOptions = {
  storeClient: redisClient,
  keyPrefix: 'ia_chat_limiter',
};

const limiterAnon = new RateLimiterRedis({
  ...rateLimiterOptions,
  points: 2,
  duration: 60 * 60 * 24, // 24 horas
});

const limiterAuth = new RateLimiterRedis({
  ...rateLimiterOptions,
  points: 30,
  duration: 60 * 3, // 3 minutos
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

const complexSystemPrompt = `Você é o "DevX Consultant". Guie o usuário em 3 etapas, de forma breve.
ETAPA 1: Ao receber a ideia, faça uma análise de negócio de 2 frases e termine com a frase exata: "Para te dar algumas ideias, vou pesquisar 3 exemplos de mercado para você."
ETAPA 2: Na sua segunda resposta, liste 3 nomes de empresas reais do segmento, sem URLs, usando '>>>' na lista. Termine com a pergunta exata: "Algum desses exemplos se alinha com o que você imaginou? Você pode me dizer o nome dele ou descrever melhor o que busca."
ETAPA 3: Após a resposta do usuário, responda APENAS com este HTML: '<p>Entendido. O próximo passo é criar seu projeto em nossa plataforma para que nossa equipe possa analisá-lo.</p><button id="iniciar-projeto-btn" class="btn btn-primary mt-2">Iniciar Projeto e Continuar</button>'
REGRA FINAL: Após a Etapa 3, se o usuário continuar, responda APENAS: "Para prosseguir com sua ideia, por favor, clique no botão 'Iniciar Projeto' acima ou utilize o formulário de contato no final da página. Nossa equipe de especialistas está pronta para ajudar!"`;

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