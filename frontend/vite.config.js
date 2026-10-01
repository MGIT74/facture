import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// En dev, les appels /api sont redirigés vers le backend Node (port 3000).
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
