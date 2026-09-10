import { For, Show, createMemo, createSignal } from 'solid-js';
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-solid';
import { SectionIcon } from '../components/ui/SectionIcon';
import SettingsPanel from './SettingsPanel';
import AddSectionModal from './AddSectionModal';
import * as editor from '../store/editor';
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
          <div class="px-1.5 pb-1 text-[11px] font-medium text-gray-400">Template</div>

          <div class="flex flex-col gap-0.5">
            <For each={headerSections()}>
              {(section) => <SectionRow section={section} draggable={false} />}
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
              {(section) => <SectionRow section={section} draggable={false} />}
            </For>

            <button
              type="button"
              onClick={() => setAddOpen(true)}
              class="flex items-center gap-2 px-2 py-1.5 mt-1 text-xs font-medium text-[#005bd3] hover:bg-blue-50/60 rounded-lg w-full transition-colors cursor-pointer"
            >
              <Plus size={14} class="text-[#005bd3]" />
              <span>Add section</span>
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
              title="Remove section"
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
            title={section().enabled ? 'Hide section' : 'Show section'}
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
        <div class="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2">
          <For each={blocks()}>
            {(block) => (
              <div class="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-gray-600 hover:bg-[#f1f2f4] transition-colors">
                <span class="truncate flex-1">{block.settings?.title || block.type}</span>
              </div>
            )}
          </For>

          <Show
            when={
              !section().schema?.max_blocks || blocks().length < (section().schema?.max_blocks ?? 0)
            }
          >
            <button
              type="button"
              class="flex items-center gap-1.5 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4] rounded-md transition-colors w-full"
            >
              <Plus size={11} />
              <span>Add block</span>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
