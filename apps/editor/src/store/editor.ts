import { batch, createMemo, createSignal } from 'solid-js';
import { api, editorConfig } from '../api/client';
import { refreshStatus as refreshSharedStatus, setStatus, status } from './status';
import {
  acceptedTypes,
  blockAt,
  canHoldChildren,
  defaultSettings,
  insertBlockAt,
  isAncestorPath,
  newBlockId,
  removeBlockAt,
  reorderChildren,
  samePath,
  updateBlockAt,
  type BlockPath,
} from '../lib/blocks';
import type {
  AvailableSection,
  BlockInstance,
  BlockType,
  DevicePreview,
  EditorTab,
  PageSection,
  TemplateSummary,
} from '../types';

/**
 * Editor state.
 *
 * One module-level store rather than a context: this app is a single screen,
 * and the alternative — threading a dozen accessors through four component
 * layers — is what made bastet's `Edit.tsx` 588 lines of prop plumbing.
 */

/** How many edits back undo reaches. Bounded: each entry is a full section list. */
const HISTORY_LIMIT = 50;

/** How long an edit sits before it is written to disk. */
const SAVE_DEBOUNCE_MS = 400;

const [templateName, setTemplateName] = createSignal('index');
const [sections, setSectionsRaw] = createSignal<PageSection[]>([]);
const [layout, setLayout] = createSignal<PageSection[]>([]);
const [templates, setTemplates] = createSignal<TemplateSummary[]>([]);
const [availableSections, setAvailableSections] = createSignal<AvailableSection[]>([]);
const [availableBlocks, setAvailableBlocks] = createSignal<BlockType[]>([]);

const [activeSectionId, setActiveSectionId] = createSignal<string | null>(null);
/** The block being edited inside the active section, by path — null for the section itself. */
const [activeBlockPath, setActiveBlockPath] = createSignal<BlockPath | null>(null);
const [showSettings, setShowSettings] = createSignal(false);
const [tab, setTab] = createSignal<EditorTab>('sections');
const [device, setDevice] = createSignal<DevicePreview>('desktop');
const [previewNonce, setPreviewNonce] = createSignal(Date.now());
const [loading, setLoading] = createSignal(true);
const [offline, setOffline] = createSignal(false);

const [past, setPast] = createSignal<PageSection[][]>([]);
const [future, setFuture] = createSignal<PageSection[][]>([]);

/** The section list without its schema, which is reference data and never edited. */
const comparable = (list: PageSection[]) => list.map(({ schema, ...rest }) => rest);

const changed = (next: PageSection[], previous: PageSection[]) =>
  JSON.stringify(comparable(next)) !== JSON.stringify(comparable(previous));

/* ── Reads ───────────────────────────────────────────────────────────── */

/** Layout sections and the template's own, as the sidebar shows them: one list. */
export const allSections = createMemo(() => [...layout(), ...sections()]);

export const activeSection = createMemo(
  () => allSections().find((section) => section.section_id === activeSectionId()) ?? null
);

export const currentTemplate = createMemo(
  () => templates().find((entry) => entry.name === templateName()) ?? null
);

/** The route the preview iframe points at, cache-busted per edit. */
export const previewUrl = createMemo(() => {
  const route = currentTemplate()?.route ?? '/';
  const separator = route.includes('?') ? '&' : '?';

  return `${editorConfig.previewRoot}${route}${separator}editor=1&draft=1&_t=${previewNonce()}`;
});

export const canUndo = createMemo(() => past().length > 0);
export const canRedo = createMemo(() => future().length > 0);

export {
  activeBlockPath,
  activeSectionId,
  availableBlocks,
  availableSections,
  device,
  layout,
  loading,
  offline,
  sections,
  showSettings,
  status,
  tab,
  templateName,
  templates,
};

/** The preview iframe, registered by the canvas so selection can reach it. */
let previewFrame: HTMLIFrameElement | undefined;

export const registerPreview = (frame: HTMLIFrameElement | undefined) => {
  previewFrame = frame;
};

/**
 * Tell the preview what is selected.
 *
 * `'*'` as the target origin: the preview is served by the same `pillar dev`
 * process on the same origin, and in `npm run dev` it is proxied through Vite,
 * where pinning the origin would break the one case the fallback exists for.
 * Nothing secret travels this channel — it carries a section id.
 */
