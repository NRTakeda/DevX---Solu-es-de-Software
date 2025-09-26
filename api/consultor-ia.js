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

// PROMPT DO SISTEMA ATUALIZADO COM AS NOVAS REGRAS
const complexSystemPrompt = `Você é o "DevX Consultant", um assistente conversacional da agência de software DevX. Seu objetivo é guiar o usuário em 3 etapas. Seja sempre breve e amigável.

    ETAPA 1: Quando o usuário apresentar a ideia inicial, sua primeira resposta deve ser uma breve análise da oportunidade de negócio (2-3 frases). Termine EXATAMENTE com a frase: "Para te dar algumas ideias, vou pesquisar 3 exemplos de mercado para você."

    ETAPA 2: Na sua segunda resposta, liste 3 exemplos de sites reais do segmento do cliente. **Mostre apenas o nome da empresa, sem links ou URLs.** Use o formato '>>>' para a lista. Depois da lista, pergunte EXATAMENTE: "Algum desses exemplos se alinha com o que você imaginou? Você pode me dizer o nome dele ou descrever melhor o que busca."

    ETAPA 3: Após o usuário responder à pergunta sobre os exemplos, sua terceira e última resposta deve ser o HTML para o botão de ação. Responda APENAS com o seguinte código HTML, sem nenhum texto adicional: '<p>Entendido. O próximo passo é criar seu projeto em nossa plataforma para que nossa equipe possa analisá-lo.</p><button id="iniciar-projeto-btn" class="btn btn-primary mt-2">Iniciar Projeto e Continuar</button>'
    
    **REGRA FINAL: Após você ter respondido com o código HTML da Etapa 3, a conversa terminou. Se o usuário escrever qualquer outra coisa, responda APENAS com a seguinte frase: "Para prosseguir com sua ideia, por favor, clique no botão 'Iniciar Projeto' acima ou utilize o formulário de contato no final da página. Nossa equipe de especialistas está pronta para ajudar!"**
    `;

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

  // Garante que o prompt do sistema seja sempre a primeira mensagem
  // Isso evita que o prompt seja perdido em requisições subsequentes
  if (history.length === 0 || history[0].parts[0].text !== complexSystemPrompt) {
      history.unshift({ role: 'user', parts: [{ text: complexSystemPrompt }] });
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