// /api/qr/[slug].js (Versão Final, Robusta e Completa)

import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
    // Coleta o slug e os parâmetros UTM da URL
    const { slug, utm_source, utm_medium, utm_campaign } = request.query;

    // --- VALIDAÇÃO DE SEGURANÇA ---
    const slugRegex = /^[a-z0-9-]+$/i; // O 'i' torna a regra insensível a maiúsculas
    if (!slug || !slugRegex.test(slug)) {
        return response.status(400).json({ message: 'Formato de slug inválido.' });
    }

    const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // Busca o link de destino no banco de dados
        const { data: linkData, error: selectError } = await supabaseAdmin
            .from('qr_links')
            .select('id, destino')
            .eq('slug', slug)
            .single();

        if (selectError) {
            console.error('Erro ao buscar slug:', selectError);
            throw selectError;
        }
        if (!linkData) {
            console.warn(`QR Code não encontrado para o slug: ${slug}`);
            return response.status(404).send('QR Code não encontrado ou inativo.');
        }

        // Prepara o objeto com todos os dados a serem logados
        const logData = {
            qr_id: linkData.id,
            ip: request.headers['x-vercel-forwarded-for'] || request.socket.remoteAddress,
            user_agent: request.headers['user-agent'],
            
            // DADOS DE GEOLOCALIZAÇÃO (salvos no JSONB 'geo')
            geo: {
                country: request.headers['x-vercel-ip-country'],
                region: request.headers['x-vercel-ip-country-region'],
                city: request.headers['x-vercel-ip-city'],
            },
            
            // NOVOS DADOS (salvos em colunas separadas)
            language: request.headers['accept-language']?.split(',')[0],
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
        };
        
        // CORREÇÃO CRÍTICA: Aguarda (await) a operação de insert terminar.
        const { error: insertError } = await supabaseAdmin.from('qr_logs').insert(logData);

        if (insertError) {
            // Se a inserção falhar, loga o erro no servidor, mas ainda redireciona.
            console.error('Falha ao salvar o log do QR Code:', insertError);
        }

        // Se tudo deu certo (ou mesmo se o log falhou), redireciona.
        return response.redirect(307, linkData.destino);

    } catch (error) {
        console.error('Erro crítico na função QR:', error);
        // Em caso de erro grave (ex: slug não encontrado), redireciona para a home.
        const fallbackUrl = process.env.FALLBACK_URL || 'https://devxpi.vercel.app/index.html';
        return response.redirect(307, fallbackUrl);
    }
}