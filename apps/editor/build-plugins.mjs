/**
 * Build every bundled plugin's dashboard bundle.
 *
 *     node build-plugins.mjs
 *
 * Each `plugins/<slug>/frontend/src/index.tsx` becomes
 * `plugins/<slug>/editor/dist/editor.js` (+ `editor.css`): an IIFE that reads
 * Solid and `@pillar/editor` from `window.PillarHost` and ends by calling
 * `PillarHost.define('<slug>', { register })`. Nothing the dashboard already
 * has is bundled — a second copy of Solid would be a second reactive runtime.
 *
 * A third-party plugin needs none of this script: it ships a bundle meeting
 * the same contract, built however it likes. See docs/backend.md §10.1.
 */
import { build } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.resolve(here, '../../plugins');

/** Bare imports a bundle must take from the host rather than bundle. */
const HOST = {
  'solid-js': 'PillarHost.solid',
  'solid-js/web': 'PillarHost.web',
  'solid-js/store': 'PillarHost.store',
  '@pillar/editor': 'PillarHost.editor',
};

/**
 * Plugin CSS writes `@import 'tailwindcss/utilities.css'` the standard way, but
 * Tailwind resolves that relative to the CSS file — and a plugin directory has
 * no node_modules of its own. Point bare `tailwindcss/` imports at the
 * dashboard's installed copy, before Tailwind sees the file.
 */
const tailwindFrom = path.join(here, 'node_modules/tailwindcss/');

const resolveTailwind = {
  name: 'pillar-resolve-tailwind',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('.css')) return null;

    return code.replace(/(@import\s+['"])tailwindcss\//g, `$1${tailwindFrom}`);
  },
};

/**
 * Confine a plugin's utilities to its own markup.
 *
 * Two Tailwind builds in one page collide: the plugin's stylesheet loads after
 * the dashboard's, both put rules in the `utilities` layer, and so the
 * plugin's plain `.hidden` beat the dashboard's `md:block` — the CMS rail and
 * header lost their desktop layout the moment the SEO bundle loaded.
 *
 * The utilities layer's rules are wrapped in `@scope` rooted at the element the
 * dashboard renders every plugin slot into (`data-pillar-plugin="<slug>"`).
 * Outside it they match nothing; inside it a scoped rule beats the dashboard's
 * unscoped one of equal specificity, so the plugin's own classes still win on
 * the plugin's own elements.
 */
function scopeUtilities(css, slug) {
  const marker = '@layer utilities{';
  const start = css.indexOf(marker);

  if (start === -1) return css;

  let depth = 1;
  let index = start + marker.length;

  for (; index < css.length && depth > 0; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}') depth--;
  }

  const inner = css.slice(start + marker.length, index - 1);

  return `${css.slice(0, start)}${marker}@scope ([data-pillar-plugin=${JSON.stringify(slug)}]){${inner}}}${css.slice(index)}`;
}

const slugs = readdirSync(pluginsDir).filter((slug) =>
  existsSync(path.join(pluginsDir, slug, 'frontend/src/index.tsx'))
);

for (const slug of slugs) {
  const root = path.join(pluginsDir, slug);
  // A valid identifier for the IIFE's result, whatever the slug looks like.
  const name = `__pillar_plugin_${slug.replace(/[^a-z0-9]/gi, '_')}`;

  await build({
    configFile: false,
    logLevel: 'warn',
    root,
    plugins: [resolveTailwind, solid(), tailwindcss()],
    build: {
      outDir: path.join(root, 'editor/dist'),
      emptyOutDir: true,
      cssCodeSplit: false,
      lib: {
        entry: path.join(root, 'frontend/src/index.tsx'),
        formats: ['iife'],
        name,
        fileName: () => 'editor.js',
        cssFileName: 'editor',
      },
      rollupOptions: {
        external: Object.keys(HOST),
        output: {
          globals: HOST,
          // The one line of the contract the plugin's own code never writes:
          // hand the module to the host under the slug it was built for.
          footer: `window.PillarHost.define(${JSON.stringify(slug)}, ${name});`,
        },
      },
    },
  });

  const cssPath = path.join(root, 'editor/dist/editor.css');

  if (existsSync(cssPath)) {
    writeFileSync(cssPath, scopeUtilities(readFileSync(cssPath, 'utf8'), slug));
  }

  console.log(`built plugins/${slug}/editor/dist/editor.js`);
}

if (slugs.length === 0) console.log('no plugins with a dashboard bundle');
