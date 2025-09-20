import { defineConfig } from 'vite';

import { resolve } from 'path';



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

    // ADICIONADO: Informando ao Vite sobre todas as páginas HTML do projeto

    rollupOptions: {

      input: {

        main: resolve(__dirname, 'src/index.html'),

        login: resolve(__dirname, 'src/login.html'),

        cadastro: resolve(__dirname, 'src/cadastro.html'),

        dashboard: resolve(__dirname, 'src/dashboard.html'),

        esqueci_senha: resolve(__dirname, 'src/esqueci-senha.html'),

        resetar_senha: resolve(__dirname, 'src/resetar-senha.html'),

        admin: resolve(__dirname, 'src/admin.html'),

      },

    },

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