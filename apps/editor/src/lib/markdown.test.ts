import test from 'node:test';
import assert from 'node:assert/strict';
import { joinSoftBreaks, tidyMarkdown } from './markdown';

test('runs of blank lines collapse to one', () => {
  assert.equal(tidyMarkdown('a\n\n\n\n| t |\n\n\nb'), 'a\n\n| t |\n\nb');
});

test('a single blank line is left alone', () => {
  assert.equal(tidyMarkdown('one\n\ntwo'), 'one\n\ntwo');
});

test('blank lines inside fenced code are the code’s own', () => {
  const code = '```php\n$a = 1;\n\n\n$b = 2;\n```';

  assert.equal(tidyMarkdown(`intro\n\n\n${code}\n\n\nafter`), `intro\n\n${code}\n\nafter`);
});

test('a tilde fence is honoured, and a shorter marker does not close a longer fence', () => {
  const code = '~~~~\nx\n\n\n```\nstill code\n\n\n~~~~';

  assert.equal(tidyMarkdown(code), code);
});

test('text without blank-line runs is returned unchanged', () => {
  const text = '# Title\n\nA paragraph\nwrapped.\n\n- one\n- two\n';

  assert.equal(tidyMarkdown(text), text);
});

test('soft line breaks in a paragraph become spaces', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'wrapped at\nseventy-eight' }] }] };

  assert.equal(joinSoftBreaks(doc).content[0].content![0].text, 'wrapped at seventy-eight');
});

test('a code block keeps its newlines', () => {
  const code = { type: 'codeBlock', content: [{ type: 'text', text: 'line one\nline two' }] };
  const doc = { type: 'doc', content: [code] };

  assert.equal(joinSoftBreaks(doc).content[0].content![0].text, 'line one\nline two');
});

test('the input is not mutated', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a\nb' }] }] };

  joinSoftBreaks(doc);
  assert.equal(doc.content[0].content[0].text, 'a\nb');
});
