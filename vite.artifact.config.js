import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Bouwt het hele spel als één los HTML-bestand (voor de Claude-artifact).
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist-artifact', target: 'es2020', chunkSizeWarningLimit: 2000 },
});
