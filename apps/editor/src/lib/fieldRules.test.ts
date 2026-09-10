import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVisible, violations } from './fieldRules';
import type { SchemaSetting } from '../types';

// The same form and cases as tests/Unit/RulesTest.php: the two must agree.
const form: SchemaSetting[] = [
  { id: 'title', type: 'text', label: 'Title', required: true, character_limit: 20 },
  { id: 'kind', type: 'radio', label: 'Kind', display: 'buttons', options: [{ value: 'talk', label: 'Talk' }, { value: 'video', label: 'Video' }] },
  { id: 'video_url', type: 'url', label: 'Video', required: true, visible_if: [{ field: 'kind', value: 'video' }] },
  { id: 'contact', type: 'text', label: 'Contact', input_type: 'email' },
  { id: 'agree', type: 'checkbox', label: 'Agreed', required: true, visible_if: [{ field: 'contact', operator: 'not_empty' }] },
  { id: 'speakers', type: 'repeater', label: 'Speakers', max: 2, fields: [{ id: 'name', type: 'text', label: 'Name', required: true }] },
];

test('a valid entry has no violations', () => {
  assert.deepEqual(violations(form, { title: 'Launch', kind: 'talk', speakers: [{ name: 'Ada' }] }), []);
});

test('each rule reports the field by its path', () => {
  const found = violations(form, {
    title: 'x'.repeat(21),
    kind: 'video',
    contact: 'not an address',
    speakers: [{ name: 'Ada' }, { name: ' ' }, { name: 'Grace' }],
  });

  assert.deepEqual(Object.fromEntries(found.map((v) => [v.path, v.message])), {
    title: 'Title is longer than 20 characters.',
    video_url: 'Video is required.',
    contact: 'Contact is not an email address.',
    agree: 'Agreed is required.',
    speakers: 'Speakers has more than 2 rows.',
    'speakers.1.name': 'Speakers row 2 › Name is required.',
  });
});

test('a hidden field is never required', () => {
  const paths = violations(form, { title: 'Launch', kind: 'talk' }).map((v) => v.path);

  assert.ok(!paths.includes('video_url'));
  assert.ok(!paths.includes('agree'));
});

test('every operator', () => {
  const field = (operator: NonNullable<SchemaSetting['visible_if']>[number]['operator'], value?: unknown): SchemaSetting => ({
    id: 'b',
    type: 'text',
    label: 'B',
    visible_if: [{ field: 'a', operator, value }],
  });

  assert.ok(isVisible(field('equals', 'x'), { a: 'x' }));
  assert.ok(isVisible(field('equals', true), { a: true }));
  assert.ok(isVisible(field('not_equals', 'x'), { a: 'y' }));
  assert.ok(isVisible(field('contains', 'git'), { a: ['php', 'git'] }));
  assert.ok(isVisible(field('contains', 'it'), { a: 'git' }));
  assert.ok(isVisible(field('empty'), { a: [] }));
  assert.ok(isVisible(field('empty'), {}));
  assert.ok(!isVisible(field('not_empty'), { a: '  ' }));
  assert.ok(!isVisible(field('equals', 'x'), { a: 'y' }));
});
