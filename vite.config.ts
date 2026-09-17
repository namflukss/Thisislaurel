import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps the build portable – it can be served from any sub-path
// (GitHub Pages, a shared folder, or opened through a local static server).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
  // ports away from Vite's defaults (5173/4173), which are often already taken.
  // strictPort stays off, so a busy port just rolls over to the next free one.
  server: { port: 5290, strictPort: false, open: false },
  preview: { port: 4290, strictPort: false },
});
