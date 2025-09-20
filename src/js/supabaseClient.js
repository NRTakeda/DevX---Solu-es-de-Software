// src/js/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

// A mágica acontece aqui: O Vite substitui essas variáveis 
// pelos valores do seu arquivo .env durante a execução.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Exporta o cliente para que possamos usá-lo em outros arquivos
export const supabase = createClient(supabaseUrl, supabaseKey);