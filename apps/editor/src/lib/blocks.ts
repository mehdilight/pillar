import type { BlockInstance, BlockType } from '../types';

/**
 * Addressing blocks once they nest.
 *
 * A flat list could name a block by its id. A tree cannot: two containers may
 * each hold a block called `heading`, and "the heading" stops meaning anything.
 * So every operation here takes a **path** — the chain of ids from the section
 * down to the block — and every one returns new arrays rather than mutating,
 * because the editor diffs section lists by value to decide what to save.
 */
export type BlockPath = string[];

export const samePath = (a: BlockPath, b: BlockPath): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);

export const isAncestorPath = (ancestor: BlockPath, path: BlockPath): boolean =>
  ancestor.length < path.length && ancestor.every((id, i) => id === path[i]);

/** The block at a path, or null if the path no longer resolves. */
export function blockAt(blocks: BlockInstance[] | undefined, path: BlockPath): BlockInstance | null {
  if (!blocks || path.length === 0) return null;

  const [head, ...rest] = path;
  const found = blocks.find((b) => b.id === head);

  if (!found) return null;

  return rest.length === 0 ? found : blockAt(found.blocks, rest);
}

/** Replace the block at a path with the result of `updater`. */
export function updateBlockAt(
  blocks: BlockInstance[],
  path: BlockPath,
  updater: (block: BlockInstance) => BlockInstance
): BlockInstance[] {
  if (path.length === 0) return blocks;

  const [head, ...rest] = path;

  return blocks.map((block) => {
    if (block.id !== head) return block;

    return rest.length === 0
      ? updater(block)
      : { ...block, blocks: updateBlockAt(block.blocks ?? [], rest, updater) };
  });
}

export function removeBlockAt(blocks: BlockInstance[], path: BlockPath): BlockInstance[] {
  if (path.length === 0) return blocks;

  const [head, ...rest] = path;

  if (rest.length === 0) return blocks.filter((block) => block.id !== head);

  return blocks.map((block) =>
    block.id === head ? { ...block, blocks: removeBlockAt(block.blocks ?? [], rest) } : block
  );
}

/**
 * Append a block inside the container at `parentPath`, or at the top when the
 * path is empty.
 */
export function insertBlockAt(
  blocks: BlockInstance[],
  parentPath: BlockPath,
  block: BlockInstance
): BlockInstance[] {
  if (parentPath.length === 0) return [...blocks, block];

  return updateBlockAt(blocks, parentPath, (parent) => ({
    ...parent,
    blocks: [...(parent.blocks ?? []), block],
  }));
}

/** Reorder the children of one container. Siblings only — depth never changes. */
export function reorderChildren(
  blocks: BlockInstance[],
  parentPath: BlockPath,
  from: number,
  to: number
): BlockInstance[] {
  const move = (list: BlockInstance[]): BlockInstance[] => {
    const next = [...list];
    const [moved] = next.splice(from, 1);

    if (!moved) return list;

    next.splice(to, 0, moved);

    return next;
  };

  if (parentPath.length === 0) return move(blocks);

  return updateBlockAt(blocks, parentPath, (parent) => ({
    ...parent,
    blocks: move(parent.blocks ?? []),
  }));
}

/**
 * Move a block to sit where another one is.
 *
 * One rule, applied everywhere: the dragged block becomes a **sibling of the
 * block it was dropped on**, at that block's position. Within one container
 * that is a reorder; across two it is a move, and the merchant did not have to
 * learn a second gesture for it.
 *
 * Returns the list unchanged when the move is impossible rather than throwing,
 * because the caller is a drag handler and a rejected drop should simply put
 * the block back.
 */
