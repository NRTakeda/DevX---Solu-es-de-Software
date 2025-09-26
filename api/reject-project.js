import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import nodemailer from 'nodemailer';

// Schema de validação final e corrigido
const rejectionSchema = z.object({
  projectId: z.string().uuid('ID do projeto inválido'),
  message: z.string().min(1, 'A mensagem não pode estar vazia.'),
  adminId: z.string().uuid('ID do administrador inválido')
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.setHeader('Allow', ['POST']).status(405).json({ success: false, message: 'Método não permitido.' });
  }

  const validation = rejectionSchema.safeParse(request.body);
  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message || 'Dados de entrada inválidos.';
    return response.status(400).json({ success: false, message: firstError });
  }
  
  const { projectId, message, adminId } = validation.data;

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { data: adminProfile, error: adminError } = await supabaseAdmin.from('profiles').select('role, username, full_name').eq('id', adminId).single();
    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return response.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const { data: project, error: projectError } = await supabaseAdmin.from('projects').select('name, client_id, status').eq('id', projectId).single();
    if (projectError || !project) {
      return response.status(404).json({ success: false, message: 'Projeto não encontrado.' });
    }

    const { data: { user: clientUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(project.client_id);
    if (userError || !clientUser) {
      throw new Error(`Usuário cliente não encontrado.`);
    }
    const clientEmail = clientUser.email;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_SENDER_EMAIL,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: `"Equipe DevX" <${process.env.GMAIL_SENDER_EMAIL}>`,
        to: clientEmail,
        subject: `Atualização sobre seu projeto: ${project.name || 'Projeto DevX'}`,
        html: generateRejectionEmail(project.name, message, adminProfile.full_name || adminProfile.username),
    });

    await supabaseAdmin.from('projects').update({ status: 'Rejeitado' }).eq('id', projectId);
    
    await supabaseAdmin.from('audit_logs').insert({
        admin_id: adminId,
        project_id: projectId,
        action: 'PROJECT_REJECTED',
        details: {
            projectName: project.name,
            clientEmail: clientEmail,
            adminUsername: adminProfile.username
        }
    });

    return response.status(200).json({ success: true, message: 'Projeto rejeitado e e-mail enviado com sucesso!' });

  } catch (error) {
    console.error('💥 Erro no processo de rejeição:', error);
    if (error.code === 'EAUTH') {
        return response.status(500).json({ success: false, message: 'Erro de autenticação com o Gmail. Verifique a Senha de App e o e-mail configurados.' });
    }
    return response.status(500).json({ success: false, message: error.message || 'Erro interno do servidor.' });
  }
}

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