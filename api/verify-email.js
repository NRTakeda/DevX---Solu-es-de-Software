// /api/verify-email.js (VERSÃO FINAL E ROBUSTA)
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
  const apiKey = process.env.ABSTRACT_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ message: 'A chave da API de validação não está configurada.' });
  }

  try {
    const apiResponse = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`);
    const data = await apiResponse.json();

    // --- NOVA LÓGICA MAIS INTELIGENTE ---
    // Consideramos o e-mail válido a menos que a API tenha certeza de que ele é "INENTREGÁVEL".
    // Isso permite e-mails de grandes provedores que retornam "RISKY" ou "UNKNOWN".
    if (data.deliverability !== 'UNDELIVERABLE') {
      return response.status(200).json({ isValid: true });
    } else {
      return response.status(200).json({ isValid: false, message: 'Este endereço de e-mail não pôde ser verificado.' });
    }
    
  } catch (error) {
    console.error("Erro na API de verificação:", error);
    // Em caso de erro na API, por segurança, permitimos o cadastro para não bloquear o usuário.
    return response.status(200).json({ isValid: true, message: 'Não foi possível verificar o e-mail no momento.' });
  }
}