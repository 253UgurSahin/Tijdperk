import { defineConfig } from 'vite';

// Relative base so the build also works from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
