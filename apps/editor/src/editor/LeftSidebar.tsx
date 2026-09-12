import { t } from '../i18n';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from '../components/ui/Icons';
import { SectionIcon } from '../components/ui/SectionIcon';
import SettingsPanel from './SettingsPanel';
import AddSectionModal from './AddSectionModal';
import * as editor from '../store/editor';
import { flattenBlocks, samePath, type BlockPath } from '../lib/blocks';
import type { BlockInstance, PageSection } from '../types';

/**
 * The page tree.
 *
 * Layout sections (header, footer) bracket the page's own, which are the only
 * ones that reorder — the layout decides where a header goes. Drag uses the
 * platform's own DnD rather than a library: one list, one axis, and the row
 * markup stays identical to bastet's.
 */
export default function LeftSidebar() {
  const [addOpen, setAddOpen] = createSignal(false);
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
  const [dragging, setDragging] = createSignal<string | null>(null);
  const [dropIndex, setDropIndex] = createSignal<number | null>(null);

  const headerSections = createMemo(() =>
    editor.layout().filter((section) => section.section_type === 'header')
  );
  const footerSections = createMemo(() =>
    editor.layout().filter((section) => section.section_type !== 'header')
  );

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);

      next.has(id) ? next.delete(id) : next.add(id);

      return next;
    });

  const title = () =>
    editor.currentTemplate()?.label ??
    editor.templateName().replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <>
      <AddSectionModal open={addOpen()} onOpenChange={setAddOpen} />

      <aside class="w-[300px] flex flex-col h-full bg-white border-r border-[#e1e3e5] select-none overflow-hidden">
        <div
          class="flex flex-col overflow-y-auto px-2.5 pt-3 pb-2 transition-[max-height,height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          classList={{
            'max-h-[46%] shrink-0 border-b border-[#e1e3e5]':
              editor.showSettings() && Boolean(editor.activeSection()),
            'max-h-full flex-1': !(editor.showSettings() && editor.activeSection()),
          }}
        >
          <div class="px-1.5 pb-2 text-xs font-semibold text-gray-900">{title()}</div>
          <div class="px-1.5 pb-1 text-[11px] font-medium text-gray-400">{t("Template")}</div>

          <div class="flex flex-col gap-0.5">
            <For each={headerSections()}>
              {(section) => (
                <SectionRow
                  section={section}
                  draggable={false}
                  expanded={expanded().has(section.section_id)}
                  onToggleExpanded={() => toggleExpanded(section.section_id)}
                />
              )}
            </For>

            <For each={editor.sections()}>
              {(section, index) => (
                <div
                  onDragOver={(event) => {
                    if (!dragging()) return;

                    event.preventDefault();
                    setDropIndex(index());
                  }}
                  onDrop={(event) => {
                    event.preventDefault();

                    const id = dragging();

                    if (id) editor.moveSection(id, index());

                    setDragging(null);
                    setDropIndex(null);
                  }}
                  classList={{
                    'border-t-2 border-[#005bd3] rounded-none': dropIndex() === index() && dragging() !== section.section_id,
                  }}
                >
                  <SectionRow
                    section={section}
                    draggable
                    expanded={expanded().has(section.section_id)}
                    onToggleExpanded={() => toggleExpanded(section.section_id)}
                    onDragStart={() => setDragging(section.section_id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropIndex(null);
                    }}
                  />
                </div>
              )}
            </For>

            <For each={footerSections()}>
              {(section) => (
                <SectionRow
                  section={section}
                  draggable={false}
                  expanded={expanded().has(section.section_id)}
                  onToggleExpanded={() => toggleExpanded(section.section_id)}
                />
              )}
            </For>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              class="flex items-center gap-2 px-2 py-1.5 mt-1 text-xs font-medium text-[#005bd3] hover:bg-blue-50/60 rounded-lg w-full transition-colors cursor-pointer"
            >
              <Plus size={14} class="text-[#005bd3]" />
              <span>{t("Add section")}</span>
            </button>
          </div>
        </div>

        {/* The active section's settings, sharing the rail */}
        <div
          class="flex flex-col bg-white overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          classList={{
            'max-h-[54%] flex-1 opacity-100 translate-y-0':
              editor.showSettings() && Boolean(editor.activeSection()),
            'max-h-0 opacity-0 translate-y-12 pointer-events-none': !(
              editor.showSettings() && editor.activeSection()
            ),
          }}
          style={{ 'will-change': 'transform, max-height, opacity' }}
        >
          {/*
            The section is read from the store rather than through `<Show>`'s
            accessor: the panel nests its own `<Show>`s, and a nested condition
            reading the outer accessor hangs the page — see Canvas.tsx.
          */}
          <Show when={editor.activeSection()}>
            <SettingsPanel section={editor.activeSection()!} />
          </Show>
        </div>
      </aside>
    </>
  );
}

