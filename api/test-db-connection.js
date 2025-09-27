// /api/test-db-connection.js
import { Pool } from 'pg';

export default async function handler(request, response) {
    console.log("Iniciando teste de conexão com o banco de dados...");

    const pool = new Pool({
        // Usando a URL do Prisma, que é a mais provável de funcionar
        connectionString: process.env.POSTGRES_PRISMA_URL, 
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        const client = await pool.connect();
        console.log("Cliente conectado com sucesso.");

        const result = await client.query('SELECT NOW()');
        console.log("Query executada com sucesso.");

        client.release();
        await pool.end();
        
        console.log("Conexão encerrada. Enviando resposta de sucesso.");
        return response.status(200).json({
            success: true,
            message: "Conexão com o banco de dados bem-sucedida!",
            db_time: result.rows[0].now
        });

    } catch (error) {
        console.error("ERRO CRÍTICO DE CONEXÃO:", error);
        await pool.end();
        
        // Retorna o erro exato para o navegador para podermos ver
        return response.status(500).json({
            success: false,
            message: "Falha ao conectar com o banco de dados.",
            error_message: error.message,
            error_stack: error.stack,
            error_code: error.code
        });
    }
}