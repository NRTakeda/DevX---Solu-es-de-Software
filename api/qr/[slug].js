// /api/qr/[slug].js (Versão Final com Logs para Depuração)

import { createClient } from '@supabase/supabase-js';

/**
 * Converte um valor para o tipo float de forma segura.
 * Se o valor não for um número válido, retorna null.
 * Isso garante que não salvaremos dados inválidos (como NaN ou strings) no banco.
 * @param {any} value - O valor a ser convertido.
 * @returns {number|null} - O número convertido ou null.
 */
const parseFloatOrNull = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
};

export default async function handler(request, response) {
    
    // --- BLOCO DE DEPURAÇÃO ESSENCIAL ---
    // Este bloco nos ajuda a ver exatamente o que a Vercel está fornecendo para a função.
    console.log("--- INICIANDO DEBUG DE GEOLOCALIZAÇÃO ---");
    console.log("Data/Hora (UTC):", new Date().toUTCString());
    console.log("Conteúdo de request.geo:", request.geo);
    console.log("IP (x-forwarded-for):", request.headers['x-forwarded-for']);
    console.log("País (x-vercel-ip-country - Legado):", request.headers['x-vercel-ip-country']);
    console.log("--- FIM DO DEBUG ---");
    // --- FIM DO BLOCO DE DEPURAÇÃO ---

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

        if (selectError || !linkData) {
            console.error(`Erro ao buscar slug ou slug não encontrado: ${slug}`, selectError);
            return response.status(404).send('QR Code não encontrado ou inativo.');
        }

        // --- COLETA E TRATAMENTO DOS DADOS ---

        // O objeto `request.geo` é injetado pela Vercel. Usamos optional chaining (?.)
        // para evitar erros caso o objeto não exista.
        const geoData = {
            country: request.geo?.country || null,
            region: request.geo?.region || null,
            city: request.geo?.city || null,
            latitude: parseFloatOrNull(request.geo?.latitude),
            longitude: parseFloatOrNull(request.geo?.longitude),
        };

        // Prepara o objeto completo com todos os dados a serem logados
        const logData = {
            qr_id: linkData.id,
            ip: request.headers['x-forwarded-for'] || request.socket.remoteAddress,
            user_agent: request.headers['user-agent'],
            geo: geoData,
            language: request.headers['accept-language']?.split(',')[0] || null,
            utm_source: utm_source || null,
            utm_medium: utm_medium || null,
            utm_campaign: utm_campaign || null,
        };
        
        // A inserção do log não deve bloquear o redirecionamento do usuário.
        // Usamos .then() para lidar com o resultado de forma assíncrona.
        supabaseAdmin.from('qr_logs').insert(logData).then(({ error: insertError }) => {
            if (insertError) {
                // Se a inserção falhar, apenas logamos o erro no servidor.
                // O usuário já foi redirecionado e não é impactado.
                console.error('Falha assíncrona ao salvar o log do QR Code:', insertError);
            }
        });

        // Redireciona o usuário para o destino final o mais rápido possível.
        return response.redirect(307, linkData.destino);

    } catch (error) {
        console.error('Erro crítico na função da API QR:', error);
        // Em caso de erro grave, redireciona para uma URL de fallback.
        const fallbackUrl = process.env.FALLBACK_URL || 'https://sua-url-de-fallback.com';
        return response.redirect(307, fallbackUrl);
    }
}