const tellPreview = (message: Record<string, unknown>) => {
  previewFrame?.contentWindow?.postMessage(message, '*');
};

export const setActive = (id: string | null, fromPreview = false) => {
  batch(() => {
    setActiveSectionId(id);
    setActiveBlockPath(null);
    setShowSettings(id !== null);
  });

  // A click that came *from* the canvas is already outlined there; echoing it
  // back would fight the preview's own state and scroll the page under the
  // cursor.
  if (!fromPreview) tellPreview({ type: 'PILLAR_SELECT_SECTION', sectionId: id });
};

export const closeSettings = () => {
  batch(() => {
    setActiveSectionId(null);
    setActiveBlockPath(null);
    setShowSettings(false);
  });

  tellPreview({ type: 'PILLAR_SELECT_SECTION', sectionId: null });
};

/**
 * Listen for the preview's own selections.
 *
 * Started once by the editor screen. The message channel is deliberately
 * one-way per direction: the preview reports what was clicked, the dashboard
 * reports what is selected, and neither echoes the other.
 */
export function listenToPreview(): () => void {
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; sectionId?: string } | null;

    if (!data) return;

    if (data.type === 'PILLAR_SECTION_SELECTED' && data.sectionId) {
      setActive(data.sectionId, true);
    }

    // A preview that has just (re)loaded knows nothing about the current
    // selection — after a settings save reloads it, the outline would vanish.
    if (data.type === 'PILLAR_PREVIEW_READY' && activeSectionId()) {
      tellPreview({ type: 'PILLAR_SELECT_SECTION', sectionId: activeSectionId() });
    }
  };

  window.addEventListener('message', onMessage);

  return () => window.removeEventListener('message', onMessage);
}

export { setDevice, setTab };

export const reloadPreview = () => setPreviewNonce(Date.now());

/* ── Loading ─────────────────────────────────────────────────────────── */

export async function load(name: string = templateName()) {
  setLoading(true);

  const [payload, list, draft] = await Promise.all([
    api.template(name),
    api.templates(),
    api.draftStatus(),
  ]);

  batch(() => {
    setTemplateName(name);
    setSectionsRaw(payload.sections);
    setLayout(payload.layout);
    setAvailableSections(payload.availableSections);
    setAvailableBlocks(payload.availableBlocks);
    setTemplates(list.length ? list : payload.allTemplates);
    setStatus(draft);
    // A different page is a different set of edits: its history is not the one
    // you would expect ⌘Z to step back through.
    setPast([]);
    setFuture([]);
    setLoading(false);
  });

  reloadPreview();
}

export async function openTemplate(name: string) {
  if (name === templateName()) return;

  closeSettings();
  await load(name);
}

export const setOfflineFlag = setOffline;

/* ── Writing ─────────────────────────────────────────────────────────── */

let saveTimer: number | undefined;

/**
 * Put a section list into effect: on screen, on disk, in the preview.
 *
 * Undo and redo call this too — stepping back through history is not a new
 * edit and must not be recorded as one, but it does have to save and re-render
 * exactly like one.
 */
function apply(next: PageSection[]) {
  const nextLayout = next.filter((section) => section.is_layout);
  const nextTemplate = next
    .filter((section) => !section.is_layout)
    .map((section, index) => ({ ...section, order: index }));

  const layoutChanged = changed(nextLayout, layout());
  const templateChanged = changed(nextTemplate, sections());

  batch(() => {
    if (layoutChanged) setLayout(nextLayout);
    if (templateChanged) setSectionsRaw(nextTemplate);
  });

  if (!layoutChanged && !templateChanged) return;

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    if (layoutChanged) await api.saveLayout(nextLayout);
    if (templateChanged) await api.saveTemplate(templateName(), nextTemplate);

    setStatus(await api.draftStatus());
    reloadPreview();
  }, SAVE_DEBOUNCE_MS);
}

/** Every edit goes through here — which is what makes one undo stack enough. */
export function updateSections(next: PageSection[]) {
  const current = allSections();

  // An edit that changes nothing — a settings panel re-committing the same
  // values — must not leave a history step that does nothing when undone.
  if (changed(next, current)) {
    batch(() => {
      setPast((entries) => [...entries, current].slice(-HISTORY_LIMIT));
      setFuture([]);
    });
  }

  apply(next);
}

