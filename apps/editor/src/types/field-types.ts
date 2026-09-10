/**
 * The setting types a `<schema>` block may declare.
 *
 * GENERATED from schema/field-types.json by tools/generate-field-types.php.
 * Do not edit by hand — PHP's FieldType enum is generated from the same file.
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'markdown'
  | 'html'
  | 'code'
  | 'url'
  | 'number'
  | 'range'
  | 'checkbox'
  | 'select'
  | 'radio'
  | 'checkboxes'
  | 'color'
  | 'icon'
  | 'image'
  | 'video'
  | 'file'
  | 'date'
  | 'tags'
  | 'menu'
  | 'page'
  | 'collection'
  | 'collection_item'
  | 'group'
  | 'repeater'
  | 'table'
  | 'header'
  | 'paragraph';

export const DECORATIVE_FIELD_TYPES: FieldType[] = ['header', 'paragraph'];
