/**
 * Content analysis — the assessments Yoast made mainstream, rewritten for a
 * COD content page rather than a blog post.
 *
 * Yoast's own `yoastseo` package is ~143k lines and genuinely worth using;
 * it is also a large dependency with a morphology/segmentation tree behind
 * it. This is the focused subset that actually changes what a author does
 * about a content page, in a form a plugin bundle can carry. The interface
 * (`Assessment[]` in, score out) is deliberately the shape `yoastseo`
 * returns, so swapping the engine later does not mean rewriting the panel.
 *
 * Two scores, not one, because they answer different questions and a single
 * number hides the trade-off: the SEO score asks "will this be found", the
 * readability score asks "will it be read".
 */

export type Rating = 'good' | 'ok' | 'bad' | 'unknown';

export interface Assessment {
  id: string;
  rating: Rating;
  /**
   * A locale key, not a sentence. The engine stays language-agnostic — which
   * matters both for the admin's own en/fr and for the day `yoastseo`
   * replaces this, since it has its own translations to map in.
   */
  key: string;
  /** Interpolation values for `key`. */
  vars?: Record<string, string | number>;
  /** Higher counts for more in the aggregate. */
  weight: number;
}

export interface AnalysisInput {
  /** The resolved title a searcher will see, not the raw template. */
  title: string;
  description: string;
  /** The body being edited, HTML allowed. */
  content: string;
  /** The URL slug. */
  handle: string;
  keyphrase: string;
  /** Picks the transition-word list; everything else is language-agnostic. */
  language?: string;
}

export interface AnalysisResult {
  seo: { score: number; assessments: Assessment[] };
  readability: { score: number; assessments: Assessment[] };
}

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 156;
/** Below this a content page has too little text to rank for anything. */
const CONTENT_MIN_WORDS = 150;
/** Yoast's window, and it holds up: under 0.5% reads as unfocused, over 3% as stuffed. */
const DENSITY_MIN = 0.5;
const DENSITY_MAX = 3;

export function analyse(input: AnalysisInput): AnalysisResult {
  const text = stripTags(input.content);
  const words = wordsOf(text);
  const keyphrase = input.keyphrase.trim();

  const seo = keyphrase === '' ? withoutKeyphrase(input, words) : withKeyphrase(input, text, words, keyphrase);

  return {
    seo: { score: aggregate(seo), assessments: seo },
    readability: readability(text, (input.language ?? 'en').slice(0, 2)),
  };
}

/* ------------------------------------------------------------------ SEO */

function withoutKeyphrase(input: AnalysisInput, words: string[]): Assessment[] {
  return [
    {
      id: 'keyphrase',
      rating: 'bad',
      weight: 3,
      key: 'analysis.keyphrase.missing',
    },
    ...titleLength(input.title),
    ...descriptionLength(input.description),
    ...contentLength(words),
  ];
}

function withKeyphrase(input: AnalysisInput, text: string, words: string[], keyphrase: string): Assessment[] {
  const needle = normalise(keyphrase);
  const haystack = normalise(text);

  return [
    keyphraseInTitle(input.title, needle),
    keyphraseInDescription(input.description, needle),
    keyphraseInHandle(input.handle, keyphrase),
    keyphraseInContent(haystack, needle),
    keyphraseDensity(haystack, needle, words.length),
    ...titleLength(input.title),
    ...descriptionLength(input.description),
    ...contentLength(words),
  ];
}

function keyphraseInTitle(title: string, needle: string): Assessment {
  const haystack = normalise(title);
  const at = haystack.indexOf(needle);

  if (at < 0) {
    return {
      id: 'keyphrase-title',
      rating: 'bad',
      weight: 3,
      key: 'analysis.keyphrase_title.absent',
    };
  }

  // Near the beginning matters: a searcher scanning results reads the first
  // few words, and a truncated title keeps only those.
  if (at > haystack.length / 2) {
    return {
      id: 'keyphrase-title',
      rating: 'ok',
      weight: 3,
      key: 'analysis.keyphrase_title.late',
    };
  }

  return { id: 'keyphrase-title', rating: 'good', weight: 3, key: 'analysis.keyphrase_title.good' };
}

function keyphraseInDescription(description: string, needle: string): Assessment {
  if (description.trim() === '') {
    return {
      id: 'keyphrase-description',
      rating: 'bad',
      weight: 2,
      key: 'analysis.keyphrase_description.no_description',
    };
  }

  return normalise(description).includes(needle)
    ? { id: 'keyphrase-description', rating: 'good', weight: 2, key: 'analysis.keyphrase_description.good' }
    : { id: 'keyphrase-description', rating: 'bad', weight: 2, key: 'analysis.keyphrase_description.absent' };
}

