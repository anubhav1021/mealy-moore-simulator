import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the whole app (HTML + CSS + JS + Cytoscape) into ONE self-contained
// file, dist-single/index.html, for hosting as a single page.
// Run with: npm run build:single
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-single', chunkSizeWarningLimit: 1000 },
});
