import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Schema simplificado para esta operação
const rejectionSchema = z.object({
  projectId: z.string().uuid('ID do projeto inválido'),
  adminId: z.string().uuid('ID do administrador inválido')
});

const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.setHeader('Allow', ['POST']).status(405).json({ success: false, message: 'Método não permitido.' });
  }

  try {
    const clientIP = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
    await rateLimiter.consume(clientIP);
  } catch (rateLimitError) {
    return response.status(429).json({ success: false, message: 'Muitas tentativas.' });
  }

  const validation = rejectionSchema.safeParse(request.body);
  if (!validation.success) {
    return response.status(400).json({ success: false, message: 'Dados de entrada inválidos.' });
  }
  
  const { projectId, adminId } = validation.data;

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // 1. VERIFICAR SE O REQUISITANTE É ADMIN
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role, username')
      .eq('id', adminId)
      .single();

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      return response.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    // 2. BUSCAR O PROJETO E O ID DO CLIENTE
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('name, client_id, status')
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
      throw new Error(`Usuário cliente não encontrado.`);
    }
    const clientEmail = clientUser.email;
    
    // 4. ATUALIZAR O STATUS DO PROJETO PARA "REJEITADO"
    const { error: updateError } = await supabaseAdmin
        .from('projects')
        .update({ status: 'Rejeitado' })
        .eq('id', projectId);

    if (updateError) throw updateError;

    // 5. REGISTRAR NO LOG DE AUDITORIA
     const { error: logError } = await supabaseAdmin.from('audit_logs').insert({
        admin_id: adminId,
        project_id: projectId,
        action: 'PROJECT_REJECTED_VIA_MAILTO',
        details: {
            projectName: project.name,
            clientEmail: clientEmail,
            adminUsername: adminProfile.username
        }
    });

    if (logError) {
        console.error('Falha ao registrar a ação no log de auditoria:', logError);
    }
    
    // 6. RETORNAR SUCESSO COM O E-MAIL DO CLIENTE PARA O FRONT-END
    return response.status(200).json({ 
        success: true, 
        message: 'Projeto rejeitado com sucesso no sistema.',
        clientEmail: clientEmail
    });

  } catch (error) {
    console.error('💥 Erro no processo de rejeição:', error);
    return response.status(500).json({ success: false, message: error.message || 'Erro interno do servidor.' });
  }
}