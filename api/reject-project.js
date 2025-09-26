import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

// REVISADO: Schema simplificado. A API buscará o e-mail por conta própria.
const rejectionSchema = z.object({
  projectId: z.string().uuid('ID do projeto inválido'),
  message: z.string()
    .min(10, 'A mensagem deve ter pelo menos 10 caracteres')
    .max(2000, 'A mensagem não pode exceder 2000 caracteres'),
  adminId: z.string().uuid('ID do administrador inválido')
});

const rateLimiter = new RateLimiterMemory({
  points: 5, // Limite um pouco mais flexível para admins
  duration: 60,
});

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.setHeader('Allow', ['POST']).status(405).json({ success: false, message: 'Método não permitido. Use POST.' });
  }

  try {
    const clientIP = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    await rateLimiter.consume(clientIP);
  } catch (rateLimitError) {
    return response.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 1 minuto.' });
  }

  const validation = rejectionSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({ success: false, message: 'Dados de entrada inválidos.', errors: validation.error.errors });
  }
  
  const { projectId, message, adminId } = validation.data;
  const sanitizedMessage = DOMPurify.sanitize(message, { ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'ul', 'ol', 'li'] });

  // REVISADO: Criação de um cliente Admin seguro para operações privilegiadas
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // ESSENCIAL: Usar a chave de serviço
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 1. VERIFICAR SE O REQUISITANTE É ADMIN
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role, username, full_name')
      .eq('id', adminId)
      .single();

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return response.status(403).json({ success: false, message: 'Acesso negado. Ação permitida apenas para administradores.' });
    }

    // 2. BUSCAR O PROJETO E O ID DO CLIENTE
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, client_id, status')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return response.status(404).json({ success: false, message: 'Projeto não encontrado.' });
    }
    if (project.status === 'Rejeitado') {
      return response.status(400).json({ success: false, message: 'Este projeto já foi rejeitado.' });
    }

    // 3. BUSCAR O E-MAIL DO CLIENTE DE FORMA SEGURA
    const { data: { user: clientUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(project.client_id);
    if (userError || !clientUser) {
      throw new Error(`Não foi possível encontrar o usuário cliente com ID: ${project.client_id}`);
    }
    const clientEmail = clientUser.email;

    // 4. ENVIAR O E-MAIL
    const resend = new Resend(process.env.RESEND_API_KEY);
    const emailResult = await resend.emails.send({
      from: 'DevX Team <onboarding@resend.dev>',
      to: [clientEmail],
      subject: `Atualização sobre seu projeto: ${project.name || 'Projeto DevX'}`,
      html: generateRejectionEmail(project.name, sanitizedMessage, adminProfile.full_name || adminProfile.username)
    });

    if (!emailResult.data?.id) throw new Error('Falha no envio do e-mail pela Resend.');
    
    // 5. ATUALIZAR O STATUS DO PROJETO PARA "REJEITADO"
    // (Em vez de deletar, é uma boa prática apenas mudar o status)
    const { error: updateError } = await supabaseAdmin
        .from('projects')
        .update({ status: 'Rejeitado' })
        .eq('id', projectId);

    if (updateError) {
        // Log do erro mas continua o processo, pois o e-mail já foi enviado
        console.error('Falha ao atualizar o status do projeto para Rejeitado:', updateError);
    }
    
    // 6. ADICIONAR REGISTRO NO LOG DE AUDITORIA (Exemplo de como usar a tabela audit_logs)
    const { error: logError } = await supabaseAdmin.from('audit_logs').insert({
        admin_id: adminId,
        project_id: projectId,
        action: 'PROJECT_REJECTED',
        details: {
            projectName: project.name,
            clientEmail: clientEmail,
            emailId: emailResult.data.id,
            adminUsername: adminProfile.username
        }
    });

    if (logError) {
        console.error('Falha ao registrar a ação no log de auditoria:', logError);
    }

    return response.status(200).json({ success: true, message: 'Projeto rejeitado com sucesso!' });

  } catch (error) {
    console.error('💥 Erro crítico no processo de rejeição:', error);
    return response.status(500).json({ success: false, message: error.message || 'Erro interno do servidor.' });
  }
}

// === FUNÇÃO AUXILIAR PARA GERAR O E-MAIL (COMPLETA) ===
function generateRejectionEmail(projectName, message, adminName) {
  const currentYear = new Date().getFullYear();
  const analysisDate = new Date().toLocaleDateString('pt-BR');

  // Sanitização final para garantir que as variáveis não quebrem o HTML
  const safeProjectName = projectName ? projectName.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'Projeto DevX';
  const safeAdminName = adminName ? adminName.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'Equipe DevX';

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Atualização do seu projeto</title>
        <style>
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f5f5f7; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #0071e3 0%, #0056b3 100%); color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 30px; }
            .project-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .message-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
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
                    <strong>Projeto:</strong> ${safeProjectName}<br>
                    <strong>Data da análise:</strong> ${analysisDate}
                </div>
                
                <p>Prezado cliente,</p>
                <p>Agradecemos pelo seu interesse em desenvolver um projeto conosco. Após uma análise detalhada pela nossa equipe, temos o seguinte feedback:</p>
                
                <div class="message-box">
                    <strong>Mensagem da equipe DevX:</strong><br>
                    <div style="margin-top: 10px;">${message}</div>
                </div>
                
                <p><strong>Analisado por:</strong> ${safeAdminName}</p>
                
                <p>Se tiver alguma dúvida, sinta-se à vontade para nos contatar.</p>
                
                <p>Atenciosamente,<br>
                <strong>Equipe DevX</strong></p>
            </div>
            
            <div class="footer">
                <p>Este é um e-mail automático. Por favor, não responda diretamente a esta mensagem.</p>
                <p>&copy; ${currentYear} DevX. Todos os direitos reservados.</p>
            </div>
        </div>
    </body>
    </html>
  `;
}