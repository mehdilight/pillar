import * as fixtures from './fixtures';
import type {
  ContentCollection,
  MediaItem,
  ContentItem,
  DraftStatus,
  HistoryEntry,
  PageSection,
  SchemaSetting,
  SettingsPanelSchema,
  TemplatePayload,
  TemplateSummary,
  LinkLists,
} from '../types';

/**
 * The editor's data layer.
 *
 * `pillar dev` injects `window.PillarEditor` and serves `/api/*` over the
 * working tree. With no backend up, every call falls through to the in-memory
 * fixtures instead — so `npm run dev` alone gives a working editor, and the
 * same code paths run either way.
 */

export interface EditorConfig {
  /** Where the JSON API lives. */
  root: string;
  /** Where the rendered site is served for the preview iframe. */
  previewRoot: string;
  siteName: string;
  /** Set by `pillar dev`; absent when the SPA is opened on its own. */
  live: boolean;
}

declare global {
  interface Window {
    PillarEditor?: Partial<EditorConfig>;
  }
}

const injected = typeof window === 'undefined' ? undefined : window.PillarEditor;

export const editorConfig: EditorConfig = {
  root: injected?.root ?? '/api',
  previewRoot: injected?.previewRoot ?? '/preview',
  siteName: injected?.siteName ?? 'Pillar site',
  live: injected?.live ?? false,
};

/**
 * Whether a real backend answered.
 *
 * Probed once, lazily. `null` until the first call resolves it — every request
 * awaits the same probe, so a cold start does not fan out into one probe per
 * query.
 */
let backend: Promise<boolean> | null = null;

const probe = (): Promise<boolean> => {
  backend ??= fetch(`${editorConfig.root}/health`, { method: 'GET' })
    .then((response) => response.ok)
    .catch(() => false);

  return backend;
};

