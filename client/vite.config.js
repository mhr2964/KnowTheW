import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
  },
  server: {
    port: 3051,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5051',
    },
  },
});
