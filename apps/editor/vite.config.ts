import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  // `pillar dev` serves the built dashboard's files under /editor/, keeping
  // /assets/ free for the previewed site's own assets.
  base: '/editor/',
  resolve: {
    alias: { '@editor': path.resolve(__dirname, './src') },
    dedupe: ['solid-js'],
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
    rollupOptions: {
      input: { app: path.resolve(__dirname, 'index.html') },
    },
  },
});
