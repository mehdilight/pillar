import { defineConfig, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

const PHOSPHOR = path.resolve(__dirname, 'node_modules/@phosphor-icons/core/assets/regular');

/**
 * Phosphor's icons as files beside the dashboard — `assets/ph-<name>.svg`,
 * and `assets/ph-icons.json` listing the names — fetched one at a time when
 * an icon is shown.
 *
 * Not `import.meta.glob`: that compiles a loader for all ~1,500 icons into
 * the main bundle, some 400 KB before anything is drawn, for the handful a
 * page actually shows.
 */
function phosphorIcons(): Plugin {
  const names = () => fs.readdirSync(PHOSPHOR).filter((file) => file.endsWith('.svg')).map((file) => file.slice(0, -4)).sort();

  return {
    name: 'pillar-phosphor-icons',
    configureServer(server) {
      server.middlewares.use('/assets/', (request, response, next) => {
        const file = (request.url ?? '').split('?')[0].replace(/^\//, '');
        const icon = /^ph-([a-z0-9]+(?:-[a-z0-9]+)*)\.svg$/.exec(file);

        if (file === 'ph-icons.json') {
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(names()));
        } else if (icon && fs.existsSync(path.join(PHOSPHOR, `${icon[1]}.svg`))) {
          response.setHeader('Content-Type', 'image/svg+xml');
          response.end(fs.readFileSync(path.join(PHOSPHOR, `${icon[1]}.svg`)));
        } else {
          next();
        }
      });
    },
    generateBundle() {
      const all = names();

      for (const name of all) {
        this.emitFile({ type: 'asset', fileName: `assets/ph-${name}.svg`, source: fs.readFileSync(path.join(PHOSPHOR, `${name}.svg`)) });
      }

      this.emitFile({ type: 'asset', fileName: 'assets/ph-icons.json', source: JSON.stringify(all) });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [solid(), tailwindcss(), phosphorIcons()],
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
