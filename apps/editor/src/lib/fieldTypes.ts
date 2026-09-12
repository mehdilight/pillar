import { t } from '../i18n';
import type { FieldType, SchemaSetting } from '../types';

export type FieldCategory = 'text' | 'choice' | 'media' | 'relationship' | 'structure' | 'layout';

export const FIELD_CATEGORIES: Array<{ key: FieldCategory | 'all'; label: string }> = [
  { key: 'all', get label() { return t("All"); } },
  { key: 'text', get label() { return t("Text"); } },
  { key: 'choice', get label() { return t("Choice"); } },
  { key: 'media', get label() { return t("Media"); } },
  { key: 'relationship', get label() { return t("Relationship"); } },
  { key: 'structure', get label() { return t("Structure"); } },
  { key: 'layout', get label() { return t("Layout"); } },
];

export interface FieldTypeInfo {
  label: string;
  description: string;
  category: FieldCategory;
  /** A Phosphor icon name. */
  icon: string;
}

/**
 * What the field picker shows for each type.
 *
 * A `Record` over the generated union, so a type added to
 * `schema/field-types.json` without an entry here fails the type check rather
 * than appearing in the picker as a blank card.
 */
export const FIELD_TYPES: Record<FieldType, FieldTypeInfo> = {
  text: { get label() { return t("Text"); }, get description() { return t("A single line of text."); }, category: 'text', icon: 'text-t' },
  textarea: { get label() { return t("Textarea"); }, get description() { return t("Several lines of plain text."); }, category: 'text', icon: 'text-align-left' },
  markdown: { get label() { return t("Markdown"); }, get description() { return t("Formatted writing, stored as markdown."); }, category: 'text', icon: 'markdown-logo' },
  richtext: { get label() { return t("Rich text"); }, get description() { return t("Formatted writing, stored as HTML."); }, category: 'text', icon: 'article' },
  html: { get label() { return t("HTML"); }, get description() { return t("Raw HTML, inserted as written."); }, category: 'text', icon: 'file-html' },
  code: { get label() { return t("Code"); }, get description() { return t("A code snippet with a monospace editor."); }, category: 'text', icon: 'code' },
  url: { get label() { return t("Link"); }, get description() { return t("A page on the site or an external address."); }, category: 'text', icon: 'link' },
  number: { get label() { return t("Number"); }, get description() { return t("A whole or decimal number."); }, category: 'text', icon: 'hash' },
  range: { get label() { return t("Range"); }, get description() { return t("A number picked on a slider."); }, category: 'text', icon: 'sliders-horizontal' },
  date: { get label() { return t("Date"); }, get description() { return t("A calendar date, optionally with a time."); }, category: 'text', icon: 'calendar' },
  checkbox: { get label() { return t("Toggle"); }, get description() { return t("On or off."); }, category: 'choice', icon: 'toggle-left' },
  select: { get label() { return t("field.select"); }, get description() { return t("One option from a dropdown."); }, category: 'choice', icon: 'caret-circle-down' },
  radio: { get label() { return t("Radio"); }, get description() { return t("One option, all shown at once."); }, category: 'choice', icon: 'radio-button' },
  checkboxes: { get label() { return t("Checkboxes"); }, get description() { return t("Any number of options."); }, category: 'choice', icon: 'list-checks' },
  tags: { get label() { return t("Tags"); }, get description() { return t("Free-form labels, typed in."); }, category: 'choice', icon: 'tag' },
  color: { get label() { return t("Color"); }, get description() { return t("A colour from a picker."); }, category: 'choice', icon: 'palette' },
  image: { get label() { return t("Image"); }, get description() { return t("One image, or a gallery."); }, category: 'media', icon: 'image' },
  video: { get label() { return t("Video"); }, get description() { return t("A video file or address."); }, category: 'media', icon: 'video-camera' },
  file: { get label() { return t("File"); }, get description() { return t("A download: PDF, ZIP, document, audio."); }, category: 'media', icon: 'file-arrow-down' },
  icon: { get label() { return t("Icon"); }, get description() { return t("An icon from the Phosphor set."); }, category: 'media', icon: 'shapes' },
  collection_item: { get label() { return t("Entries"); }, get description() { return t("Link to entries — related posts, an author, featured docs."); }, category: 'relationship', icon: 'files' },
  collection: { get label() { return t("Collection"); }, get description() { return t("A whole collection, to list its entries."); }, category: 'relationship', icon: 'folders' },
  page: { get label() { return t("Page"); }, get description() { return t("Link to one of the site’s pages."); }, category: 'relationship', icon: 'file-text' },
  menu: { get label() { return t("Menu"); }, get description() { return t("A navigation list."); }, category: 'relationship', icon: 'list' },
  group: { get label() { return t("Group"); }, get description() { return t("Fields kept together as one value."); }, category: 'structure', icon: 'brackets-curly' },
  repeater: { get label() { return t("Repeater"); }, get description() { return t("A list of rows, each with the same fields."); }, category: 'structure', icon: 'rows' },
  table: { get label() { return t("Table"); }, get description() { return t("Rows and columns of text."); }, category: 'structure', icon: 'table' },
  header: { get label() { return t("Section heading"); }, get description() { return t("A heading that organises the form."); }, category: 'layout', icon: 'text-h' },
  paragraph: { get label() { return t("Instructions"); }, get description() { return t("A note for whoever fills in the form."); }, category: 'layout', icon: 'paragraph' },
};

