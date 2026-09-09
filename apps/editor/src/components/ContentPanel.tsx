import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { ChevronLeft, ChevronRight, FileText, FolderPlus, Plus, Search } from 'lucide-solid';
import NewCollectionModal from './NewCollectionModal';
import { api } from '../api/client';
import type { ContentItem } from '../types';

/**
 * The content collections — markdown files with a schema-driven frontmatter
 * form. Selecting an item opens it in the main pane; the preview stays put.
 */

/**
 * How many entries a collection shows at once.
 *
 * A rail 300px wide cannot show four hundred posts, and rendering them all to
 * scroll through is both slow and useless — you cannot find anything in a list
 * that long by scrolling. Search plus pages is what makes a real archive
 * navigable here.
 */
const PER_PAGE = 12;

export default function ContentPanel(props: {
  selected: ContentItem | null;
  onSelect: (item: ContentItem | null) => void;
}) {
  const [collections, { refetch: refetchCollections }] = createResource(api.collections);
  const [openCollection, setOpenCollection] = createSignal<string | null>(null);
  const [items, { refetch }] = createResource(openCollection, (name) => api.items(name));
  const [query, setQuery] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [creating, setCreating] = createSignal(false);

  const matching = createMemo(() => {
    const term = query().trim().toLowerCase();
    const all = items() ?? [];

    return term
      ? all.filter(
          (item) =>
            item.title.toLowerCase().includes(term) || item.slug.toLowerCase().includes(term)
        )
      : all;
  });

  const pages = createMemo(() => Math.max(1, Math.ceil(matching().length / PER_PAGE)));
  // A filter that shortens the list past the current page would otherwise show
  // an empty one with no way back.
  const current = createMemo(() => Math.min(page(), pages()));
  const visible = createMemo(() =>
    matching().slice((current() - 1) * PER_PAGE, current() * PER_PAGE)
  );

  const open = (name: string) => {
    setOpenCollection(openCollection() === name ? null : name);
    setQuery('');
    setPage(1);
  };

  const isSelected = (item: ContentItem) =>
    props.selected?.slug === item.slug && props.selected?.collection === item.collection;

  return (
    <>
      <NewCollectionModal
        open={creating()}
        onOpenChange={setCreating}
        onCreated={async (name) => {
          await refetchCollections();
          setOpenCollection(name);
        }}
      />

      <aside class="w-[300px] flex flex-col h-full bg-white border-r border-[#e1e3e5] select-none overflow-y-auto">
        <div class="flex items-center justify-between px-4 pt-3 pb-2">
          <span class="text-xs font-semibold text-gray-900">Content</span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            class="flex items-center gap-1.5 text-[11px] font-medium text-[#005bd3] hover:bg-blue-50/60 rounded-md px-1.5 py-1 transition-colors"
            title="Create a collection"
          >
            <FolderPlus size={12} />
            <span>New type</span>
          </button>
        </div>

        <Show
          when={collections()}
          fallback={<div class="px-4 py-6 text-xs text-gray-400">Loading…</div>}
        >
          <For each={collections()}>
            {(collection) => (
              <div class="border-b border-[#e1e3e5]">
                <button
                  type="button"
                  onClick={() => open(collection.name)}
                  class="flex items-center justify-between w-full px-4 py-3 text-[13px] font-semibold text-[#202223] hover:bg-[#f6f6f7] transition-colors text-left cursor-pointer"
                >
                  <span>{collection.label}</span>
                  <span class="sam-mono text-[11px] text-gray-400">{collection.count}</span>
                </button>

                <Show when={openCollection() === collection.name}>
                  <div class="pb-2">
                    {/* Search earns its place once a collection outgrows one page. */}
                    <Show when={(items()?.length ?? 0) > PER_PAGE}>
                      <div class="px-3 pb-2">
                        <div class="relative flex items-center">
                          <Search size={12} class="absolute left-2.5 text-gray-400 pointer-events-none" />
                          <input
                            type="search"
                            class="w-full h-8 bg-white border border-[#c9cccf] rounded-lg pl-7 pr-2 text-xs text-[#202223] placeholder-gray-400 outline-none focus:border-[#005bd3]"
                            placeholder={`Search ${collection.label.toLowerCase()}`}
                            value={query()}
                            onInput={(event) => {
                              setQuery(event.currentTarget.value);
                              setPage(1);
                            }}
                          />
                        </div>
                      </div>
                    </Show>

                    <For
                      each={visible()}
                      fallback={
                        <p class="px-4 py-2 text-[11px] text-gray-400">
                          {query() ? 'Nothing matches.' : 'No entries yet.'}
                        </p>
                      }
                    >
                      {(item) => (
                        <button
                          type="button"
                          onClick={() => props.onSelect(item)}
                          class="flex items-center gap-2 w-full px-4 py-1.5 text-xs text-left transition-colors"
                          classList={{
                            'bg-[#005bd3] text-white': isSelected(item),
                            'text-gray-700 hover:bg-[#f1f2f4]': !isSelected(item),
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

                    <Show when={pages() > 1}>
                      <div class="flex items-center justify-between px-4 pt-2">
                        <button
                          type="button"
                          class="ed-icon-btn p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4] disabled:opacity-30 disabled:hover:bg-transparent"
                          disabled={current() <= 1}
                          onClick={() => setPage(current() - 1)}
                          aria-label="Previous page"
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <span class="text-[11px] text-gray-500 tabular-nums">
                          {current()} / {pages()}
                        </span>
                        <button
                          type="button"
                          class="ed-icon-btn p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-[#f1f2f4] disabled:opacity-30 disabled:hover:bg-transparent"
                          disabled={current() >= pages()}
                          onClick={() => setPage(current() + 1)}
                          aria-label="Next page"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </Show>

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
                        await refetchCollections();
                      }}
                      class="flex items-center gap-1.5 px-4 py-1.5 mt-1 text-[11px] text-[#005bd3] hover:bg-blue-50/60 w-full transition-colors"
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
    </>
  );
}
