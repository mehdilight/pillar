import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ command }) => ({
  plugins: [solid(), tailwindcss()],
  // `pillar dev` serves the built dashboard's own files under /_pillar/ — a
  // prefix no site or route would choose — so /assets/ stays the previewed
  // site's, and every other path (/editor, /content/posts, …) is the router's.
  base: command === 'build' ? '/_pillar/' : '/',
  resolve: {
    alias: { '@editor': path.resolve(__dirname, './src') },
  },
  server: {
    port: 7777,
    // `pillar dev` serves the API and the preview; in `npm run dev` both are
    // proxied so the SPA runs against a real backend when one is up and falls
    // back to the fixture client when it is not (see src/api/client.ts).
    proxy: {
      '/api': { target: 'http://127.0.0.1:7788', changeOrigin: true },
      '/preview': { target: 'http://127.0.0.1:7788', changeOrigin: true },
    },
  },
  build: {
    // `pillar dev` serves this directory; PHP resolves entries via the manifest
    // rather than guessing hashed filenames.
    outDir: '../../public/editor',
    emptyOutDir: true,
    manifest: true,
    // The rich editor (TipTap + ProseMirror + marked) is one ~510 KB chunk, on
    // purpose: it is lazy-loaded, so it costs nothing until an editor opens.
    // Anything else over this is worth a look.
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      input: { app: path.resolve(__dirname, 'index.html') },
    },
  },
}));