function keyphraseInHandle(handle: string, keyphrase: string): Assessment {
  const slug = normalise(handle).replace(/-/g, ' ');
  const words = normalise(keyphrase).split(/\s+/).filter(Boolean);
  const hits = words.filter((word) => slug.includes(word)).length;

  if (words.length === 0 || hits === 0) {
    return { id: 'keyphrase-handle', rating: 'bad', weight: 2, key: 'analysis.keyphrase_handle.absent' };
  }

  return hits === words.length
    ? { id: 'keyphrase-handle', rating: 'good', weight: 2, key: 'analysis.keyphrase_handle.good' }
    : { id: 'keyphrase-handle', rating: 'ok', weight: 2, key: 'analysis.keyphrase_handle.partial' };
}

function keyphraseInContent(haystack: string, needle: string): Assessment {
  return haystack.includes(needle)
    ? { id: 'keyphrase-content', rating: 'good', weight: 3, key: 'analysis.keyphrase_content.good' }
    : { id: 'keyphrase-content', rating: 'bad', weight: 3, key: 'analysis.keyphrase_content.absent' };
}

function keyphraseDensity(haystack: string, needle: string, wordCount: number): Assessment {
  if (wordCount === 0) {
    return { id: 'density', rating: 'unknown', weight: 2, key: 'analysis.density.unmeasurable' };
  }

  const occurrences = countOccurrences(haystack, needle);
  const density = (occurrences * needle.split(/\s+/).length * 100) / wordCount;
  const shown = density.toFixed(1);

  if (density > DENSITY_MAX) {
    return {
      id: 'density',
      rating: 'bad',
      weight: 2,
      key: 'analysis.density.stuffed',
      vars: { occurrences, density: shown },
    };
  }

  if (density < DENSITY_MIN) {
    return {
      id: 'density',
      rating: 'ok',
      weight: 2,
      key: 'analysis.density.thin',
      vars: { occurrences, density: shown },
    };
  }

  return { id: 'density', rating: 'good', weight: 2, key: 'analysis.density.good', vars: { density: shown } };
}

function titleLength(title: string): Assessment[] {
  const length = title.trim().length;

  if (length === 0) {
    return [{ id: 'title-length', rating: 'bad', weight: 3, key: 'analysis.title_length.missing' }];
  }

  if (length > TITLE_MAX) {
    return [
      {
        id: 'title-length',
        rating: 'bad',
        weight: 2,
        // Google truncates by pixel width, but character count is the version
        // a author can act on without a measuring tool.
        key: 'analysis.title_length.long',
        vars: { length },
      },
    ];
  }

  if (length < TITLE_MIN) {
    return [{ id: 'title-length', rating: 'ok', weight: 2, key: 'analysis.title_length.short', vars: { length } }];
  }

  return [{ id: 'title-length', rating: 'good', weight: 2, key: 'analysis.title_length.good', vars: { length } }];
}

function descriptionLength(description: string): Assessment[] {
  const length = description.trim().length;

  if (length === 0) {
    return [{ id: 'description-length', rating: 'bad', weight: 2, key: 'analysis.description_length.missing' }];
  }

  if (length > DESCRIPTION_MAX) {
    return [{ id: 'description-length', rating: 'ok', weight: 1, key: 'analysis.description_length.long', vars: { length } }];
  }

  if (length < DESCRIPTION_MIN) {
    return [{ id: 'description-length', rating: 'ok', weight: 1, key: 'analysis.description_length.short', vars: { length } }];
  }

  return [{ id: 'description-length', rating: 'good', weight: 1, key: 'analysis.description_length.good', vars: { length } }];
}

function contentLength(words: string[]): Assessment[] {
  const count = words.length;

  if (count >= CONTENT_MIN_WORDS) {
    return [{ id: 'content-length', rating: 'good', weight: 2, key: 'analysis.content_length.good', vars: { words: count } }];
  }

  if (count >= CONTENT_MIN_WORDS / 2) {
    return [{ id: 'content-length', rating: 'ok', weight: 2, key: 'analysis.content_length.short', vars: { words: count, target: CONTENT_MIN_WORDS } }];
  }

  return [{ id: 'content-length', rating: 'bad', weight: 2, key: 'analysis.content_length.thin', vars: { words: count } }];
}

/* ---------------------------------------------------------- Readability */

function readability(text: string, language: string): { score: number; assessments: Assessment[] } {
  const sentences = sentencesOf(text);

  if (sentences.length === 0) {
    return {
      score: 0,
      assessments: [{ id: 'readability', rating: 'unknown', weight: 1, key: 'analysis.readability.unmeasurable' }],
    };
  }

  const assessments = [sentenceLength(sentences), paragraphLength(text), transitionWords(sentences, language)];

  return { score: aggregate(assessments), assessments };
}