export function moveBlock(
  blocks: BlockInstance[],
  from: BlockPath,
  to: BlockPath
): BlockInstance[] {
  if (from.length === 0 || to.length === 0 || samePath(from, to)) return blocks;

  // A container cannot be dropped inside itself: the block would become its own
  // descendant, and the tree would no longer have a root.
  if (isAncestorPath(from, to)) return blocks;

  const moved = blockAt(blocks, from);

  if (!moved) return blocks;

  const fromParent = from.slice(0, -1);
  const toParent = to.slice(0, -1);
  const targetId = to[to.length - 1];

  /*
   * Within one container this is a reorder, and both indices have to be read
   * off the *same* list before anything is removed.
   *
   * Removing first and then inserting before the target only works upwards.
   * Dragging downwards, taking the block out shifts the target up into the
   * slot it just left, so inserting before the target puts it back exactly
   * where it started — a drag that visibly does nothing.
   */
  if (samePath(fromParent, toParent)) {
    const siblings = childrenAt(blocks, fromParent);
    const fromIndex = siblings.findIndex((b) => b.id === from[from.length - 1]);
    const toIndex = siblings.findIndex((b) => b.id === targetId);

    if (fromIndex < 0 || toIndex < 0) return blocks;

    const next = [...siblings];
    const [item] = next.splice(fromIndex, 1);

    next.splice(toIndex, 0, item);

    return withChildrenAt(blocks, fromParent, next);
  }

  // Across two containers there is no shift to account for: the target keeps
  // its index, and the block lands in front of it.
  const without = removeBlockAt(blocks, from);
  const siblings = childrenAt(without, toParent);
  const index = siblings.findIndex((b) => b.id === targetId);

  if (index < 0) return blocks;

  const next = [...siblings];

  next.splice(index, 0, moved);

  return withChildrenAt(without, toParent, next);
}

/** The children of a container, or the top-level list for an empty path. */
function childrenAt(blocks: BlockInstance[], path: BlockPath): BlockInstance[] {
  return path.length === 0 ? blocks : blockAt(blocks, path)?.blocks ?? [];
}

/** The tree with one container's children replaced. */
function withChildrenAt(
  blocks: BlockInstance[],
  path: BlockPath,
  children: BlockInstance[]
): BlockInstance[] {
  if (path.length === 0) return children;

  return updateBlockAt(blocks, path, (parent) => ({ ...parent, blocks: children }));
}

/** A row in the sidebar's tree: the block, where it is, and how deep. */
export interface FlatBlock {
  block: BlockInstance;
  path: BlockPath;
  depth: number;
  index: number;
}

/**
 * The tree as a list, which is what a sidebar draws.
 *
 * Collapsed containers keep their children out of the list entirely, so a
 * merchant with a deep layout can fold it away.
 */
export function flattenBlocks(
  blocks: BlockInstance[] | undefined,
  collapsed: Set<string>,
  parentPath: BlockPath = [],
  depth = 0
): FlatBlock[] {
  const out: FlatBlock[] = [];

  (blocks ?? []).forEach((block, index) => {
    const path = [...parentPath, block.id];

    out.push({ block, path, depth, index });

    if (!collapsed.has(path.join('/'))) {
      out.push(...flattenBlocks(block.blocks, collapsed, path, depth + 1));
    }
  });

  return out;
}

/**
 * Generate an id that reads as what it is.
 *
 * Stored templates are checked into a theme and read by people, so
 * `heading_m3k1x` beats a bare timestamp — and the random tail keeps two blocks
 * added in the same millisecond apart.
 */
export function newBlockId(type: string): string {
  const slug = type.replace(/^_+/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase();

  return `${slug}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Defaults from a block type's schema, so a new block renders as designed. */
export function defaultSettings(blockType: BlockType): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  (blockType.settings ?? []).forEach((setting) => {
    // Headers and paragraphs carry no value; writing one would put a key in
    // the template that means nothing and that nothing reads.
    if (setting.type === 'header' || setting.type === 'paragraph') return;
    if (setting.default !== undefined) out[setting.id] = setting.default;
  });

  return out;
}

/**
 * The block types that may go inside a given container.
 *
 * `accepts` is resolved server-side — `@theme` has already been expanded into
 * real type names — so this is a lookup, not a rule engine.
 */
export function acceptedTypes(
  accepts: string[] | undefined,
  catalogue: BlockType[]
): BlockType[] {
  if (!accepts || accepts.length === 0) return [];

  const byType = new Map(catalogue.map((b) => [b.type, b]));

  return accepts.map((type) => byType.get(type)).filter((b): b is BlockType => Boolean(b));
}

/** Whether this block may hold children at all. */
export function canHoldChildren(blockType: BlockType | undefined): boolean {
  return Boolean(blockType?.accepts && blockType.accepts.length > 0);
}