async function request<T>(path: string, init: RequestInit | undefined, offline: () => T): Promise<T> {
  if (!(await probe())) return offline();

  const response = await fetch(`${editorConfig.root}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');

    let message = detail;
    try { message = JSON.parse(detail).error || detail; } catch { /* Plain-text responses also work. */ }
    throw new Error(message || `${response.status} ${response.statusText}`);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const json = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });

/* ── The fixture store ──────────────────────────────────────────────────
   Mutable on purpose: with no backend, edits still have to survive a tab
   switch, or the UI cannot be evaluated at all. */

const store = {
  pages: structuredClone(fixtures.pages) as Record<string, PageSection[]>,
  layout: structuredClone(fixtures.layout) as PageSection[],
  settings: structuredClone(fixtures.settingsData) as Record<string, any>,
  menus: structuredClone(fixtures.menus) as LinkLists,
  content: structuredClone(fixtures.content) as ContentItem[],
  dirty: new Set<string>(),
};

const touch = (file: string) => store.dirty.add(file);

export const api = {
  media: (): Promise<MediaItem[]> => request('/media', undefined, () => []),
  uploadImage: (name: string, data: string): Promise<MediaItem> =>
    request('/media', { method: 'POST', body: JSON.stringify({ name, data }) }, () => { throw new Error('Start the local server to upload an image.'); }),

  setMediaAlt: (url: string, alt: string): Promise<MediaItem> =>
    request('/media/alt', { method: 'PUT', body: JSON.stringify({ url, alt }) }, () => { throw new Error('Start the local server to edit alt text.'); }),

  deleteMedia: (url: string): Promise<void> => request('/media', { method: 'DELETE', body: JSON.stringify({ url }) }, () => { throw new Error('Start the local server to manage images.'); }),

  editorPanels: (): Promise<Record<string, { name: string }>> =>
    request('/editor/panels', undefined, () => ({})),

  /** Dashboard bundles of the plugins this site enables — loaded at runtime, never compiled in. */
  editorPlugins: (): Promise<Array<{ slug: string; script: string | null; style: string | null }>> =>
    request('/editor/plugins', undefined, () => []),

  pluginPreview: (slug: string, input: Record<string, unknown>): Promise<Record<string, any>> =>
    request(`/editor/preview/${encodeURIComponent(slug)}`, { method: 'POST', body: JSON.stringify(input) }, () => {
      throw new Error('Plugin preview needs the local server.');
    }),

  templates: (): Promise<TemplateSummary[]> =>
    request('/templates', undefined, () => fixtures.templates),

  template: (name: string): Promise<TemplatePayload> =>
    request(`/templates/${encodeURIComponent(name)}`, undefined, () => ({
      name,
      sections: store.pages[name] ?? [],
      layout: store.layout,
      availableSections: fixtures.availableSections,
      availableBlocks: fixtures.availableBlocks,
      allTemplates: fixtures.templates,
    })),

  saveTemplate: (name: string, sections: PageSection[]): Promise<void> =>
    request(`/templates/${encodeURIComponent(name)}`, json({ sections }), () => {
      store.pages[name] = sections;
      touch(`templates/${name}.json`);
    }),

  saveLayout: (sections: PageSection[]): Promise<void> =>
    request('/layout', json({ sections }), () => {
      store.layout = sections;
      touch('templates/layout.json');
    }),

  settingsSchema: (): Promise<SettingsPanelSchema[]> =>
    request('/settings/schema', undefined, () => fixtures.settingsSchema),

  settings: (): Promise<Record<string, any>> =>
    request('/settings', undefined, () => store.settings),

  saveSettings: (settings: Record<string, any>): Promise<void> =>
    request('/settings', json({ settings }), () => {
      store.settings = settings;
      touch('config/settings_data.json');
    }),

  menus: (): Promise<LinkLists> => request('/menus', undefined, () => structuredClone(store.menus)),

  saveMenus: (menus: LinkLists): Promise<void> =>
    request('/menus', json({ menus }), () => {
      store.menus = structuredClone(menus);
      touch('data/menus.json');
    }),

  createCollection: (body: {
    name: string;
    label?: string;
    /** Preset keys, or whole field definitions. */
    fields?: Array<string | SchemaSetting>;
    icon?: string;
  }): Promise<{ name: string; singular: string; files: string[]; notes: string[] }> =>
    request('/content-types', { method: 'POST', body: JSON.stringify(body) }, () => {
      const name = body.name.trim();

      if (fixtures.collections.some((collection) => collection.name === name)) {
        throw new Error(`A "${name}" collection already exists.`);
      }

      fixtures.collections.push({
        name,
        label: body.label || name,
        count: 0,
        fields: (body.fields ?? ['title']).map((key) =>
          typeof key !== 'string'
            ? key
            : {
                id: key,
                type: key === 'date' ? 'date' : key === 'tags' ? 'tags' : key === 'draft' ? 'checkbox' : 'text',
                label: key[0].toUpperCase() + key.slice(1),
              }
        ),
      });

      const singular = name.endsWith('s') ? name.slice(0, -1) : name;

      return { name, singular, files: [], notes: [] };
    }),

  /** The field presets a content type can be made of — the server's list, so both sides agree. */
  fieldPresets: (): Promise<Array<{ key: string; default: boolean; id: string; type: string; label: string }>> =>
    request('/content-types/presets', undefined, () => [
      { key: 'title', default: true, id: 'title', type: 'text', label: 'Title' },
      { key: 'date', default: true, id: 'date', type: 'date', label: 'Date' },
      { key: 'tags', default: true, id: 'tags', type: 'tags', label: 'Tags' },
      { key: 'draft', default: true, id: 'draft', type: 'checkbox', label: 'Draft' },
    ]),

  /** Replace a type's label and fields: preset keys, or whole field definitions to keep as they are. */
  updateCollection: (name: string, body: { label: string; fields: Array<string | SchemaSetting>; icon?: string }): Promise<void> =>
    request(`/content-types/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(body) }, () => {
      throw new Error('Editing a content type needs the local server.');
    }),

  collections: (): Promise<ContentCollection[]> =>
    request('/content', undefined, () =>
      fixtures.collections.map((collection) => ({
        ...collection,
        count: store.content.filter((item) => item.collection === collection.name).length,
      }))
    ),

  items: (collection: string): Promise<ContentItem[]> =>
    request(`/content/${encodeURIComponent(collection)}`, undefined, () =>
      store.content.filter((item) => item.collection === collection)
    ),

  createItem: (item: ContentItem): Promise<void> =>
    request(`/content/${encodeURIComponent(item.collection)}`, { method: 'POST', body: JSON.stringify(item) }, () => {
      if (store.content.some((existing) => existing.collection === item.collection && existing.slug === item.slug)) throw new Error('An entry with this URL name already exists. Choose another.');
      store.content.push(item);
      touch(`content/${item.collection}/${item.slug}.md`);
    }),

  saveItem: (item: ContentItem): Promise<void> =>
    request(`/content/${encodeURIComponent(item.collection)}/${encodeURIComponent(item.slug)}`, json(item), () => {
      const index = store.content.findIndex(
        (candidate) => candidate.collection === item.collection && candidate.slug === item.slug
      );

      index === -1 ? store.content.push(item) : (store.content[index] = item);
      touch(`content/${item.collection}/${item.slug}.md`);
    }),

  deleteItem: (collection: string, slug: string): Promise<void> =>
    request(
      `/content/${encodeURIComponent(collection)}/${encodeURIComponent(slug)}`,
      { method: 'DELETE' },
      () => {
        store.content = store.content.filter(
          (item) => !(item.collection === collection && item.slug === slug)
        );
        touch(`content/${collection}/${slug}.md`);
      }
    ),

  draftStatus: (): Promise<DraftStatus> =>
    request('/status', undefined, () => ({
      ...fixtures.draftStatus,
      count: store.dirty.size,
      files: [...store.dirty],
    })),

  history: (): Promise<HistoryEntry[]> =>
    request('/history', undefined, () => fixtures.history),

  publish: (message: string): Promise<{ message: string }> =>
    request('/publish', { method: 'POST', body: JSON.stringify({ message }) }, () => {
      const count = store.dirty.size;

      store.dirty.clear();
      fixtures.history.unshift({
        hash: Math.random().toString(16).slice(2, 10),
        short: Math.random().toString(16).slice(2, 9),
        message: message || 'Publish from the editor',
        author: 'you',
        date: new Date().toISOString(),
      });

      return { message: `Committed ${count} file${count === 1 ? '' : 's'}` };
    }),

  discard: (): Promise<void> =>
    request('/discard', { method: 'POST' }, () => {
      store.pages = structuredClone(fixtures.pages);
      store.layout = structuredClone(fixtures.layout);
      store.settings = structuredClone(fixtures.settingsData);
      store.menus = structuredClone(fixtures.menus);
      store.content = structuredClone(fixtures.content);
      store.dirty.clear();
    }),

  /** Rendered by the site's own converter, so the preview matches the build. */
  markdown: (body: string): Promise<{ html: string }> =>
    request('/markdown', { method: 'POST', body: JSON.stringify({ body }) }, () => {
      throw new Error('no backend');
    }),

  build: (): Promise<{ pages: number; ms: number }> =>
    request('/build', { method: 'POST' }, () => ({
      pages: Object.keys(store.pages).length + store.content.length,
      ms: 120,
    })),
};

/** Whether the fixture store is in play — the UI says so rather than pretending. */
export const isOffline = async (): Promise<boolean> => !(await probe());
