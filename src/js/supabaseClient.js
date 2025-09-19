// src/js/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

// Cole suas chaves do Supabase aqui
const supabaseUrl = 'https://ltywbevzikezwmaghclo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0eXdiZXZ6aWtlendtYWdoY2xvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyOTIxNTYsImV4cCI6MjA3Mzg2ODE1Nn0.iIuxeMnge0qVl9prLvZx9RE9tR8t99GK9GWBuKOheAw';

// Exporta o cliente para que possamos usá-lo em outros arquivos
export const supabase = createClient(supabaseUrl, supabaseKey);