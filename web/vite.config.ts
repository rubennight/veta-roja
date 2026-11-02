/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Los themes y las fuentes (web/public) los sirve el servidor directamente desde esa carpeta.
  publicDir: false,
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        public: 'src/public/entry-client.tsx',
        admin: 'src/admin/main.tsx',
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
