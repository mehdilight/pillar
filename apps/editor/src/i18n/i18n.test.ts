import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createComputed, createRoot } from 'solid-js';
import en from './en.json';
import fr from './fr.json';
import { createTranslator, formatDate, i18n, language, resolveLanguage, setLanguage, t, LANGUAGE_STORAGE_KEY } from './index';
import { FIELD_TYPES, newField } from '../lib/fieldTypes';
import { violations } from '../lib/fieldRules';

afterEach(() => setLanguage('en'));

test('French and English catalogs have matching messages and interpolation variables', () => {
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  const vars = (value: string) => (value.match(/{{\s*[^}]+\s*}}/g) ?? []).sort();
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    assert.ok(fr[key].trim(), key);
    assert.deepEqual(vars(fr[key]), vars(en[key]), key);
  }
});

test('regional browser preferences resolve to supported languages with an English fallback', () => {
  assert.equal(resolveLanguage(['fr-CA', 'en-US']), 'fr');
  assert.equal(resolveLanguage(['de-DE', 'fr_FR']), 'fr');
  assert.equal(resolveLanguage(['en-GB', 'fr']), 'en');
  assert.equal(resolveLanguage(['de']), 'en');
  assert.equal(resolveLanguage([]), 'en');
});

test('switching language updates existing reactive consumers and static toolbar descriptors', () => {
  createRoot((dispose) => {
    const values: string[] = [];
    createComputed(() => values.push(`${t('Save')} / ${FIELD_TYPES.text.label}`));
    setLanguage('fr');
    setLanguage('en');
    assert.deepEqual(values, ['Save / Text', 'Enregistrer / Texte', 'Save / Text']);
    dispose();
  });
});

test('i18next applies English and French plural rules, including zero', () => {
  setLanguage('en');
  assert.equal(t('count.entry', { count: 0 }), '0 entries');
  assert.equal(t('count.entry', { count: 1 }), '1 entry');
  assert.equal(t('count.entry', { count: 2 }), '2 entries');
  setLanguage('fr');
  assert.equal(t('count.entry', { count: 0 }), '0 entrée');
  assert.equal(t('count.entry', { count: 1 }), '1 entrée');
  assert.equal(t('count.entry', { count: 2 }), '2 entrées');
  assert.match(t('publish.files', { count: 2, branch: 'main' }), /^2 fichiers seront/);
});

test('plugin namespaces follow the host language and fall back to English', () => {
  const translate = createTranslator('test.plugin', {
    en: { greeting: 'Hello {{name}}', onlyEnglish: 'Fallback' },
    fr: { greeting: 'Bonjour {{name}}' },
  });
  setLanguage('fr');
  assert.equal(translate('greeting', { name: '<Ada & Co>' }), 'Bonjour <Ada & Co>');
  assert.equal(translate('onlyEnglish'), 'Fallback');
  assert.equal(i18n.language, 'fr');
  setLanguage('en');
  assert.equal(translate('greeting', { name: 'Ada' }), 'Hello Ada');
});

test('new form data remains editable and does not change when the interface language changes', () => {
  setLanguage('en');
  const field = newField('select', []);
  const original = JSON.stringify(field);
  setLanguage('fr');
  assert.equal(JSON.stringify(field), original);
  field.options![0].label = 'My own label';
  assert.equal(field.options![0].label, 'My own label');
  const issues = violations([{ id: 'title', type: 'text', label: 'My title', required: true }], {});
  assert.equal(issues[0].message, 'My title est obligatoire.');
  assert.equal(issues[0].path, 'title');
});

test('preference persistence tolerates unavailable storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      setItem(key: string, value: string) { values.set(key, value); },
    } });
    setLanguage('fr');
    assert.equal(values.get(LANGUAGE_STORAGE_KEY), 'fr');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    assert.doesNotThrow(() => setLanguage('en'));
    assert.equal(language(), 'en');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('date formatting follows the selected language', () => {
  const date = new Date('2026-09-12T12:00:00Z');
  const options = { month: 'long', timeZone: 'UTC' } as const;
  setLanguage('en');
  assert.equal(formatDate(date, options), 'September');
  setLanguage('fr');
  assert.equal(formatDate(date, options), 'septembre');
});
