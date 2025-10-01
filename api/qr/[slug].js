// /api/qr/[slug].js (Versão Corrigida e Aprimorada)

import { createClient } from '@supabase/supabase-js';

// Função auxiliar para converter valores para float, retornando null se inválido.
// Isso garante que não enviaremos strings vazias ou NaN para o banco.
const parseFloatOrNull = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
};

export default async function handler(request, response) {
    const { slug, utm_source, utm_medium, utm_campaign } = request.query;

    const slugRegex = /^[a-z0-9-]+$/i;
    if (!slug || !slugRegex.test(slug)) {
        return response.status(400).json({ message: 'Formato de slug inválido.' });
    }

    // É uma boa prática usar nomes de variáveis de ambiente sem prefixos de cliente (VITE_) no backend.
    // Considere renomear para SUPABASE_URL no seu .env.
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
            console.error(`Erro ao buscar ou slug não encontrado: ${slug}`, selectError);
            // Para o usuário final, uma mensagem genérica é mais segura.
            return response.status(404).send('QR Code não encontrado ou inativo.');
        }

        // --- OBTENÇÃO MODERNA DE GEOLOCALIZAÇÃO (via Vercel Edge) ---
        // O objeto `request.geo` é injetado pela Vercel. Usamos optional chaining (?.)
        // para evitar erros caso o código rode em um ambiente sem esse objeto (ex: localhost).
        const geoData = {
            country: request.geo?.country || null,
            region: request.geo?.region || null,
            city: request.geo?.city || null,
            // --- CORREÇÃO PRINCIPAL ---
            // Usamos request.geo e convertemos para número.
            latitude: parseFloatOrNull(request.geo?.latitude),
            longitude: parseFloatOrNull(request.geo?.longitude),
        };

        const logData = {
            qr_id: linkData.id,
            ip: request.headers['x-forwarded-for'] || request.socket.remoteAddress,
            user_agent: request.headers['user-agent'],
            geo: geoData, // Objeto de geolocalização corrigido
            language: request.headers['accept-language']?.split(',')[0] || null,
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
        };
        
        // A inserção do log é uma operação "fire-and-forget" para não atrasar o usuário.
        // Não usar 'await' aqui é uma decisão consciente para priorizar a velocidade do redirecionamento.
        // Se o log for CRÍTICO, mantenha o 'await'.
        supabaseAdmin.from('qr_logs').insert(logData).then(({ error }) => {
            if (error) {
                // Logamos o erro no servidor, mas o usuário já foi redirecionado.
                console.error('Falha assíncrona ao salvar o log do QR Code:', error);
            }
        });

        // Redireciona o usuário imediatamente.
        return response.redirect(307, linkData.destino);

    } catch (error) {
        console.error('Erro crítico na API do QR Code:', error);
        const fallbackUrl = process.env.FALLBACK_URL || 'https://sua-url-de-fallback.com';
        return response.redirect(307, fallbackUrl);
    }
}