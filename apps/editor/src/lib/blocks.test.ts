import assert from 'node:assert/strict';
import test from 'node:test';

import { blockAt, moveBlock, removeBlockAt, insertBlockAt, flattenBlocks } from './blocks';
import type { BlockInstance } from '../types';

/**
 * Moving a block is the one piece of block editing with no server to check it.
 *
 * It shipped broken in exactly one direction: removing the block first and then
 * inserting it before the target works upwards, but dragging *down* takes the
 * block out, which shifts the target up into the slot it just left — so it
 * lands back where it started and the drag appears to do nothing. Both
 * directions are asserted here for that reason.
 */

const tree = (): BlockInstance[] => [
  { id: 'title', type: 'heading', settings: {} },
  { id: 'text', type: 'text', settings: {} },
  {
    id: 'actions',
    type: 'group',
    settings: {},
    blocks: [
      { id: 'shop', type: 'button', settings: {} },
      { id: 'track', type: 'button', settings: {} },
    ],
  },
];

const top = (blocks: BlockInstance[]) => blocks.map((b) => b.id);
const children = (blocks: BlockInstance[], id: string) =>
  blocks.find((b) => b.id === id)?.blocks?.map((b) => b.id) ?? [];

test('a block moves down onto its sibling', () => {
  const after = moveBlock(tree(), ['actions', 'shop'], ['actions', 'track']);

  assert.deepEqual(children(after, 'actions'), ['track', 'shop']);
});

test('a block moves up onto its sibling', () => {
  const after = moveBlock(tree(), ['actions', 'track'], ['actions', 'shop']);

  assert.deepEqual(children(after, 'actions'), ['track', 'shop']);
});

test('two siblings swap whichever way they are dragged', () => {
  const down = moveBlock(tree(), ['title'], ['text']);
  const up = moveBlock(tree(), ['text'], ['title']);

  assert.deepEqual(top(down), ['text', 'title', 'actions']);
  assert.deepEqual(top(up), ['text', 'title', 'actions']);
});

test('a block moves past a container without entering it', () => {
  const after = moveBlock(tree(), ['title'], ['actions']);

  assert.deepEqual(top(after), ['text', 'actions', 'title']);
  assert.deepEqual(children(after, 'actions'), ['shop', 'track'], 'the container keeps its own children');
});

test('a block moves out of a container', () => {
  const after = moveBlock(tree(), ['actions', 'shop'], ['title']);

  assert.deepEqual(top(after), ['shop', 'title', 'text', 'actions']);
  assert.deepEqual(children(after, 'actions'), ['track']);
});

test('a container refuses to be dropped inside itself', () => {
  const before = tree();
  const after = moveBlock(before, ['actions'], ['actions', 'shop']);

  assert.equal(after, before, 'the tree is returned untouched, not rebuilt');
});

test('a move onto itself changes nothing', () => {
  const before = tree();

  assert.equal(moveBlock(before, ['title'], ['title']), before);
});

test('the tree flattens depth-first with depth recorded', () => {
  const rows = flattenBlocks(tree(), new Set());

  assert.deepEqual(
    rows.map((r) => [r.path.join('/'), r.depth]),
    [
      ['title', 0],
      ['text', 0],
      ['actions', 0],
      ['actions/shop', 1],
      ['actions/track', 1],
    ]
  );
});

test('a collapsed container hides its children from the list', () => {
  const rows = flattenBlocks(tree(), new Set(['actions']));

  assert.deepEqual(rows.map((r) => r.path.join('/')), ['title', 'text', 'actions']);
});

test('reading, removing and inserting address a block by path', () => {
  assert.equal(blockAt(tree(), ['actions', 'track'])?.type, 'button');
  assert.deepEqual(children(removeBlockAt(tree(), ['actions', 'shop']), 'actions'), ['track']);

  const added = insertBlockAt(tree(), ['actions'], { id: 'extra', type: 'button', settings: {} });

  assert.deepEqual(children(added, 'actions'), ['shop', 'track', 'extra']);
});
