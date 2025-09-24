import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

// Schema de validação
const rejectionSchema = z.object({
  projectId: z.string().uuid(),
  clientEmail: z.string().email(),
  message: z.string().min(10, { message: 'A mensagem deve ter pelo menos 10 caracteres.' }),
});

// Rate Limiting (5 tentativas por minuto por IP)
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress,
  points: 5,
  duration: 60,
});

// Configuração do DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

export default async function handler(request, response) {
  // === 1. VALIDAÇÃO DO MÉTODO HTTP ===
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Método não permitido.' });
  }

  // === 2. RATE LIMITING ===
  try {
    const clientIP = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    await rateLimiter.consume(clientIP);
  } catch (rateLimitError) {
    return response.status(429).json({ 
      message: 'Muitas tentativas. Tente novamente em alguns minutos.' 
    });
  }

  // === 3. VALIDAÇÃO DOS DADOS ===
  const validation = rejectionSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({ 
      message: 'Dados inválidos.', 
      details: validation.error.format() 
    });
  }

  const { projectId, clientEmail, message } = validation.data;

  // === 4. SANITIZAÇÃO DA MENSAGEM ===
  const sanitizedMessage = DOMPurify.sanitize(message, {
    ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });

  // === 5. VERIFICAÇÃO DE PERMISSÃO DE ADMIN ===
  let adminId;
  try {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('Token de autenticação não encontrado.');

    // Cliente Supabase para verificar permissões
    const supabaseUserClient = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabaseUserClient.auth.getUser();
    if (!user) throw new Error('Usuário inválido ou não autenticado.');

    const { data: profile } = await supabaseUserClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return response.status(403).json({ 
        message: 'Acesso negado. Apenas administradores podem executar esta ação.' 
      });
    }

    adminId = user.id; // Guarda o ID do admin para usar na função RPC

  } catch (error) {
    return response.status(401).json({ 
      message: error.message || 'Erro de autenticação.' 
    });
  }

  // === 6. LÓGICA PRINCIPAL ===
  try {
    // 1. Enviar o e-mail de rejeição primeiro (mantendo seu estilo)
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const emailResult = await resend.emails.send({
      from: 'DevX Team <onboarding@resend.dev>',
      to: [clientEmail],
      subject: 'Atualização sobre sua solicitação de projeto na DevX',
      html: `
        <h1>Olá!</h1>
        <p>Gostaríamos de agradecer pelo seu interesse em desenvolver um projeto conosco. Após uma análise inicial, temos a seguinte mensagem da nossa equipe:</p>
        <div style="background-color: #f5f5f7; border-left: 4px solid #0071e3; padding: 15px; margin: 20px 0;">
          <p><em>${sanitizedMessage.replace(/\n/g, '<br>')}</em></p>
        </div>
        <p>Se tiver qualquer dúvida, sinta-se à vontade para responder a este e-mail.</p>
        <p>Atenciosamente,<br>Equipe DevX</p>
      `,
    });

    if (!emailResult.id) {
      throw new Error('Falha no envio do e-mail.');
    }

    // 2. Chamar a função do banco (SUBSTITUI A EXCLUSÃO DIRETA)
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY, // ← AGORA USA ANON KEY!
      { 
        global: { 
          headers: { Authorization: `Bearer ${token}` } 
        } 
      }
    );

    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc('reject_and_log_project', {
        project_id_to_delete: projectId,
        admin_id_performing_action: adminId,
        rejection_details: {
          message: sanitizedMessage,
          client_email: clientEmail,
          email_sent: true,
          email_id: emailResult.id,
          timestamp: new Date().toISOString()
        }
      });

    if (rpcError) {
      console.error('Erro na função do banco:', rpcError);
      
      // Tratamento específico de erros
      if (rpcError.message.includes('não autorizado')) {
        throw new Error('Acesso negado pelo banco de dados.');
      }
      if (rpcError.message.includes('não encontrado')) {
        throw new Error('Projeto não encontrado no banco de dados.');
      }
      
      throw new Error('Erro ao processar a rejeição no banco de dados.');
    }

    // === 7. RESPOSTA DE SUCESSO ===
    return response.status(200).json({ 
      message: 'Projeto rejeitado, notificação enviada e projeto excluído com sucesso.',
      projectId: result,
      emailId: emailResult.id
    });

  } catch (error) {
    console.error('Erro no processo:', error);
    
    // Erros específicos para melhor resposta ao cliente
    if (error.message.includes('E-mail enviado, mas')) {
      return response.status(207).json({ 
        message: 'E-mail enviado, mas houve um problema na exclusão. Contate o suporte.',
        details: error.message 
      });
    }
    
    return response.status(500).json({ 
      message: 'Ocorreu um erro interno.', 
      details: error.message 
    });
  }
}