// /api/qr/[slug].js (Versão Definitiva - Produção)

import { createClient } from '@supabase/supabase-js';
import UAParser from 'ua-parser-js';

/**
 * Converte um valor para o tipo float de forma segura.
 * Retorna null se o valor não for um número válido.
 */
const parseFloatOrNull = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
};

/**
 * Decodifica um componente de URL (como o nome da cidade) de forma segura.
 * Retorna o valor original se a decodificação falhar.
 */
const decodeSafely = (value) => {
    if (!value) return null;
    try {
        // Remove aspas duplas que podem vir de alguns headers antes de decodificar
        const cleanValue = value.replace(/"/g, '');
        return decodeURIComponent(cleanValue);
    } catch (e) {
        return value;
    }
};

export default async function handler(request, response) {
    // Coleta todos os parâmetros de query e headers relevantes
    const { query, headers } = request;
    const { slug, utm_source, utm_medium, utm_campaign, gclid, ref } = query;
    const uaString = headers['user-agent'];

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
            console.warn(`QR Code não encontrado para o slug: ${slug}`);
            return response.status(404).send('QR Code não encontrado ou inativo.');
        }

        // --- ANÁLISE DO USER-AGENT PARA FALLBACK ---
        const parser = new UAParser(uaString);
        const agentInfo = parser.getResult();

        // --- COLETA DE DADOS ---
        const geoData = {
            country: request.geo?.country || headers['x-vercel-ip-country'] || null,
            region: request.geo?.region || headers['x-vercel-ip-country-region'] || null,
            city: decodeSafely(request.geo?.city || headers['x-vercel-ip-city']),
            latitude: parseFloatOrNull(request.geo?.latitude || headers['x-vercel-ip-latitude']),
            longitude: parseFloatOrNull(request.geo?.longitude || headers['x-vercel-ip-longitude']),
        };

        const logData = {
            qr_id: linkData.id,
            ip: headers['x-forwarded-for'] || request.socket.remoteAddress,
            user_agent: uaString,
            geo: geoData,
            language: headers['accept-language']?.split(',')[0] || null,

            // Dados de Marketing
            referer: headers['referer'] || null,
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
            gclid: gclid || null,
            ref: ref || null,

            // Dados Técnicos (com fallback, priorizando Client Hints)
            is_mobile: (headers['sec-ch-ua-mobile'] === '?1') || ['mobile', 'tablet', 'wearable'].includes(agentInfo.device.type),
            platform: decodeSafely(headers['sec-ch-ua-platform']) || agentInfo.os.name || null,
            browser_info: headers['sec-ch-ua'] || agentInfo.browser.name || null,

            // Dado de Privacidade
            do_not_track: headers['dnt'] === '1',
        };
        
        // Insere o log de forma assíncrona para não atrasar o usuário
        supabaseAdmin.from('qr_logs').insert(logData).then(({ error: insertError }) => {
            if (insertError) {
                console.error('Falha assíncrona ao salvar o log do QR Code:', insertError);
            }
        });

        // Redireciona o usuário para o destino final
        return response.redirect(307, linkData.destino);

    } catch (error) {
        console.error('Erro crítico na função da API QR:', error);
        const fallbackUrl = process.env.FALLBACK_URL || 'https://sua-url-de-fallback.com';
        return response.redirect(307, fallbackUrl);
    }
}