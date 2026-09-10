import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, aggregate, ratingFor, stripTags } from './analysis.ts';
import en from './locales/en.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };

/**
 * The content analysis. Run with `node --test` from plugins/seo/frontend
 * after `node build.mjs` (which also emits the plain-ESM build this imports).
 *
 * The assertions are about *behaviour a merchant would notice* — a missing
 * keyphrase scoring badly, stuffing scoring badly, an accented keyphrase
 * matching its unaccented form — not about exact numbers, which are a
 * weighting decision rather than a contract.
 */

const BASE = {
  title: 'Sérum vitamine C éclat · Ma Boutique',
  description: 'Un sérum vitamine C qui ravive l’éclat du teint en quelques jours seulement, livré chez vous.',
  content:
    '<p>Ce sérum vitamine C est formulé pour les peaux ternes. Ainsi, il ravive le teint. ' +
    'Ensuite, il hydrate en profondeur. Donc la peau retrouve son éclat naturel jour après jour. ' +
    'Par ailleurs, sa texture légère pénètre vite.</p>',
  handle: 'serum-vitamine-c',
  keyphrase: 'sérum vitamine c',
};

test('a page with no keyphrase is told so, and scores badly', () => {
  const result = analyse({ ...BASE, keyphrase: '' });

  assert.ok(result.seo.assessments.some((a) => a.id === 'keyphrase' && a.rating === 'bad'));
  assert.ok(result.seo.score < 70);
});

test('a well-optimised page scores well', () => {
  const result = analyse(BASE);

  assert.ok(result.seo.score >= 70, `expected a good score, got ${result.seo.score}`);
  assert.equal(ratingFor(result.seo.score), 'good');
});

test('the keyphrase is matched without accents', () => {
  // A merchant typing "serum vitamine c" must match content saying "sérum".
  const result = analyse({ ...BASE, keyphrase: 'serum vitamine c' });
  const inContent = result.seo.assessments.find((a) => a.id === 'keyphrase-content');

  assert.equal(inContent.rating, 'good');
});

test('a keyphrase late in the title is only a partial pass', () => {
  const result = analyse({ ...BASE, title: 'Ma Boutique — la meilleure boutique — sérum vitamine c' });
  const inTitle = result.seo.assessments.find((a) => a.id === 'keyphrase-title');

  assert.equal(inTitle.rating, 'ok');
});

test('a keyphrase missing from the title fails that assessment', () => {
  const result = analyse({ ...BASE, title: 'Un produit quelconque' });

  assert.equal(result.seo.assessments.find((a) => a.id === 'keyphrase-title').rating, 'bad');
});

test('keyword stuffing is reported as bad, not as good', () => {
  const stuffed = Array.from({ length: 40 }, () => 'sérum vitamine c').join(' ');
  const result = analyse({ ...BASE, content: stuffed });
  const density = result.seo.assessments.find((a) => a.id === 'density');

  assert.equal(density.rating, 'bad');
  assert.equal(density.key, 'analysis.density.stuffed');
  assert.equal(density.vars.occurrences, 40);
});

test('a keyphrase absent from the URL is reported', () => {
  const result = analyse({ ...BASE, handle: 'produit-123' });

  assert.equal(result.seo.assessments.find((a) => a.id === 'keyphrase-handle').rating, 'bad');
});

test('a partial keyphrase in the URL is a partial pass', () => {
  const result = analyse({ ...BASE, handle: 'serum-eclat' });

  assert.equal(result.seo.assessments.find((a) => a.id === 'keyphrase-handle').rating, 'ok');
});

test('an over-long title is flagged', () => {
  const result = analyse({ ...BASE, title: 'x'.repeat(90) });

  assert.equal(result.seo.assessments.find((a) => a.id === 'title-length').rating, 'bad');
});

test('an empty description is flagged rather than silently scored', () => {
  const result = analyse({ ...BASE, description: '' });

  assert.equal(result.seo.assessments.find((a) => a.id === 'description-length').rating, 'bad');
});

test('thin content is flagged', () => {
  const result = analyse({ ...BASE, content: '<p>Sérum vitamine c.</p>' });

  assert.equal(result.seo.assessments.find((a) => a.id === 'content-length').rating, 'bad');
});

test('readability is reported separately from SEO', () => {
  const result = analyse(BASE);

  assert.ok(result.readability.assessments.length > 0);
  assert.ok(result.readability.assessments.some((a) => a.id === 'transitions'));
});

test('text with no sentences reports unknown rather than zero-scoring everything', () => {
  const result = analyse({ ...BASE, content: '' });

  assert.equal(result.readability.assessments[0].rating, 'unknown');
});

test('an unknown rating is excluded from the aggregate rather than counted as bad', () => {
  const withUnknown = aggregate([
    { id: 'a', rating: 'good', weight: 1, key: 'a' },
    { id: 'b', rating: 'unknown', weight: 9, key: 'b' },
  ]);

  assert.equal(withUnknown, 100, '"could not measure" must not read as "wrong"');
});

test('aggregate has no opinion about an empty list', () => {
  assert.equal(aggregate([]), 0);
});

test('stripTags turns block tags into paragraph breaks', () => {
  // Otherwise paragraph-length analysis sees one long block on HTML input.
  assert.match(stripTags('<p>Un</p><p>Deux</p>'), /Un\n\nDeux/);
});

test('every assessment carries a locale key that both locales define', () => {
  // The panel renders `t(assessment.key)`; a key with no string shows the key
  // itself to the merchant, which is the failure this catches.
  const inputs = [
    BASE,
    { ...BASE, keyphrase: '' },
    { ...BASE, title: '', description: '', content: '' },
    { ...BASE, title: 'x'.repeat(90), content: Array.from({ length: 40 }, () => 'sérum vitamine c').join(' ') },
    { ...BASE, handle: 'produit-123', content: '<p>Court.</p>' },
    { ...BASE, title: 'Ma Boutique — encore et encore — sérum vitamine c' },
  ];

  const keys = new Set();

  for (const input of inputs) {
    const result = analyse(input);
    for (const a of [...result.seo.assessments, ...result.readability.assessments]) {
      assert.ok(a.key, `assessment ${a.id} has no key`);
      keys.add(a.key);
    }
  }

  const missingEn = [...keys].filter((k) => !(k in en));
  const missingFr = [...keys].filter((k) => !(k in fr));

  assert.deepEqual(missingEn, [], 'keys missing from en.json');
  assert.deepEqual(missingFr, [], 'keys missing from fr.json');
});

test('the two locales define exactly the same keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
});

test('every interpolation placeholder in a string has a matching one in the other locale', () => {
  const placeholders = (value) => (value.match(/\{\{(\w+)\}\}/g) ?? []).sort();

  for (const key of Object.keys(en)) {
    assert.deepEqual(
      placeholders(en[key]),
      placeholders(fr[key]),
      `${key} interpolates different variables in en and fr`,
    );
  }
});

test('transition words are matched per language', () => {
  const english = { ...BASE, language: 'en', content: '<p>This serum works. However, it also hydrates. Therefore the skin looks brighter. Moreover it absorbs fast and never feels sticky at all in daily use.</p>' };

  const withEnglish = analyse(english).readability.assessments.find((a) => a.id === 'transitions');
  const withFrench = analyse({ ...english, language: 'fr' }).readability.assessments.find((a) => a.id === 'transitions');

  assert.equal(withEnglish.rating, 'good');
  assert.equal(withFrench.rating, 'bad', 'French transition words should not match English prose');
});
