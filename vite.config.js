import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the built site works on GitHub Pages
  // (https://<user>.github.io/<repo>/) without knowing the repo name.
  base: './',
  // Cytoscape.js alone is ~450 kB, so raise the size warning threshold.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
