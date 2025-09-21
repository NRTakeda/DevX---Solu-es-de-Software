// /api/verify-email.js (VERSÃO FINAL COM HUNTER.IO)
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email({ message: 'Formato de email inválido.' }),
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Método não permitido.' });
  }

  const validation = emailSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({ isValid: false, message: 'Formato de email inválido.' });
  }

  const { email } = validation.data;
  const apiKey = process.env.HUNTER_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ message: 'A chave da API de validação não está configurada.' });
  }

  try {
    const apiResponse = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${apiKey}`
    );
    const data = await apiResponse.json();

    // O Hunter pode retornar erros em um array `errors`
    if (data.errors && data.errors.length > 0) {
      console.error('Erro da API Hunter.io:', data.errors[0].details);
      // Em caso de erro (ex: chave inválida), não bloqueamos o usuário
      return response.status(200).json({ isValid: true, message: 'Serviço de verificação indisponível.' });
    }

    // A lógica de verificação do Hunter.io é baseada no campo "status"
    const status = data.data?.status;

    // Consideramos inválido apenas se o status for explicitamente 'invalid'.
    // 'valid', 'risky', e 'unknown' serão aceitos para não bloquear e-mails válidos (como os do Gmail).
    if (status === 'invalid') {
      return response.status(200).json({ isValid: false, message: 'Este endereço de e-mail é inválido.' });
    } else {
      return response.status(200).json({ isValid: true });
    }
    
  } catch (error) {
    console.error("Erro na função de verificação:", error);
    return response.status(200).json({ isValid: true, message: 'Não foi possível verificar o e-mail no momento.' });
  }
}