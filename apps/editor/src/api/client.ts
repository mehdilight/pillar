import { t } from '../i18n';
import * as fixtures from './fixtures';
import type {
  ContentCollection,
  MediaItem,
  ContentItem,
  DraftStatus,
  GitConfig,
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
  get siteName() { return injected?.siteName ?? t("Pillar site"); },
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
    request('/media', { method: 'POST', body: JSON.stringify({ name, data }) }, () => { throw new Error(t("Start the local server to upload an image.")); }),

  setMediaAlt: (url: string, alt: string): Promise<MediaItem> =>
    request('/media/alt', { method: 'PUT', body: JSON.stringify({ url, alt }) }, () => { throw new Error(t("Start the local server to edit alt text.")); }),

  deleteMedia: (url: string): Promise<void> => request('/media', { method: 'DELETE', body: JSON.stringify({ url }) }, () => { throw new Error(t("Start the local server to manage images.")); }),

  editorPanels: (): Promise<Record<string, { name: string }>> =>
    request('/editor/panels', undefined, () => ({})),

  /** Dashboard bundles of the plugins this site enables — loaded at runtime, never compiled in. */
  editorPlugins: (): Promise<Array<{ slug: string; script: string | null; style: string | null }>> =>
    request('/editor/plugins', undefined, () => []),

  pluginPreview: (slug: string, input: Record<string, unknown>): Promise<Record<string, any>> =>
    request(`/editor/preview/${encodeURIComponent(slug)}`, { method: 'POST', body: JSON.stringify(input) }, () => {
      throw new Error(t("Plugin preview needs the local server."));
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
        throw new Error(t('A "{{name}}" collection already exists.', { name }));
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
      throw new Error(t("Editing a content type needs the local server."));
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
      if (store.content.some((existing) => existing.collection === item.collection && existing.slug === item.slug)) throw new Error(t("An entry with this URL name already exists. Choose another."));
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

  /** Commit, and push unless `push` is false — a local commit to review or push later. */
  publish: (message: string, push = true): Promise<{ message: string }> =>
    request('/publish', { method: 'POST', body: JSON.stringify({ message, push }) }, () => {
      const count = store.dirty.size;

      store.dirty.clear();
      fixtures.history.unshift({
        hash: Math.random().toString(16).slice(2, 10),
        short: Math.random().toString(16).slice(2, 9),
        message: message || t("Publish from the editor"),
        author: 'you',
        date: new Date().toISOString(),
      });

      return { message: t("publish.committed", { count }) };
    }),

  discard: (path?: string): Promise<void> =>
    request('/discard', { method: 'POST', body: JSON.stringify({ path }) }, () => {
      if (path) {
        store.dirty.delete(path);
      } else {
        store.pages = structuredClone(fixtures.pages);
        store.layout = structuredClone(fixtures.layout);
        store.settings = structuredClone(fixtures.settingsData);
        store.menus = structuredClone(fixtures.menus);
        store.content = structuredClone(fixtures.content);
        store.dirty.clear();
      }
    }),

  branches: (): Promise<{ current: string; branches: string[]; provider: string }> =>
    request('/git/branches', undefined, () => ({
      current: 'main',
      branches: ['main', 'drafts'],
      provider: 'local',
    })),

  createBranch: (name: string, from?: string): Promise<{ ok: boolean; message: string }> =>
    request('/git/branches', { method: 'POST', body: JSON.stringify({ name, from }) }, () => ({
      ok: true,
      message: `Created branch ${name}`,
    })),

  switchBranch: (name: string): Promise<{ ok: boolean; message: string }> =>
    request('/git/branches/switch', { method: 'POST', body: JSON.stringify({ name }) }, () => ({
      ok: true,
      message: `Switched to branch ${name}`,
    })),

  deleteBranch: (name: string): Promise<{ ok: boolean; message: string }> =>
    request('/git/branches/delete', { method: 'POST', body: JSON.stringify({ name }) }, () => ({
      ok: true,
      message: `Deleted branch ${name}`,
    })),

  createPullRequest: (
    title: string,
    body = '',
    head?: string,
    base = 'main'
  ): Promise<{ ok: boolean; message: string; url?: string; number?: number }> =>
    request('/git/pull-request', { method: 'POST', body: JSON.stringify({ title, body, head, base }) }, () => ({
      ok: true,
      message: 'Pull request created',
      url: 'https://github.com',
    })),

  mergeBranch: (source: string, message?: string): Promise<{ ok: boolean; message: string }> =>
    request('/git/merge', { method: 'POST', body: JSON.stringify({ source, message }) }, () => ({
      ok: true,
      message: `Merged ${source}`,
    })),

  diff: (path?: string): Promise<{ diff: string }> =>
    request(`/git/diff${path ? `?path=${encodeURIComponent(path)}` : ''}`, undefined, () => ({ diff: '' })),

  gitConfig: (): Promise<GitConfig> =>
    request('/git/config', undefined, () => ({
      provider: 'auto',
      active_provider: 'local',
      author_name: '',
      author_email: '',
      github: {
        repo: '',
        branch: 'main',
        has_token: false,
      },
    })),

  saveGitConfig: (
    data: Partial<Omit<GitConfig, 'github'>> & { github?: { repo?: string; branch?: string; token?: string } }
  ): Promise<{ ok: boolean; message: string; config: GitConfig }> =>
    request('/git/config', { method: 'POST', body: JSON.stringify(data) }, () => ({
      ok: true,
      message: 'Git configuration saved',
      config: {
        provider: data.provider ?? 'auto',
        active_provider: 'local',
        author_name: data.author_name ?? '',
        author_email: data.author_email ?? '',
        github: {
          repo: data.github?.repo ?? '',
          branch: data.github?.branch ?? 'main',
          has_token: Boolean(data.github?.token),
        },
      },
    })),


  /** Rendered by the site's own converter, so the preview matches the build. */
  markdown: (body: string): Promise<{ html: string }> =>
    request('/markdown', { method: 'POST', body: JSON.stringify({ body }) }, () => {
      throw new Error(t("no backend"));
    }),

  build: (): Promise<{ pages: number; ms: number }> =>
    request('/build', { method: 'POST' }, () => ({
      pages: Object.keys(store.pages).length + store.content.length,
      ms: 120,
    })),
};

/** Whether the fixture store is in play — the UI says so rather than pretending. */
export const isOffline = async (): Promise<boolean> => !(await probe());
