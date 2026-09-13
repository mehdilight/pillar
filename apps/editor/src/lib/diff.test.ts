import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiff } from './diff';

test('aligns unequal replacement blocks and preserves context line numbers', () => {
  const [file] = parseDiff('diff --git a/page.md b/page.md\n--- a/page.md\n+++ b/page.md\n@@ -8,3 +8,4 @@\n context\n-old\n+new\n+extra\n tail\n');
  assert.equal(file.path, 'page.md');
  assert.deepEqual(file.hunks[0].rows, [
    { before: { text: 'context', number: 8 }, after: { text: 'context', number: 8 }, changed: false },
    { before: { text: 'old', number: 9 }, after: { text: 'new', number: 9 }, changed: true },
    { before: undefined, after: { text: 'extra', number: 10 }, changed: true },
    { before: { text: 'tail', number: 10 }, after: { text: 'tail', number: 11 }, changed: false },
  ]);
});

test('handles additions, deletions, omitted hunk counts and multiple files', () => {
  const files = parseDiff('diff --git a/new b/new\n--- /dev/null\n+++ b/new\n@@ -0,0 +1 @@\n+hello\n\\ No newline at end of file\ndiff --git a/old b/old\n--- a/old\n+++ /dev/null\n@@ -1 +0,0 @@\n-goodbye');
  assert.equal(files.length, 2);
  assert.equal(files[0].hunks[0].rows[0].before, undefined);
  assert.equal(files[0].hunks[0].rows[0].after?.number, 1);
  assert.equal(files[1].path, 'old');
  assert.equal(files[1].hunks[0].rows[0].after, undefined);
  assert.equal(files[0].metadata.length, 1);
});

test('preserves blank lines and content resembling patch headers across hunks', () => {
  const [file] = parseDiff('diff --git a/a b/a\n@@ -1,2 +1,2 @@\n--- title\n+++ title\n \n@@ -90 +100 @@\n-x\n+y');
  assert.equal(file.hunks[0].rows[0].before?.text, '-- title');
  assert.equal(file.hunks[0].rows[1].after?.text, '');
  assert.equal(file.hunks[1].rows[0].after?.number, 100);
});

test('supports GitHub patches without diff headers and metadata-only changes', () => {
  const files = parseDiff('--- a/a\n+++ b/a\n@@ -1 +1 @@\n-x\n+y\n\n--- a/b\n+++ b/b\n@@ -2 +2 @@\n-a\n+b');
  assert.deepEqual(files.map(f => f.path), ['a', 'b']);
  assert.equal(parseDiff('diff --git a/img b/img\nBinary files a/img and b/img differ')[0].hunks.length, 0);
  assert.deepEqual(parseDiff(''), []);
});
