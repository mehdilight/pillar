import type { JSX } from 'solid-js';

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
}

/** Mirrors `schema/field-types.json` — the one list both sides are generated from. */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'markdown'
  | 'number'
  | 'range'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'color'
  | 'url'
  | 'image'
  | 'video'
  | 'html'
  | 'code'
  | 'date'
  | 'tags'
  | 'menu'
  | 'page'
  | 'collection'
  | 'collection_item'
  | 'header'
  | 'paragraph';

export const DECORATIVE_FIELD_TYPES: FieldType[] = ['header', 'paragraph'];

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
  name: string;
  label: string;
  /** The frontmatter form, in the same vocabulary as a section's settings. */
  fields: SchemaSetting[];
  count: number;
}

export interface ContentItem {
  collection: string;
  slug: string;
  title: string;
  frontmatter: Record<string, any>;
  body: string;
  updated_at?: string;
}

/** One panel of `config/settings_schema.json`. */
export interface SettingsPanelSchema {
  name: string;
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

export type EditorTab = 'sections' | 'settings' | 'content';

export interface IconProps {
  size?: number;
  class?: string;
  style?: JSX.CSSProperties;
}
