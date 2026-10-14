import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages (https://<user>.github.io/<repo>/) and on any other host.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
