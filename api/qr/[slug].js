// /api/qr/[slug].js

import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
    // 1. Captura o "slug" da URL. 
    // Ex: se a URL for /api/qr/instagram, o slug será "instagram".
    const { slug } = request.query;

    if (!slug) {
        return response.status(400).json({ message: 'QR Code inválido.' });
    }

    // 2. Cria um cliente Supabase com privilégios de administrador.
    // Isso é necessário para escrever na tabela de logs de forma segura.
    const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3. Busca no banco de dados qual o link de destino para este slug.
    const { data: linkData, error } = await supabaseAdmin
        .from('qr_links')
        .select('id, destino') // Selecionamos o ID para usar no log e o destino para o redirect
        .eq('slug', slug)
        .single();

    // Se não encontrar um link ou der erro, retorna "Não Encontrado".
    if (error || !linkData) {
        return response.status(404).json({ message: 'QR Code não encontrado ou inativo.' });
    }

    // --- A partir daqui, o redirecionamento já está garantido ---

    // 4. Coleta os dados para as estatísticas.
    const ip = request.headers['x-vercel-forwarded-for'] || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const geo = {
        city: request.headers['x-vercel-ip-city'],
        country: request.headers['x-vercel-ip-country'],
        region: request.headers['x-vercel-ip-country-region'],
        latitude: request.headers['x-vercel-ip-latitude'],
        longitude: request.headers['x-vercel-ip-longitude'],
    };

    // 5. Salva o registro do acesso (log) na tabela 'qr_logs'.
    // Fazemos isso de forma assíncrona, mas aguardamos a conclusão para garantir o registro.
    try {
        await supabaseAdmin.from('qr_logs').insert({
            qr_id: linkData.id,
            ip: ip,
            user_agent: userAgent,
            geo: geo
        });
    } catch (logError) {
        // Se o log falhar, não impedimos o usuário de ser redirecionado.
        // Apenas registramos o erro no console do servidor.
        console.error('Falha ao salvar o log do QR Code:', logError);
    }
    
    // 6. Redireciona o usuário para o destino final.
    // O código 307 (Temporary Redirect) é o ideal para este caso.
    return response.redirect(307, linkData.destino);
}