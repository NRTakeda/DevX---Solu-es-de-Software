// /api/qr/[slug].js (Versão Final Enriquecida)

import { createClient } from '@supabase/supabase-js';

const parseFloatOrNull = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
};

const decodeSafely = (value) => {
    if (!value) return null;
    try {
        return decodeURIComponent(value);
    } catch (e) {
        return value;
    }
};

export default async function handler(request, response) {
    // Coleta todos os parâmetros de query de uma vez
    const { slug, utm_source, utm_medium, utm_campaign, gclid, ref } = request.query;

    const slugRegex = /^[a-z0-9-]+$/i;
    if (!slug || !slugRegex.test(slug)) {
        return response.status(400).json({ message: 'Formato de slug inválido.' });
    }

    const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { data: linkData, error: selectError } = await supabaseAdmin
            .from('qr_links')
            .select('id, destino')
            .eq('slug', slug)
            .single();

        if (selectError || !linkData) {
            return response.status(404).send('QR Code não encontrado ou inativo.');
        }

        const geoData = {
            country: request.geo?.country || request.headers['x-vercel-ip-country'] || null,
            region: request.geo?.region || request.headers['x-vercel-ip-country-region'] || null,
            city: decodeSafely(request.geo?.city || request.headers['x-vercel-ip-city']),
            latitude: parseFloatOrNull(request.geo?.latitude || request.headers['x-vercel-ip-latitude']),
            longitude: parseFloatOrNull(request.geo?.longitude || request.headers['x-vercel-ip-longitude']),
        };

        const logData = {
            qr_id: linkData.id,
            ip: request.headers['x-forwarded-for'] || request.socket.remoteAddress,
            user_agent: request.headers['user-agent'],
            geo: geoData,
            language: request.headers['accept-language']?.split(',')[0] || null,

            // --- NOVOS DADOS DE MARKETING ---
            referer: request.headers['referer'] || null,
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
            gclid: gclid || null, // Google Click ID
            ref: ref || null, // Parâmetro de referência genérico

            // --- NOVOS DADOS TÉCNICOS ---
            is_mobile: request.headers['sec-ch-ua-mobile'] === '?1', // Converte para booleano
            platform: request.headers['sec-ch-ua-platform'] || null, // Ex: "Android", "Windows"
            browser_info: request.headers['sec-ch-ua'] || null, // Ex: "Chromium";v="123", ...

            // --- DADO DE PRIVACIDADE ---
            do_not_track: request.headers['dnt'] === '1', // Converte para booleano
        };
        
        supabaseAdmin.from('qr_logs').insert(logData).then(({ error: insertError }) => {
            if (insertError) {
                console.error('Falha assíncrona ao salvar o log do QR Code:', insertError);
            }
        });

        return response.redirect(307, linkData.destino);

    } catch (error) {
        console.error('Erro crítico na função da API QR:', error);
        const fallbackUrl = process.env.FALLBACK_URL || 'https://sua-url-de-fallback.com';
        return response.redirect(307, fallbackUrl);
    }
}