// /api/qr/[slug].js (Versão Final Otimizada - Mantendo a coluna 'geo')

import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
    // Coleta o slug e os parâmetros UTM da URL
    const { slug, utm_source, utm_medium, utm_campaign } = request.query;

    // --- VALIDAÇÃO DE SEGURANÇA ---
const slugRegex = /^[a-z0-9-]+$/i; // O 'i' no final torna a regra insensível a maiúsculas
    if (!slug || !slugRegex.test(slug)) {
        return response.status(400).json({ message: 'Formato de slug inválido.' });
    }

    const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let destinationUrl = process.env.FALLBACK_URL || 'https://devxpi.vercel.app/index.html';

    try {
        const { data: linkData, error: selectError } = await supabaseAdmin
            .from('qr_links')
            .select('id, destino')
            .eq('slug', slug)
            .single();

        if (selectError) throw selectError;
        if (!linkData) {
            console.warn(`QR Code não encontrado para o slug: ${slug}`);
            return response.redirect(307, destinationUrl);
        }

        destinationUrl = linkData.destino;

        // Prepara o objeto com todos os dados a serem logados
        const logData = {
            qr_id: linkData.id,
            ip: request.headers['x-vercel-forwarded-for'] || request.socket.remoteAddress,
            user_agent: request.headers['user-agent'],
            
            // DADOS DE GEOLOCALIZAÇÃO (salvos no JSONB 'geo', como antes)
            geo: {
                country: request.headers['x-vercel-ip-country'],
                region: request.headers['x-vercel-ip-country-region'],
                city: request.headers['x-vercel-ip-city'],
            },
            
            // NOVOS DADOS (salvos em colunas separadas)
            language: request.headers['accept-language']?.split(',')[0],
            utm_source,
            utm_medium,
            utm_campaign,
        };
        
        // Insere o log no banco de dados de forma não-bloqueante
        supabaseAdmin.from('qr_logs').insert(logData).then(({ error: insertError }) => {
            if (insertError) {
                console.error('Falha assíncrona ao salvar o log do QR Code:', insertError);
            }
        });

    } catch (error) {
        console.error('Erro crítico na função QR (antes do redirecionamento):', error);
    } finally {
        // Redireciona o usuário, garantindo a melhor experiência
        return response.redirect(307, destinationUrl);
    }
}