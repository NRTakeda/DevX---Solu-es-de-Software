import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

// Schema de validação rigoroso
const rejectionSchema = z.object({
  projectId: z.string().uuid('ID do projeto inválido'),
  clientEmail: z.string().email('E-mail do cliente inválido'),
  message: z.string()
    .min(10, 'A mensagem deve ter pelo menos 10 caracteres')
    .max(2000, 'A mensagem não pode exceder 2000 caracteres'),
  adminId: z.string().uuid('ID do administrador inválido')
});

// Rate Limiting mais restritivo
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.socket.remoteAddress,
  points: 3, // Apenas 3 tentativas por minuto
  duration: 60,
});

// Configuração segura do DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

export default async function handler(request, response) {
  // === 1. VALIDAÇÃO DO MÉTODO HTTP ===
  if (request.method !== 'POST') {
    return response.setHeader('Allow', ['POST']).status(405).json({
      success: false,
      message: 'Método não permitido. Use POST.'
    });
  }

  // === 2. RATE LIMITING ===
  try {
    const clientIP = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    await rateLimiter.consume(clientIP);
  } catch (rateLimitError) {
    return response.status(429).json({
      success: false,
      message: 'Muitas tentativas em um curto período. Tente novamente em 1 minuto.'
    });
  }

  // === 3. VALIDAÇÃO E SANITIZAÇÃO DOS DADOS ===
  let validatedData;
  try {
    const validation = rejectionSchema.safeParse(request.body);
    
    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos.',
        errors: validation.error.errors
      });
    }
    
    validatedData = validation.data;
    
    // Sanitização rigorosa da mensagem
    validatedData.message = DOMPurify.sanitize(validatedData.message, {
      ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: [],
      FORBID_ATTR: ['style', 'class', 'onclick']
    });
    
  } catch (validationError) {
    return response.status(400).json({
      success: false,
      message: 'Erro na validação dos dados.'
    });
  }

  const { projectId, clientEmail, message, adminId } = validatedData;

  // === 4. CONFIGURAÇÃO DO SUPABASE (SEM SERVICE ROLE KEY!) ===
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY, // Usando apenas a anon key!
    {
      auth: {
        persistSession: false
      }
    }
  );

  try {
    // === 5. VERIFICAÇÃO RIGOROSA DE PERMISSÕES ===
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('role, username, full_name')
      .eq('id', adminId)
      .single();

    if (adminError || !adminProfile) {
      return response.status(404).json({
        success: false,
        message: 'Perfil de administrador não encontrado.'
      });
    }

    if (adminProfile.role !== 'admin') {
      return response.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem executar esta ação.'
      });
    }

    // === 6. VERIFICAÇÃO DA EXISTÊNCIA DO PROJETO ===
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, client_id, status')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return response.status(404).json({
        success: false,
        message: 'Projeto não encontrado ou já foi excluído.'
      });
    }

    // Verificar se o projeto já está rejeitado
    if (project.status === 'Rejeitado') {
      return response.status(400).json({
        success: false,
        message: 'Este projeto já foi rejeitado anteriormente.'
      });
    }

    // === 7. ENVIO SEGURO DO E-MAIL ===
    let emailResult = null;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      emailResult = await resend.emails.send({
        from: 'DevX Team <onboarding@resend.dev>',
        to: [clientEmail],
        subject: `Atualização sobre seu projeto: ${project.name || 'Projeto DevX'}`,
        html: generateRejectionEmail(project.name, message, adminProfile.full_name || adminProfile.username)
      });

      if (!emailResult.data?.id) {
        throw new Error('Falha no envio do e-mail');
      }

      console.log('✅ E-mail de rejeição enviado com sucesso:', emailResult.data.id);

    } catch (emailError) {
      console.error('❌ Erro ao enviar e-mail:', emailError);
      // Não retornamos erro aqui - continuamos o processo mas registramos a falha
    }

    // === 8. EXECUÇÃO SEGURA DA FUNÇÃO RPC ===
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('reject_and_log_project', {
        project_id_to_delete: projectId,
        admin_id_performing_action: adminId,
        rejection_details: {
          message: message,
          client_email: clientEmail,
          email_sent: !!emailResult?.data?.id,
          email_id: emailResult?.data?.id || null,
          email_timestamp: new Date().toISOString(),
          admin_username: adminProfile.username,
          project_name: project.name
        }
      });

    if (rpcError) {
      console.error('❌ Erro na função RPC:', rpcError);
      
      // Tratamento específico de erros da função
      if (rpcError.message.includes('não autorizado')) {
        return response.status(403).json({
          success: false,
          message: 'Permissão negada pelo sistema de segurança.'
        });
      }
      
      if (rpcError.message.includes('não encontrado')) {
        return response.status(404).json({
          success: false,
          message: 'Projeto não encontrado durante a execução.'
        });
      }

      throw new Error(`Erro no banco de dados: ${rpcError.message}`);
    }

    // === 9. RESPOSTA DE SUCESSO ===
    return response.status(200).json({
      success: true,
      message: 'Projeto rejeitado com sucesso!',
      data: {
        projectId: rpcResult,
        emailSent: !!emailResult?.data?.id,
        emailId: emailResult?.data?.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('💥 Erro crítico no processo de rejeição:', error);
    
    return response.status(500).json({
      success: false,
      message: 'Erro interno do servidor durante o processamento.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// === FUNÇÃO AUXILIAR PARA GERAR O E-MAIL ===
function generateRejectionEmail(projectName, message, adminName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Atualização do seu projeto</title>
        <style>
            body { 
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
                line-height: 1.6; 
                color: #1a1a1a; 
                margin: 0; 
                padding: 0; 
                background-color: #f5f5f7; 
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); 
            }
            .header { 
                background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%); 
                color: white; 
                padding: 30px 20px; 
                text-align: center; 
            }
            .header h1 { 
                margin: 0; 
                font-size: 24px; 
                font-weight: 600; 
            }
            .content { 
                padding: 30px; 
            }
            .project-info { 
                background: #f8f9fa; 
                padding: 15px; 
                border-radius: 8px; 
                margin-bottom: 20px; 
            }
            .message-box { 
                background: #fff3cd; 
                border-left: 4px solid #ffc107; 
                padding: 15px; 
                margin: 20px 0; 
            }
            .footer { 
                background: #f8f9fa; 
                padding: 20px; 
                text-align: center; 
                color: #6c757d; 
                font-size: 14px; 
            }
            .btn { 
                display: inline-block; 
                padding: 12px 24px; 
                background: #0071e3; 
                color: white; 
                text-decoration: none; 
                border-radius: 6px; 
                margin: 10px 0; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>DevX</h1>
                <p>Plataforma de Desenvolvimento</p>
            </div>
            
            <div class="content">
                <h2>Atualização do seu projeto</h2>
                
                <div class="project-info">
                    <strong>Projeto:</strong> ${projectName || 'Projeto DevX'}<br>
                    <strong>Data da análise:</strong> ${new Date().toLocaleDateString('pt-BR')}
                </div>
                
                <p>Prezado cliente,</p>
                
                <p>Agradecemos pelo seu interesse em desenvolver um projeto conosco. Após uma análise detalhada pela nossa equipe, temos o seguinte feedback:</p>
                
                <div class="message-box">
                    <strong>Mensagem da equipe DevX:</strong><br>
                    <div style="white-space: pre-line; margin-top: 10px;">${message.replace(/\n/g, '<br>')}</div>
                </div>
                
                <p><strong>Analisado por:</strong> ${adminName} (Equipe DevX)</p>
                
                <p>Se tiver alguma dúvida ou necessitar de esclarecimentos adicionais, ficaremos felizes em ajudar.</p>
                
                <p>Atenciosamente,<br>
                <strong>Equipe DevX</strong></p>
            </div>
            
            <div class="footer">
                <p>Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.</p>
                <p>&copy; ${new Date().getFullYear()} DevX. Todos os direitos reservados.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}