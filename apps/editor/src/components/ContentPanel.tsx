import { For, Show, createResource, createSignal } from 'solid-js';
import { FileText, Plus } from 'lucide-solid';
import { api } from '../api/client';
import type { ContentItem } from '../types';

/**
 * The content collections — markdown files with a schema-driven frontmatter
 * form. Selecting an item opens it in the main pane; the preview stays put.
 */
export default function ContentPanel(props: {
  selected: ContentItem | null;
  onSelect: (item: ContentItem | null) => void;
}) {
  const [collections] = createResource(api.collections);
  const [openCollection, setOpenCollection] = createSignal<string | null>(null);
  const [items, { refetch }] = createResource(openCollection, (name) => api.items(name));

  return (
    <aside class="w-[300px] flex flex-col h-full bg-white border-r border-[#e1e3e5] select-none overflow-y-auto">
      <div class="px-4 pt-3 pb-2 text-xs font-semibold text-gray-900">Content</div>

      <Show when={collections()} fallback={<div class="px-4 py-6 text-xs text-gray-400">Loading…</div>}>
        <For each={collections()}>
          {(collection) => (
            <div class="border-b border-[#e1e3e5]">
              <button
                type="button"
                onClick={() =>
                  setOpenCollection(openCollection() === collection.name ? null : collection.name)
                }
                class="flex items-center justify-between w-full px-4 py-3 text-[13px] font-semibold text-[#202223] hover:bg-[#f6f6f7] transition-colors text-left cursor-pointer"
              >
                <span>{collection.label}</span>
                <span class="sam-mono text-[11px] text-gray-400">{collection.count}</span>
              </button>

              <Show when={openCollection() === collection.name}>
                <div class="pb-2">
                  <For each={items()}>
                    {(item) => (
                      <button
                        type="button"
                        onClick={() => props.onSelect(item)}
                        class="flex items-center gap-2 w-full px-4 py-1.5 text-xs text-left transition-colors"
                        classList={{
                          'bg-[#005bd3] text-white':
                            props.selected?.slug === item.slug &&
                            props.selected?.collection === item.collection,
                          'text-gray-700 hover:bg-[#f1f2f4]': !(
                            props.selected?.slug === item.slug &&
                            props.selected?.collection === item.collection
                          ),
                        }}
                      >
                        <FileText size={12} class="shrink-0 opacity-60" />
                        <span class="truncate flex-1">{item.title || item.slug}</span>
                        <Show when={item.frontmatter?.draft}>
                          <span class="text-[10px] uppercase tracking-wide opacity-70">draft</span>
                        </Show>
                      </button>
                    )}
                  </For>

                  <button
                    type="button"
                    onClick={async () => {
                      const slug = window.prompt('New entry slug');

                      if (!slug) return;

                      await api.saveItem({
                        collection: collection.name,
                        slug,
                        title: slug,
                        frontmatter: { title: slug },
                        body: '',
                      });
                      await refetch();
                    }}
                    class="flex items-center gap-1.5 px-4 py-1.5 text-[11px] text-[#005bd3] hover:bg-blue-50/60 w-full transition-colors"
                  >
                    <Plus size={11} />
                    <span>New entry</span>
                  </button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </aside>
  );
}