interface SectionRowProps {
  section: PageSection;
  draggable: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

function SectionRow(props: SectionRowProps) {
  const section = () => props.section;
  const isActive = () => editor.activeSectionId() === section().section_id;
  const blocks = (): BlockInstance[] => section().blocks ?? [];
  const hasBlocks = () =>
    Boolean(section().schema?.blocks?.length || section().schema?.accepts?.length || blocks().length);

  return (
    <div class="flex flex-col">
      <div
        onClick={() => editor.setActive(section().section_id)}
        draggable={props.draggable}
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
        class="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors select-none"
        classList={{
          'bg-[#005bd3] text-white shadow-sm': isActive(),
          'text-gray-800 hover:bg-[#f1f2f4]': !isActive(),
        }}
        style={{ opacity: section().enabled ? 1 : 0.45 }}
      >
        {/* Fixed-width slot so every section icon lines up, chevron or not */}
        <div class="w-4 h-4 flex items-center justify-center shrink-0">
          <Show when={hasBlocks()}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleExpanded?.();
              }}
              class="w-4 h-4 flex items-center justify-center rounded hover:bg-black/10 transition-colors"
              classList={{
                'text-white': isActive(),
                'text-gray-400 group-hover:text-gray-600': !isActive(),
              }}
            >
              {props.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          </Show>
        </div>

        <SectionIcon size={14} class={`shrink-0 ${isActive() ? 'text-white' : 'text-gray-600'}`} />

        <span class="truncate flex-1 font-medium">
          {section().schema?.name ?? section().section_type}
        </span>

        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Show when={!section().is_layout}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                editor.removeSection(section().section_id);
              }}
              class="p-0.5 rounded hover:bg-black/10 transition-colors"
              classList={{ 'text-white': isActive(), 'text-gray-400 hover:text-red-600': !isActive() }}
              title={t("Remove section")}
            >
              <Trash2 size={12} />
            </button>
          </Show>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              editor.toggleSection(section().section_id);
            }}
            class="p-0.5 rounded hover:bg-black/10 transition-colors"
            classList={{ 'text-white': isActive(), 'text-gray-400 hover:text-gray-700': !isActive() }}
            title={section().enabled ? t("Hide section") : t("Show section")}
          >
            {section().enabled ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>

          <Show when={props.draggable}>
            <div
              class="p-0.5 cursor-grab active:cursor-grabbing"
              classList={{ 'text-white': isActive(), 'text-gray-400 hover:text-gray-700': !isActive() }}
            >
              <GripVertical size={12} />
            </div>
          </Show>
        </div>
      </div>

      <Show when={hasBlocks() && props.expanded}>
        <BlockTree section={section()} />
      </Show>
    </div>
  );
}

/**
 * A section's blocks, nested: click one to edit it, hover for its actions,
 * and add — at the top or inside a container — only the types allowed there.
 */
