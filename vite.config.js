import { defineConfig } from 'vite';

export default defineConfig({
  // Onde está nosso arquivo HTML principal
  root: 'src',

  // DIZENDO EXPLICITAMENTE ONDE ESTÁ A PASTA PÚBLICA
  // O caminho '../public' significa "volte uma pasta a partir de 'src' e encontre a pasta 'public'".
  publicDir: '../public', 
  
  // Onde o Vite deve criar a pasta da versão final
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },

  // Configuração do servidor de desenvolvimento (não mudou)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});