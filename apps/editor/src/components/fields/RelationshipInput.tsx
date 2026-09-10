import { For, Show, createContext, createEffect, createMemo, createSignal, on, useContext } from 'solid-js';
import Field from '../ui/Field';
import Drawer from '../ui/Drawer';
import { ChevronDown, ExternalLink, Plus, Search, X } from '../ui/Icons';
import { api } from '../../api/client';
import type { ContentItem } from '../../types';

const PER_PAGE = 15;

type Entry = ContentItem & { reference: string };

/**
 * The entry whose form this is, when there is one — so it is never offered
 * as related to itself. Provided by the entry page; a section's settings in
 * the visual editor have none.
 */
export const CurrentEntry = createContext<{ collection: string; slug: string } | null>(null);

/**
 * A relationship: entries from one or more collections, linked by reference.
 *
 * Stored as the entry's slug when one collection is offered, `collection/slug`
 * when several are — and read by templates as the entries themselves. Chosen
 * in a drawer that searches and pages through every entry, the way a
 * relationship field works in Statamic.
 */
export default function RelationshipInput(props: {
  label?: string;
  info?: string;
  collections: string[];
  multiple?: boolean;
  max?: number;
  value: string | string[] | null | undefined;
  onValue: (value: string | string[] | null) => void;
}) {
  const [entries, setEntries] = createSignal<Entry[] | null>(null);
  const [selecting, setSelecting] = createSignal(false);
  const current = useContext(CurrentEntry);

  const qualified = () => props.collections.length > 1;
  const referenceOf = (item: ContentItem) => (qualified() ? `${item.collection}/${item.slug}` : item.slug);

  createEffect(
    on(
      () => props.collections.join(','),
      () => {
        const wanted = props.collections;

        setEntries(null);
        Promise.all(wanted.map((collection) => api.items(collection).catch(() => [] as ContentItem[])))
          .then((lists) => {
            if (wanted.join(',') !== props.collections.join(',')) return;
            setEntries(lists.flat().map((item) => ({ ...item, reference: referenceOf(item) })));
          })
          .catch(() => setEntries([]));
      }
    )
  );

  const chosen = (): string[] => (Array.isArray(props.value) ? props.value : props.value ? [props.value] : []);
  const find = (reference: string) => entries()?.find((entry) => entry.reference === reference);
  const full = () => props.multiple && props.max !== undefined && chosen().length >= props.max;
  // Every entry but the one being edited: nothing is related to itself.
  const selectable = () => {
    const list = entries();

    return list === null ? null : list.filter((entry) => !(current && entry.collection === current.collection && entry.slug === current.slug));
  };

  const commit = (references: string[]) => props.onValue(props.multiple ? references : references[0] ?? null);

  const move = (from: number, to: number) => {
    const list = [...chosen()];

    list.splice(to, 0, list.splice(from, 1)[0]);
    commit(list);
  };

  return (
    <Field label={props.label} info={props.info}>
      <Show when={chosen().length}>
        <ul class="flex flex-col gap-1.5">
          <For each={chosen()}>
            {(reference, index) => (
              <li class="flex min-w-0 items-center gap-2 rounded-lg border border-[#e1e3e5] bg-white px-2.5 py-2 shadow-xs">
                <span
                  class="size-2 shrink-0 rounded-full"
                  classList={{
                    'bg-[#29845a]': find(reference) !== undefined && !find(reference)!.frontmatter?.draft,
                    'bg-[#b28400]': Boolean(find(reference)?.frontmatter?.draft),
                    'bg-[#e22c38]': entries() !== null && find(reference) === undefined,
                  }}
                  title={find(reference) ? (find(reference)!.frontmatter?.draft ? 'Draft' : 'Published') : entries() === null ? '' : 'Missing'}
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-medium text-[#303030]">
                    {find(reference)?.title || reference}
                  </span>
                  <Show when={entries() !== null && !find(reference)}>
                    <span class="block text-[10.5px] text-red-600">No entry {reference} — it was renamed or deleted.</span>
                  </Show>
                </span>
                <Show when={qualified() && find(reference)}>
                  <span class="shrink-0 rounded-full bg-[#f1f2f4] px-1.5 py-0.5 text-[10px] text-gray-600">{find(reference)!.collection}</span>
                </Show>
                <Show when={find(reference)}>
                  <a
                    href={`/content/${find(reference)!.collection}/${find(reference)!.slug}`}
                    target="_blank"
                    rel="noopener"
                    class="rounded p-0.5 text-gray-400 hover:bg-[#f1f2f4] hover:text-gray-700"
                    aria-label={`Open ${find(reference)!.title}`}
                    title="Open in a new tab"
                  >
                    <ExternalLink size={12} />
                  </a>
                </Show>
                <Show when={props.multiple}>
                  <button type="button" class="rounded p-0.5 text-gray-400 hover:bg-[#f1f2f4] hover:text-gray-700 disabled:invisible" aria-label="Move up" disabled={index() === 0} onClick={() => move(index(), index() - 1)}>
                    <ChevronDown size={12} class="rotate-180" />
                  </button>
                </Show>
                <button
                  type="button"
                  class="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Unlink ${find(reference)?.title || reference}`}
                  onClick={() => commit(chosen().filter((item) => item !== reference))}
                >
                  <X size={12} />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={!full() && (props.multiple || chosen().length === 0)}>
        <button type="button" class="sam-btn self-start" onClick={() => setSelecting(true)} disabled={props.collections.length === 0}>
          <Plus size={12} />
          {props.multiple ? 'Link entries' : 'Link an entry'}
        </button>
      </Show>
      <Show when={!props.multiple && chosen().length > 0}>
        <button type="button" class="sam-btn self-start" onClick={() => setSelecting(true)}>
          Change
        </button>
      </Show>
      <Show when={props.multiple && props.max !== undefined}>
        <p class="text-[11px] text-gray-500">
          {chosen().length} of at most {props.max}
        </p>
      </Show>

      <Show when={selecting()}>
        <EntrySelector
          title={props.label ? `Link ${props.label.toLowerCase()}` : 'Link entries'}
          collections={props.collections}
          entries={selectable()}
          multiple={Boolean(props.multiple)}
          max={props.max}
          chosen={chosen()}
          onClose={() => setSelecting(false)}
          onSelect={(references) => {
            commit(references);
            setSelecting(false);
          }}
        />
      </Show>
    </Field>
  );
}

/** The selection stack: search, filter by collection, page through, tick. */
function EntrySelector(props: {
  title: string;
  collections: string[];
  entries: Entry[] | null;
  multiple: boolean;
  max?: number;
  chosen: string[];
  onClose: () => void;
  onSelect: (references: string[]) => void;
}) {
  const [picked, setPicked] = createSignal<string[]>([...props.chosen]);
  const [query, setQuery] = createSignal('');
  const [collection, setCollection] = createSignal('');
  const [page, setPage] = createSignal(1);

  const matching = createMemo(() => {
    const term = query().trim().toLowerCase();

    return (props.entries ?? []).filter(
      (entry) =>
        (!collection() || entry.collection === collection()) &&
        (!term || entry.title.toLowerCase().includes(term) || entry.slug.includes(term))
    );
  });

  const pages = () => Math.max(1, Math.ceil(matching().length / PER_PAGE));
  const current = () => Math.min(page(), pages());
  const visible = () => matching().slice((current() - 1) * PER_PAGE, current() * PER_PAGE);
  const atMax = () => props.max !== undefined && picked().length >= props.max;

  const toggle = (reference: string) => {
    if (!props.multiple) return setPicked([reference]);

    if (picked().includes(reference)) setPicked(picked().filter((item) => item !== reference));
    else if (!atMax()) setPicked([...picked(), reference]);
  };

  const date = (entry: Entry) => {
    const value = entry.frontmatter?.date;

    return value ? String(value).slice(0, 10) : '';
  };

  return (
    <Drawer
      open
      onClose={props.onClose}
      width={820}
      title={props.title}
      subtitle={props.collections.join(', ')}
      footer={
        <>
          <span class="mr-auto text-xs text-text-muted">
            {picked().length} selected
            {props.max !== undefined ? ` · at most ${props.max}` : ''}
          </span>
          <button type="button" class="sam-btn" onClick={props.onClose}>
            Cancel
          </button>
          <button type="button" class="sam-btn primary" onClick={() => props.onSelect(picked())}>
            Select
          </button>
        </>
      }
    >
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <label class="flex min-w-[220px] flex-1 items-center gap-2 rounded-ds border border-border-strong bg-surface px-2.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-tint">
          <Search size={14} class="text-text-faint" />
          <input
            type="search"
            autofocus
            aria-label="Search entries"
            placeholder="Search by title or slug"
            class="h-8 flex-1 border-0 bg-transparent p-0 text-[13px] outline-none focus:ring-0"
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setPage(1);
            }}
          />
        </label>
        <Show when={props.collections.length > 1}>
          <div class="flex gap-1 rounded-ds border border-border bg-surface p-0.5">
            <For each={['', ...props.collections]}>
              {(name) => (
                <button
                  type="button"
                  class="rounded px-2.5 py-1 text-xs"
                  classList={{ 'bg-surface-muted font-medium text-text': collection() === name, 'text-text-muted hover:text-text': collection() !== name }}
                  onClick={() => {
                    setCollection(name);
                    setPage(1);
                  }}
                >
                  {name || 'All'}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={props.entries !== null} fallback={<p class="py-10 text-center text-xs text-text-faint">Loading entries…</p>}>
        <Show when={visible().length} fallback={<p class="py-10 text-center text-xs text-text-faint">{query() ? 'No entry matches.' : 'No entries yet.'}</p>}>
          <div class="overflow-hidden rounded-ds border border-border bg-surface shadow-ds-sm">
            <table class="w-full border-collapse text-[13px]">
              <thead>
                <tr class="border-b border-border bg-surface-muted text-left text-[11.5px] uppercase tracking-[.03em] text-text-muted">
                  <th class="w-10 px-3 py-2" />
                  <th class="px-3 py-2 font-medium">Title</th>
                  <Show when={props.collections.length > 1}>
                    <th class="px-3 py-2 font-medium">Collection</th>
                  </Show>
                  <th class="px-3 py-2 font-medium">Date</th>
                  <th class="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={visible()}>
                  {(entry) => {
                    const on = () => picked().includes(entry.reference);
                    const disabled = () => props.multiple && !on() && atMax();

                    return (
                      <tr
                        class="border-b border-border last:border-b-0"
                        classList={{ 'cursor-pointer hover:bg-surface-muted': !disabled(), 'bg-brand-tint/60': on(), 'opacity-50': disabled() }}
                        onClick={() => !disabled() && toggle(entry.reference)}
                      >
                        <td class="px-3 py-2.5">
                          <input
                            type={props.multiple ? 'checkbox' : 'radio'}
                            name="entry-selector"
                            class="size-4 border-border-strong text-brand focus:ring-brand"
                            classList={{ rounded: props.multiple }}
                            checked={on()}
                            disabled={disabled()}
                            aria-label={`Select ${entry.title || entry.slug}`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggle(entry.reference)}
                          />
                        </td>
                        <td class="px-3 py-2.5">
                          <span class="block font-medium text-text">{entry.title || entry.slug}</span>
                          <span class="block font-mono text-[11px] text-text-faint">{entry.slug}</span>
                        </td>
                        <Show when={props.collections.length > 1}>
                          <td class="px-3 py-2.5 text-xs text-text-muted">{entry.collection}</td>
                        </Show>
                        <td class="px-3 py-2.5 text-xs tabular-nums text-text-muted">{date(entry)}</td>
                        <td class="px-3 py-2.5">
                          <span
                            class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                            classList={{
                              'border-warning/30 bg-warning-tint text-warning': Boolean(entry.frontmatter?.draft),
                              'border-success/30 bg-success-tint text-success': !entry.frontmatter?.draft,
                            }}
                          >
                            {entry.frontmatter?.draft ? 'Draft' : 'Published'}
                          </span>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-text-muted">
            <span>
              {matching().length} entr{matching().length === 1 ? 'y' : 'ies'}
            </span>
            <Show when={pages() > 1}>
              <span class="flex items-center gap-2">
                <button type="button" class="sam-btn" disabled={current() === 1} onClick={() => setPage(current() - 1)}>
                  Previous
                </button>
                <span class="tabular-nums">
                  {current()} of {pages()}
                </span>
                <button type="button" class="sam-btn" disabled={current() === pages()} onClick={() => setPage(current() + 1)}>
                  Next
                </button>
              </span>
            </Show>
          </div>
        </Show>
      </Show>
    </Drawer>
  );
}
