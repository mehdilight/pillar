import type { JSX } from 'solid-js';
import type { FieldType } from './field-types';

/**
 * The editor's data model.
 *
 * Carried over from bastet's theme editor, renamed into Pillar's vocabulary:
 * a *page* is composed of *sections*, each section declares its editable
 * surface in the `<schema>` block of its `.liqx` file, and the editor's
 * choices live in `templates/<name>.json` — never in the template source.
 */

export interface BlockInstance {
  id: string;
  type: string;
  settings: Record<string, any>;
  /** Children, for blocks that host other blocks. Absent on a leaf. */
  blocks?: BlockInstance[];
  /** Hidden by the editor: kept, with its settings, but not rendered. */
  disabled?: boolean;
}

export interface BlockType {
  type: string;
  name?: string;
  settings?: SchemaSetting[];
  /** Types this block will host, already resolved server-side. */
  accepts?: string[];
  /** From `blocks/<type>.liqx` rather than a section's own schema. */
  file?: boolean;
  /** Underscore-prefixed types render but are never offered in a picker. */
  public?: boolean;
}

export interface PageSection {
  section_id: string;
  section_type: string;
  settings: Record<string, any>;
  blocks?: BlockInstance[];
  order: number;
  enabled: boolean;
  /** Set for sections the layout pulls in itself (header, footer). */
  is_layout?: boolean;
  custom_css?: string;
  schema?: {
    name?: string;
    settings?: SchemaSetting[];
    blocks?: BlockType[];
    max_blocks?: number;
    accepts?: string[];
  };
}

/**
 * One control in a `<schema>` block.
 *
 * `type` is the contract between a `.liqx` file and this app: every value here
 * must exist in `schema/field-types.json`, from which the PHP enum and the
 * `SettingInput` switch are both derived. A type this app renders but PHP does
 * not accept is not a soft failure — the section fails to parse.
 */
export interface SchemaSetting {
  id: string;
  type: FieldType;
  label: string;
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  info?: string;
  options?: Array<{ value: string; label: string }>;
  /** Decorative settings (header, paragraph) carry content instead of a label. */
  content?: string;
  placeholder?: string;
  /** The CSS custom property this setting feeds, declared by the theme. */
  css_var?: string;
  /** Appended to the value when patching, e.g. "px". */
  css_unit?: string;
  /** `group` and `repeater`: the fields each value, or each row, holds. */
  fields?: SchemaSetting[];
  /** `image` → a gallery; `collection_item` → several entries. Stored as a list. */
  multiple?: boolean;
  /** `collection_item`: the collections its entries come from. */
  collections?: string[];
  /** `date`: a time of day as well. */
  time?: boolean;
}

/** Generated from `schema/field-types.json` — the one list both sides are written from. */
export type { FieldType } from './field-types';
export { DECORATIVE_FIELD_TYPES } from './field-types';

export interface SectionPreset {
  name: string;
  settings?: Record<string, any>;
  blocks?: BlockInstance[];
}

export interface AvailableSection {
  type: string;
  name: string;
  description?: string;
  presets?: SectionPreset[];
  /** Templates this section may be added to. Empty/absent means all of them. */
  enabled_on?: string[];
  settings?: SchemaSetting[];
  blocks?: BlockType[];
  max_blocks?: number;
}

/** A page the editor can open — one `templates/*.json`. */
export interface TemplateSummary {
  name: string;
  label: string;
  /** Where the built site serves this page; the preview iframe points here. */
  route: string;
  group?: string;
}

export interface TemplatePayload {
  name: string;
  sections: PageSection[];
  layout: PageSection[];
  availableSections: AvailableSection[];
  availableBlocks: BlockType[];
  allTemplates: TemplateSummary[];
}

/** A content collection declared in `schemas/*.json`. */
export interface ContentCollection {
  /** Phosphor regular icon name from the collection schema. */
  icon?: string;
  name: string;
  label: string;
  /** The frontmatter form, in the same vocabulary as a section's settings. */
  fields: SchemaSetting[];
  count: number;
  /** The template its entries render through — `posts` through `post`. */
  template?: string;
}

export interface ContentItem {
  collection: string;
  slug: string;
  title: string;
  frontmatter: Record<string, any>;
  body: string;
  updated_at?: string;
}

/** A named navigation list, stored in data/menus.json. */
export interface MenuItem {
  title: string;
  url: string;
  items?: MenuItem[];
}

export interface LinkList {
  title: string;
  items: MenuItem[];
}

export type LinkLists = Record<string, LinkList>;

/** One panel of `config/settings_schema.json`. */
export interface SettingsPanelSchema {
  name: string;
  plugin?: string;
  settings: SchemaSetting[];
}

export interface DraftStatus {
  /** Uncommitted files under the editor-owned paths. */
  count: number;
  files: string[];
  /** Whether a remote is configured — publishing pushes when one is. */
  has_remote: boolean;
  branch: string;
}

export interface HistoryEntry {
  hash: string;
  short: string;
  message: string;
  author: string;
  date: string;
}

export type DevicePreview = 'desktop' | 'mobile';

/** The visual editor's panels. Content and media belong to the CMS. */
export type EditorTab = 'sections' | 'settings';

export interface MediaItem {
  name: string;
  url: string;
  size: number;
  width: number | null;
  height: number | null;
  readonly: boolean;
  /** Unix time the file last changed. */
  modified: number;
  /** Site files that mention the image — content, settings, templates, stylesheets. */
  used_in: string[];
  /** The library's alt text — used wherever the image appears without its own. Empty if unset. */
  alt: string;
  /** An image, or a download a `file` field can offer. */
  kind: 'image' | 'file';
}

export interface IconProps {
  size?: number;
  class?: string;
  style?: JSX.CSSProperties;
}