export function updateSection(id: string, patch: Partial<PageSection>) {
  updateSections(
    allSections().map((section) => (section.section_id === id ? { ...section, ...patch } : section))
  );
}

export function undo() {
  const entries = past();

  if (!entries.length) return;

  const previous = entries[entries.length - 1];

  batch(() => {
    setPast(entries.slice(0, -1));
    setFuture((rest) => [allSections(), ...rest].slice(0, HISTORY_LIMIT));
  });

  apply(previous);
}

export function redo() {
  const entries = future();

  if (!entries.length) return;

  batch(() => {
    setFuture(entries.slice(1));
    setPast((rest) => [...rest, allSections()].slice(-HISTORY_LIMIT));
  });

  apply(entries[0]);
}

/* ── Section operations ──────────────────────────────────────────────── */

export const newSectionId = (type: string) =>
  `${type.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`;

function defaultsFor(settings: AvailableSection['settings']): Record<string, any> {
  const out: Record<string, any> = {};

  (settings ?? []).forEach((setting) => {
    // Decorative settings carry no value; writing one would put a key in the
    // template that means nothing and that nothing reads.
    if (setting.type === 'header' || setting.type === 'paragraph') return;
    if (setting.default !== undefined) out[setting.id] = setting.default;
  });

  return out;
}

export function addSection(type: string) {
  const definition = availableSections().find((entry) => entry.type === type);

  if (!definition) return;

  const section: PageSection = {
    section_id: newSectionId(type),
    section_type: type,
    settings: defaultsFor(definition.settings),
    blocks: [],
    order: sections().length,
    enabled: true,
    schema: {
      name: definition.name,
      settings: definition.settings,
      blocks: definition.blocks,
      max_blocks: definition.max_blocks,
    },
  };

  updateSections([...allSections(), section]);
  setActive(section.section_id);
}

export function duplicateSection(id: string) {
  const list = allSections();
  const index = list.findIndex((section) => section.section_id === id);

  if (index === -1) return;

  const source = structuredClone(list[index]);
  const copy: PageSection = {
    ...source,
    section_id: newSectionId(source.section_type),
    blocks: (source.blocks ?? []).map((block) => ({
      ...block,
      id: `${block.type}_${Math.random().toString(36).slice(2, 7)}`,
    })),
  };

  const next = [...list];

  next.splice(index + 1, 0, copy);
  updateSections(next);
  setActive(copy.section_id);
}

export function removeSection(id: string) {
  updateSections(allSections().filter((section) => section.section_id !== id));

  if (activeSectionId() === id) closeSettings();
}

export function toggleSection(id: string) {
  updateSection(id, { enabled: !allSections().find((s) => s.section_id === id)?.enabled });
}

/** Move a template section to another index. Layout sections do not move. */
export function moveSection(id: string, toIndex: number) {
  const list = [...sections()];
  const from = list.findIndex((section) => section.section_id === id);

  if (from === -1 || toIndex < 0 || toIndex >= list.length || from === toIndex) return;

  const [moved] = list.splice(from, 1);

  list.splice(toIndex, 0, moved);
  updateSections([...layout(), ...list]);
}

/* ── Block operations ────────────────────────────────────────────────── */

/**
 * Every block type a section can name: its own `blocks`, and the site's block
 * files (`blocks/*.liqx`) it or its containers accept.
 */
export function blockCatalogue(section: PageSection): BlockType[] {
  return [...(section.schema?.blocks ?? []), ...availableBlocks().filter((type) => !(section.schema?.blocks ?? []).some((own) => own.type === type.type))];
}

export const blockTypeOf = (section: PageSection, type: string): BlockType | undefined =>
  blockCatalogue(section).find((entry) => entry.type === type);

/**
 * What may be added inside `parentPath`: at the top, the section's own block
 * types plus what it accepts; inside a container, what that block accepts.
 * Underscore-prefixed types render but are never offered.
 */
export function allowedBlockTypes(section: PageSection, parentPath: BlockPath): BlockType[] {
  const offered =
    parentPath.length === 0
      ? [...(section.schema?.blocks ?? []), ...acceptedTypes(section.schema?.accepts, availableBlocks())]
      : acceptedTypes(blockTypeOf(section, blockAt(section.blocks, parentPath)?.type ?? '')?.accepts, blockCatalogue(section));

  return offered.filter((type, index, all) => type.public !== false && !type.type.startsWith('_') && all.findIndex((other) => other.type === type.type) === index);
}