/** Types that hold other fields. */
export const holdsFields = (type: FieldType) => type === 'group' || type === 'repeater';

/** Types that need a list of options. */
export const needsOptions = (type: FieldType) => type === 'select' || type === 'radio' || type === 'checkboxes';

/** Types that carry no value, only structure. */
export const isDecorative = (type: FieldType) => type === 'header' || type === 'paragraph';

/** Fields that take a form's full width; the rest sit two to a row. */
export const isWide = (field: SchemaSetting) =>
  ['group', 'repeater', 'table', 'markdown', 'richtext', 'html', 'code', 'textarea'].includes(field.type) || (field.type === 'image' && Boolean(field.multiple));

/** `Cover image` → `cover_image` — the shape a schema id must have. */
export function handleFrom(label: string): string {
  const handle = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return /^[a-z]/.test(handle) ? handle : handle ? `field_${handle}` : 'field';
}

export const validHandle = (handle: string) => /^[a-z][a-z0-9_]*$/.test(handle);

/** A handle not yet taken among `taken`: `title`, then `title_2`… */
export function uniqueHandle(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;

  let n = 2;

  while (taken.includes(`${base}_${n}`)) n++;

  return `${base}_${n}`;
}

/** A new field of `type`, ready to configure. */
export function newField(type: FieldType, taken: string[]): SchemaSetting {
  const info = FIELD_TYPES[type];
  const field: SchemaSetting = { id: uniqueHandle(handleFrom(info.label), taken), type, label: info.label };

  if (isDecorative(type)) {
    field.id = '';
    field.content = info.label;
  }

  if (needsOptions(type)) field.options = [{ value: 'first', label: t("First") }, { value: 'second', label: t("Second") }];
  if (holdsFields(type)) field.fields = [{ id: 'title', type: 'text', label: t("Title") }];
  if (type === 'range') Object.assign(field, { min: 0, max: 100, step: 1 });

  return field;
}

/** A field as it goes into a schema file: empty options dropped, nothing the type does not use. */
export function cleanField(field: SchemaSetting): SchemaSetting {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(field)) {
    // `false` is dropped only for on/off options; a checkbox's `default: false` is kept.
    if (value === undefined || value === '' || (value === false && key !== 'default') || (Array.isArray(value) && value.length === 0)) continue;
    out[key] = key === 'fields' && Array.isArray(value) ? (value as SchemaSetting[]).map(cleanField) : value;
  }

  if (!needsOptions(field.type)) delete out.options;
  if (!holdsFields(field.type)) delete out.fields;
  if (field.type !== 'image' && field.type !== 'collection_item') delete out.multiple;
  if (field.type !== 'collection_item') delete out.collections;
  if (field.type !== 'date') delete out.time;
  if (!['text', 'textarea', 'markdown', 'richtext'].includes(field.type)) delete out.character_limit;
  if (field.type !== 'text' || out.input_type === 'text') delete out.input_type;
  if (field.type !== 'radio') delete out.display;
  if (field.type !== 'file') delete out.extensions;
  if (isDecorative(field.type)) {
    delete out.required;
    delete out.visible_if;
    delete out.hidden;
  }
  if (Array.isArray(out.visible_if)) {
    out.visible_if = (out.visible_if as Array<Record<string, unknown>>).map((rule) =>
      Object.fromEntries(
        Object.entries(rule).filter(
          ([key, value]) =>
            value !== undefined && !(key === 'operator' && value === 'equals') && !(key === 'value' && ['empty', 'not_empty'].includes(String(rule.operator)))
        )
      )
    );
  }
  if (isDecorative(field.type)) delete out.id;

  return out as unknown as SchemaSetting;
}