function sentenceLength(sentences: string[]): Assessment {
  // 20 words is the usual comfortable ceiling; the assessment is about the
  // proportion of long sentences, not the average, because one 60-word
  // sentence is a real problem an average hides.
  const long = sentences.filter((sentence) => wordsOf(sentence).length > 20).length;
  const share = Math.round((long / sentences.length) * 100);

  if (share <= 25) {
    return { id: 'sentence-length', rating: 'good', weight: 2, key: 'analysis.sentence_length.good', vars: { share } };
  }

  return share <= 40
    ? { id: 'sentence-length', rating: 'ok', weight: 2, key: 'analysis.sentence_length.ok', vars: { share } }
    : { id: 'sentence-length', rating: 'bad', weight: 2, key: 'analysis.sentence_length.bad', vars: { share } };
}

function paragraphLength(text: string): Assessment {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const long = paragraphs.filter((p) => wordsOf(p).length > 150).length;

  if (long === 0) {
    return { id: 'paragraph-length', rating: 'good', weight: 1, key: 'analysis.paragraph_length.good' };
  }

  return { id: 'paragraph-length', rating: 'ok', weight: 1, key: 'analysis.paragraph_length.long', vars: { paragraphs: long } };
}

/**
 * Transition words, per language — the one genuinely language-dependent
 * assessment here, and the reason `analyse()` takes a language at all.
 * Everything else counts characters, words and sentences.
 *
 * Stored de-accented because `normalise()` strips accents before matching.
 */
const TRANSITIONS: Record<string, string[]> = {
  fr: [
    'ainsi', 'alors', 'aussi', 'car', 'cependant', 'donc', 'en effet', 'enfin', 'ensuite',
    'mais', 'meme si', 'par ailleurs', 'parce que', 'pourtant', 'puisque', 'toutefois',
    "d'abord", 'de plus', 'par exemple', 'en revanche', 'grace a', 'afin de',
  ],
  en: [
    'also', 'although', 'as a result', 'because', 'besides', 'but', 'finally', 'first',
    'however', 'in addition', 'in fact', 'meanwhile', 'moreover', 'nevertheless', 'next',
    'for example', 'on the other hand', 'so', 'therefore', 'thus', 'while', 'in order to',
  ],
};

function transitionWords(sentences: string[], language: string): Assessment {
  const words = TRANSITIONS[language] ?? TRANSITIONS.en;

  const withTransition = sentences.filter((sentence) => {
    const lower = normalise(sentence);
    return words.some((word) => lower.includes(word));
  }).length;

  const share = Math.round((withTransition / sentences.length) * 100);

  if (share >= 30) {
    return { id: 'transitions', rating: 'good', weight: 1, key: 'analysis.transitions.good', vars: { share } };
  }

  return share >= 20
    ? { id: 'transitions', rating: 'ok', weight: 1, key: 'analysis.transitions.ok', vars: { share } }
    : { id: 'transitions', rating: 'bad', weight: 1, key: 'analysis.transitions.bad', vars: { share } };
}

/* ------------------------------------------------------------- helpers */

/**
 * Weighted mean over the ratings, 0–100.
 *
 * `unknown` is excluded rather than counted as zero: "we could not measure
 * this" must not read the same as "this is wrong", or a product with a
 * short description gets punished twice for it.
 */
export function aggregate(assessments: Assessment[]): number {
  const scored = assessments.filter((a) => a.rating !== 'unknown');

  if (scored.length === 0) {
    return 0;
  }

  const total = scored.reduce((sum, a) => sum + a.weight, 0);
  const earned = scored.reduce((sum, a) => sum + a.weight * ratingValue(a.rating), 0);

  return Math.round((earned / total) * 100);
}

function ratingValue(rating: Rating): number {
  return rating === 'good' ? 1 : rating === 'ok' ? 0.5 : 0;
}

/** The traffic light a score earns, matching Yoast's thresholds. */
export function ratingFor(score: number): Rating {
  if (score >= 70) return 'good';
  if (score >= 40) return 'ok';
  return 'bad';
}

export function stripTags(html: string): string {
  return html
    // Block-level tags become paragraph breaks, so paragraph length means
    // something on HTML input rather than collapsing to one long block.
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    // Spaces left hugging a break by the tag substitution above, so a
    // paragraph split does not hand back leading whitespace.
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
}

function sentencesOf(text: string): string[] {
  return text
    .split(/[.!?…]+\s|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => wordsOf(s).length > 0);
}

/** Lowercased and de-accented, so "sérum" matches "serum" as a author expects. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;

  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }

  return count;
}