function BlockTree(props: { section: PageSection }) {
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  // The container an "Add block" menu is open for, by path key ('' is the top level).
  const [adding, setAdding] = createSignal<string | null>(null);

  const rows = () => flattenBlocks(props.section.blocks, collapsed());
  const id = () => props.section.section_id;
  const isActive = (path: BlockPath) => editor.activeSectionId() === id() && samePath(editor.activeBlockPath() ?? [], path);

  const labelOf = (block: BlockInstance) => {
    const settings = block.settings ?? {};
    const text = [settings.title, settings.heading, settings.label, settings.text].find((value) => typeof value === 'string' && value.trim());

    return (text as string | undefined) ?? editor.blockTypeOf(props.section, block.type)?.name ?? block.type;
  };

  const add = (parentPath: BlockPath) => {
    const types = editor.allowedBlockTypes(props.section, parentPath);

    if (types.length === 1) {
      editor.addBlock(id(), parentPath, types[0].type);
      setAdding(null);
    } else {
      setAdding(adding() === parentPath.join('/') ? null : parentPath.join('/'));
    }
  };

  const toggle = (key: string) => {
    const next = new Set(collapsed());

    next.has(key) ? next.delete(key) : next.add(key);
    setCollapsed(next);
  };

  const action = 'p-0.5 rounded hover:bg-black/10 transition-colors';

  return (
    <div class="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2">
      <For each={rows()}>
        {(row) => {
          const container = () => Boolean(editor.blockTypeOf(props.section, row.block.type)?.accepts?.length);
          const key = () => row.path.join('/');

          return (
            <>
              <div
                class="group flex items-center gap-1 rounded-md py-1 pr-1.5 text-[11px] cursor-pointer transition-colors"
                classList={{
                  'bg-[#005bd3] text-white': isActive(row.path),
                  'text-gray-600 hover:bg-[#f1f2f4]': !isActive(row.path),
                }}
                style={{ 'padding-left': `${6 + row.depth * 12}px`, opacity: row.block.disabled ? 0.45 : 1 }}
                onClick={() => editor.selectBlock(id(), row.path)}
              >
                <span class="flex w-3.5 shrink-0 justify-center">
                  <Show when={container()}>
                    <button
                      type="button"
                      class="rounded hover:bg-black/10"
                      aria-label={collapsed().has(key()) ? t("Expand") : t("Collapse")}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(key());
                      }}
                    >
                      {collapsed().has(key()) ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </Show>
                </span>
                <span class="truncate flex-1">{labelOf(row.block)}</span>
                <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100" classList={{ 'opacity-100': isActive(row.path) }}>
                  <Show when={container() && editor.canAddBlock(props.section, row.path)}>
                    <button type="button" class={action} title={t("Add a block inside")} onClick={(event) => (event.stopPropagation(), add(row.path))}>
                      <Plus size={11} />
                    </button>
                  </Show>
                  <button type="button" class={action} title={t("Move up")} onClick={(event) => (event.stopPropagation(), editor.nudgeBlock(id(), row.path, -1))}>
                    <ChevronDown size={11} class="rotate-180" />
                  </button>
                  <button type="button" class={action} title={t("Move down")} onClick={(event) => (event.stopPropagation(), editor.nudgeBlock(id(), row.path, 1))}>
                    <ChevronDown size={11} />
                  </button>
                  <Show when={editor.canAddBlock(props.section, row.path.slice(0, -1))}>
                    <button type="button" class={action} title={t("Duplicate")} onClick={(event) => (event.stopPropagation(), editor.duplicateBlock(id(), row.path))}>
                      <Copy size={11} />
                    </button>
                  </Show>
                  <button type="button" class={action} title={row.block.disabled ? t("Show block") : t("Hide block")} onClick={(event) => (event.stopPropagation(), editor.toggleBlock(id(), row.path))}>
                    {row.block.disabled ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                  <button
                    type="button"
                    class={action}
                    classList={{ 'hover:text-red-600': !isActive(row.path) }}
                    title={t("Remove block")}
                    onClick={(event) => (event.stopPropagation(), editor.removeBlock(id(), row.path))}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <Show when={adding() === key()}>
                <TypeMenu section={props.section} parentPath={row.path} depth={row.depth + 1} onPick={() => setAdding(null)} />
              </Show>
            </>
          );
        }}
      </For>

      <Show when={editor.canAddBlock(props.section, [])}>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4] rounded-md transition-colors w-full"
          onClick={() => add([])}
        >
          <Plus size={11} />
          <span>{t("Add block")}</span>
        </button>
      </Show>
      <Show when={adding() === ''}>
        <TypeMenu section={props.section} parentPath={[]} depth={0} onPick={() => setAdding(null)} />
      </Show>
    </div>
  );
}

/** The block types allowed at one spot, as a short list. */
function TypeMenu(props: { section: PageSection; parentPath: BlockPath; depth: number; onPick: () => void }) {
  return (
    <div class="my-0.5 rounded-md border border-[#e1e3e5] bg-white p-1 shadow-sm" style={{ 'margin-left': `${6 + props.depth * 12}px` }}>
      <For each={editor.allowedBlockTypes(props.section, props.parentPath)}>
        {(type) => (
          <button
            type="button"
            class="block w-full rounded px-2 py-1 text-left text-[11px] text-gray-700 hover:bg-[#f1f2f4]"
            onClick={() => {
              editor.addBlock(props.section.section_id, props.parentPath, type.type);
              props.onPick();
            }}
          >
            {type.name ?? type.type}
          </button>
        )}
      </For>
    </div>
  );
}
