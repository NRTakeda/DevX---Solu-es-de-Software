import { Resend } from 'resend';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { sanitize } from './_utils/sanitizer.js';

// Validador de schema com Zod
const contactSchema = z.object({
  name: z.string().min(1, { message: 'O nome é obrigatório.' }).max(100),
  email: z.string().email({ message: 'Formato de email inválido.' }),
  message: z.string().min(1, { message: 'A mensagem é obrigatória.' }).max(5000),
});

const resend = new Resend(process.env.RESEND_API_KEY);
const destinationEmail = process.env.CONTACT_FORM_DESTINATION_EMAIL;

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
	windowMs: 5 * 60 * 1000,
	max: 3,
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

  const validation = contactSchema.safeParse(request.body);

  if (!validation.success) {
    const errors = validation.error.format();
    const firstError = Object.values(errors).flat()[1];
    return response.status(400).json({ message: firstError || 'Dados inválidos.' });
  }

  const { name, email, message } = validation.data;
  
  try {
    const data = await resend.emails.send({
      from: 'DevX Website <onboarding@resend.dev>', // Este e-mail é fixo para o domínio da Resend
      to: [destinationEmail],
      subject: `Nova mensagem de ${sanitize(name)} via site DevX`,
      reply_to: email,
      html: `
        <p>Você recebeu uma nova mensagem através do formulário de contato do site DevX.</p>
        <p><strong>Nome:</strong> ${sanitize(name)}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensagem:</strong></p>
        <p>${sanitize(message).replace(/\n/g, '<br>')}</p>
      `,
    });

    return response.status(200).json({ message: 'Mensagem enviada com sucesso!' });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: 'Ocorreu um erro interno ao enviar a mensagem.' });
  }
}