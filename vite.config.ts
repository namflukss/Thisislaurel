import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps the build portable – it can be served from any sub-path
// (GitHub Pages, a shared folder, or opened through a local static server).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
});
