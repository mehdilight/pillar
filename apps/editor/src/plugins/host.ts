import { createSignal, type Component } from 'solid-js';
import * as solid from 'solid-js';
import * as web from 'solid-js/web';
import * as store from 'solid-js/store';
import * as editor from './public';
import type { SlotTarget } from './public';

/**
 * The host side of dashboard plugins.
 *
 * A plugin's bundle is an IIFE built against globals, not a module with its own
 * copy of Solid: it reads `PillarHost.solid`, `PillarHost.web` and
 * `PillarHost.editor`. That is the whole reason this object exists. A second
 * Solid in the page is a second reactive runtime — effects created in a
 * plugin's component would never re-run for signals owned by the dashboard, and
 * the failure is silent.
 *
 * A bundle announces itself with `PillarHost.define(slug, { register })`;
 * `register(host)` is handed a host scoped to that plugin, and fills slots.
 */

export interface PluginModule {
  register: (host: ScopedHost) => void;
}

/** What `register()` receives: the shared runtime, plus slot registration for this plugin. */
export interface ScopedHost {
  version: 1;
  slug: string;
  solid: typeof solid;
  web: typeof web;
  store: typeof store;
  editor: typeof editor;
  registerSlot: (target: SlotTarget, component: Component<any>) => void;
}

export interface Slot {
  plugin: string;
  target: SlotTarget;
  component: Component<any>;
}

const [slots, setSlots] = createSignal<Slot[]>([]);

/** Every registered slot for a target, in the order plugins registered. */
export const slotsFor = (target: SlotTarget, plugin?: string): Slot[] =>
  slots().filter((slot) => slot.target === target && (plugin === undefined || slot.plugin === plugin));

const pending = new Map<string, (module: PluginModule) => void>();

function scoped(slug: string): ScopedHost {
  return {
    version: 1,
    slug,
    solid,
    web,
    store,
    editor,
    registerSlot: (target, component) => {
      setSlots((current) => [...current, { plugin: slug, target, component }]);
    },
  };
}

declare global {
  interface Window {
    PillarHost?: {
      version: 1;
      solid: typeof solid;
      web: typeof web;
      store: typeof store;
      editor: typeof editor;
      define: (slug: string, module: PluginModule) => void;
    };
  }
}

/**
 * Publish the runtime a plugin bundle is built against.
 *
 * Must run before any plugin script, since a bundle reads these globals the
 * moment it executes.
 */
export function installHost(): void {
  window.PillarHost = {
    version: 1,
    solid,
    web,
    store,
    editor,
    define: (slug, module) => pending.get(slug)?.(module),
  };
}

export interface PluginBundle {
  slug: string;
  /** Null when the plugin declares a bundle that has not been built. */
  script: string | null;
  style: string | null;
}

/**
 * Load each enabled plugin's bundle and let it register.
 *
 * Every failure is contained to its plugin — a script that 404s, never calls
 * `define()`, or throws in `register()` is reported and skipped. A broken
 * plugin must degrade the dashboard, never blank it.
 *
 * @returns the plugins that failed, with why
 */
export async function loadPlugins(bundles: PluginBundle[]): Promise<Array<{ slug: string; error: string }>> {
  const failures: Array<{ slug: string; error: string }> = [];

  await Promise.all(
    bundles.map(async (bundle) => {
      try {
        if (bundle.script === null) {
          throw new Error('its dashboard bundle has not been built — run `npm run build` in apps/editor');
        }

        if (bundle.style) addStylesheet(bundle.style);

        const module = await loadScript(bundle.slug, bundle.script);

        if (typeof module?.register !== 'function') {
          throw new Error('its bundle defines no register(host) function');
        }

        module.register(scoped(bundle.slug));
      } catch (error) {
        failures.push({ slug: bundle.slug, error: error instanceof Error ? error.message : String(error) });
      }
    })
  );

  return failures;
}

function loadScript(slug: string, src: string): Promise<PluginModule> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');

    // A bundle that loads but never calls define() would otherwise hang the
    // dashboard's startup forever.
    const timer = window.setTimeout(() => {
      pending.delete(slug);
      reject(new Error('its bundle loaded but never called PillarHost.define()'));
    }, 5000);

    pending.set(slug, (module) => {
      window.clearTimeout(timer);
      pending.delete(slug);
      resolve(module);
    });

    script.src = src;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      pending.delete(slug);
      reject(new Error(`could not load ${src}`));
    };

    document.head.appendChild(script);
  });
}

function addStylesheet(href: string): void {
  const link = document.createElement('link');

  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
