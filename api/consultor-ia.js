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

  // --- MELHORIA 1: MUDANÇA PARA O MODELO PRO ---
  const modelName = "gemini-1.5-pro-latest";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // --- MELHORIA 2: NOVO PROMPT REFINADO ---
  const prompt = `Você é o "DevX Consultant", um consultor de negócios digitais da agência de software DevX. Sua especialidade é traduzir ideias de negócio em estratégias de produto digital. EVITE jargões técnicos. Sua linguagem deve ser clara, profissional e focada em benefícios de negócio.

Um cliente descreveu a ideia: "${description}"

Sua tarefa é criar uma mini-apresentação estratégica para este cliente. Siga estritamente a estrutura abaixo, usando os títulos em negrito como estão:

**Análise da Oportunidade**
(Faça uma breve análise da ideia como uma oportunidade de negócio digital.)

**Exemplos de Mercado**
(Pesquise e liste 3 exemplos de sites ou plataformas REAIS e ESPECÍFICOS que atuam em um segmento similar. Não descreva categorias genéricas. Ex: se a ideia é uma farmácia online, cite "Droga Raia", "Onofre", etc.)

**Nossa Proposta de Solução**
(Descreva a solução digital que a DevX construiria, focando nos benefícios para o negócio do cliente. Ex: "Construiríamos uma plataforma de E-commerce intuitiva que permitiria aos seus clientes comprar com facilidade e agendar entregas...")

**Vantagens Estratégicas**
(Liste 3 vantagens de negócio que nossa solução traria. Ex: "Fidelização de Clientes", "Otimização de Processos", "Expansão de Mercado".)

**Próximo Passo**
(Gere o seguinte texto e botão em HTML, sem usar markdown: '<p>Gostou da proposta? O próximo passo é criar seu projeto em nossa plataforma para que nossa equipe possa analisá-lo.</p><button id="iniciar-projeto-btn" class="btn btn-primary mt-2">Iniciar Projeto e Continuar</button>')`;

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