import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: projectRoot,
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/src-tauri/gen/**',
        '**/target/**',
        '**/.vite-cache/**'
      ]
    }
  },
  cacheDir: '.vite-cache',
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-dev-runtime']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  envPrefix: ['VITE_', 'TAURI_']
});
