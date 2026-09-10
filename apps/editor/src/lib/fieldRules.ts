import type { SchemaSetting } from '../types';

/**
 * The dashboard's copy of `Schema\Rules`: whether a field is shown, and what
 * is wrong with a value — so a form says so before the server refuses it.
 * Keep the two in step; fieldRules.test.ts pins the same cases as RulesTest.
 */

export interface Violation {
  /** Dotted, into groups and rows: `faq.1.question`. */
  path: string;
  message: string;
}

/** Nothing there: unset, blank, an empty list — or a toggle left off. */
export const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === false || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '');

const scalar = (value: unknown) => (value === null || value === undefined || typeof value === 'object' ? '' : String(value));

function equals(value: unknown, expected: unknown): boolean {
  if (Array.isArray(value)) return value.map(scalar).includes(scalar(expected));
  if (typeof value === 'boolean' || typeof expected === 'boolean') return Boolean(value) === (expected === true || expected === 'true' || expected === '1' || expected === 1);

  return scalar(value) === scalar(expected);
}

/** Whether a field is shown, given the values beside it. */
export function isVisible(field: SchemaSetting, siblings: Record<string, unknown>): boolean {
  return (field.visible_if ?? []).every((rule) => {
    const value = siblings[rule.field];

    switch (rule.operator ?? 'equals') {
      case 'empty':
        return isEmpty(value);
      case 'not_empty':
        return !isEmpty(value);
      case 'not_equals':
        return !equals(value, rule.value);
      case 'contains':
        return Array.isArray(value) ? value.map(scalar).includes(scalar(rule.value)) : scalar(value).includes(scalar(rule.value));
      default:
        return equals(value, rule.value);
    }
  });
}

const textOf = (field: SchemaSetting, value: string) =>
  field.type === 'richtext' ? value.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ') : value;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Everything wrong with `values`, into groups and repeater rows. */
export function violations(fields: SchemaSetting[], values: Record<string, unknown>, path = '', label = ''): Violation[] {
  const out: Violation[] = [];

  for (const field of fields) {
    if (field.type === 'header' || field.type === 'paragraph' || !isVisible(field, values)) continue;

    const value = values[field.id];
    const where = path + field.id;
    const name = label + (field.label || field.id);

    if (field.required && isEmpty(value)) {
      out.push({ path: where, message: `${name} is required.` });
      continue;
    }

    if (field.character_limit && typeof value === 'string' && [...textOf(field, value)].length > field.character_limit) {
      out.push({ path: where, message: `${name} is longer than ${field.character_limit} characters.` });
    }

    if (field.input_type === 'email' && typeof value === 'string' && value !== '' && !EMAIL.test(value)) {
      out.push({ path: where, message: `${name} is not an email address.` });
    }

    const many = field.type === 'repeater' || (field.type === 'collection_item' && field.multiple);

    if (many && field.max !== undefined && Array.isArray(value) && value.length > field.max) {
      out.push({ path: where, message: `${name} has more than ${field.max} ${field.type === 'repeater' ? 'rows' : 'entries'}.` });
    }

    if (field.type === 'group' && value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...violations(field.fields ?? [], value as Record<string, unknown>, `${where}.`, `${name} › `));
    }

    if (field.type === 'repeater' && Array.isArray(value)) {
      value.forEach((row, index) => {
        if (row && typeof row === 'object') {
          out.push(...violations(field.fields ?? [], row as Record<string, unknown>, `${where}.${index}.`, `${name} row ${index + 1} › `));
        }
      });
    }
  }

  return out;
}
