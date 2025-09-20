import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'public', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        cadastro: resolve(__dirname, 'cadastro.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        esqueci_senha: resolve(__dirname, 'esqueci-senha.html'),
        resetar_senha: resolve(__dirname, 'resetar-senha.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});