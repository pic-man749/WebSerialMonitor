import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/WebSerialMonitor/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    minify: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
});
