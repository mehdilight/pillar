/**
 * `@pillar/editor` — everything a plugin's dashboard bundle may import.
 *
 * A plugin bundle never includes these: at build time `@pillar/editor` is an
 * external mapped to `PillarHost.editor`, so the components a plugin renders
 * are the dashboard's own instances, styled and behaving exactly like the
 * panels around them. This file is also what a plugin's TypeScript resolves
 * `@pillar/editor` to, so it is the compile-time contract as well.
 *
 * Adding an export here is adding to a public API. Removing one breaks every
 * plugin that used it.
 */
import Field, { controlClass } from '../components/ui/Field';
import SettingInput from '../components/SettingInput';
import ImagePicker from '../components/ui/ImagePicker';
import { mediaUrl } from '../components/MediaLibrary';
import { api as client } from '../api/client';

export type { SchemaSetting, FieldType } from '../types';
/** What a plugin's `register(host)` receives. */
export type { ScopedHost } from './host';

export { Field, controlClass, SettingInput, ImagePicker, mediaUrl };

/** The API calls a plugin panel needs — a deliberately small subset of the client. */
export const api = {
  /** A plugin's own preview resolver, registered server-side with `$context->editor->preview()`. */
  preview: <T = Record<string, unknown>>(slug: string, input: Record<string, unknown>): Promise<T> =>
    client.pluginPreview(slug, input) as Promise<T>,
  /** Markdown rendered by the site's own converter. */
  markdown: (body: string) => client.markdown(body),
};

/**
 * Where a plugin can put UI.
 *
 * - `settings.panel` — replaces the generic form for the plugin's own settings
 *   panel under Site settings. Props: {@link SettingsPanelProps}.
 * - `content.item.sidebar` — beside an entry in the content editor. Props:
 *   {@link ContentSidebarProps}.
 */
export type SlotTarget = 'settings.panel' | 'content.item.sidebar';

export interface SettingsPanelProps {
  /** The panel's fields, ids namespaced `plugin:<slug>:<field>`. */
  fields: import('../types').SchemaSetting[];
  /** Every settings value, the site's and every plugin's. */
  values: Record<string, any>;
  onChange: (id: string, value: unknown) => void;
}

export interface ContentSidebarProps {
  collection: string;
  slug: string;
  frontmatter: Record<string, any>;
  body: string;
  /** Replace the entry's frontmatter; saved with the entry. */
  setFrontmatter: (next: Record<string, any>) => void;
}