/** Whether another block fits at `parentPath` — `max_blocks` counts the section's top level. */
export function canAddBlock(section: PageSection, parentPath: BlockPath): boolean {
  const max = section.schema?.max_blocks;

  return allowedBlockTypes(section, parentPath).length > 0 && (parentPath.length > 0 || !max || (section.blocks ?? []).length < max);
}

const sectionById = (id: string) => allSections().find((section) => section.section_id === id);

const setBlocks = (sectionId: string, blocks: BlockInstance[]) => updateSection(sectionId, { blocks });

export function selectBlock(sectionId: string, path: BlockPath) {
  setActive(sectionId);
  setActiveBlockPath(path);
}

/** Back from a block's form to its section's. */
export const selectSection = () => setActiveBlockPath(null);

export function addBlock(sectionId: string, parentPath: BlockPath, type: string) {
  const section = sectionById(sectionId);
  const blockType = section ? allowedBlockTypes(section, parentPath).find((entry) => entry.type === type) : undefined;

  if (!section || !blockType || !canAddBlock(section, parentPath)) return;

  const block: BlockInstance = {
    id: newBlockId(type),
    type,
    settings: defaultSettings(blockType),
    ...(canHoldChildren(blockType) ? { blocks: [] } : {}),
  };

  setBlocks(sectionId, insertBlockAt(section.blocks ?? [], parentPath, block));
  selectBlock(sectionId, [...parentPath, block.id]);
}

export function updateBlockSettings(sectionId: string, path: BlockPath, settings: Record<string, unknown>) {
  const section = sectionById(sectionId);

  if (section) setBlocks(sectionId, updateBlockAt(section.blocks ?? [], path, (block) => ({ ...block, settings })));
}

export function removeBlock(sectionId: string, path: BlockPath) {
  const section = sectionById(sectionId);

  if (!section) return;

  setBlocks(sectionId, removeBlockAt(section.blocks ?? [], path));

  const active = activeBlockPath();

  if (active && (samePath(active, path) || isAncestorPath(path, active))) setActiveBlockPath(null);
}

export function toggleBlock(sectionId: string, path: BlockPath) {
  const section = sectionById(sectionId);

  if (section) setBlocks(sectionId, updateBlockAt(section.blocks ?? [], path, (block) => ({ ...block, disabled: !block.disabled })));
}

/** One step up or down among its siblings. */
export function nudgeBlock(sectionId: string, path: BlockPath, delta: -1 | 1) {
  const section = sectionById(sectionId);

  if (!section) return;

  const parentPath = path.slice(0, -1);
  const siblings = parentPath.length ? blockAt(section.blocks, parentPath)?.blocks ?? [] : section.blocks ?? [];
  const from = siblings.findIndex((block) => block.id === path[path.length - 1]);
  const to = from + delta;

  if (from === -1 || to < 0 || to >= siblings.length) return;

  setBlocks(sectionId, reorderChildren(section.blocks ?? [], parentPath, from, to));
}

export function duplicateBlock(sectionId: string, path: BlockPath) {
  const section = sectionById(sectionId);
  const source = section ? blockAt(section.blocks, path) : null;

  if (!section || !source || !canAddBlock(section, path.slice(0, -1))) return;

  // Fresh ids all the way down: two blocks with one id could not be told apart.
  const reid = (block: BlockInstance): BlockInstance => ({ ...block, id: newBlockId(block.type), blocks: block.blocks?.map(reid) });
  const copy = reid(structuredClone(source));
  const parentPath = path.slice(0, -1);
  const siblings = parentPath.length ? blockAt(section.blocks, parentPath)?.blocks ?? [] : section.blocks ?? [];
  const index = siblings.findIndex((block) => block.id === source.id);
  const inserted = insertBlockAt(section.blocks ?? [], parentPath, copy);

  setBlocks(sectionId, reorderChildren(inserted, parentPath, siblings.length, index + 1));
  selectBlock(sectionId, [...parentPath, copy.id]);
}

/* ── Git-backed actions ──────────────────────────────────────────────── */

export async function publish(message: string, push = true) {
  const result = await api.publish(message, push);

  setStatus(await api.draftStatus());

  return result;
}

export async function discard() {
  await api.discard();
  await load();
}

export async function refreshStatus() {
  await refreshSharedStatus();
}
