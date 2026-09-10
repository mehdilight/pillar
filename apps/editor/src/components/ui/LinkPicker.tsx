import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { ChevronDown, Link2, Search } from 'lucide-solid';
import { Popover } from '@kobalte/core';
import { api } from '../../api/client';
import { entryUrl } from '../../store/content';
import Field, { controlClass } from './Field';

interface Destination {
  label: string;
  url: string;
  group: string;
}

interface LinkPickerProps {
  value: string;
  onValue: (value: string) => void;
  label?: string;
  info?: string;
  placeholder?: string;
}

/** A URL field with a route browser. Used by menus and theme-editor settings. */
export default function LinkPicker(props: LinkPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [data] = createResource(open, async () => {
    const templates = await api.templates();
    const collections = await api.collections();
    const items = await Promise.all(collections.map(async (collection) => [collection, await api.items(collection.name)] as const));
    return { templates, items };
  });

  const destinations = createMemo<Destination[]>(() => {
    const loaded = data();
    if (!loaded) return [];
    const pages = loaded.templates
      .filter((template) => template.group !== 'Content')
      .map((template) => ({ label: template.label, url: template.route, group: 'Pages' }));
    const entries = loaded.items.flatMap(([collection, items]) =>
      items.map((item) => ({ label: item.title || item.slug, url: entryUrl(collection.name, item.slug), group: collection.label }))
    );
    return [...pages, ...entries];
  });

  const matches = createMemo(() => {
    const term = query().trim().toLowerCase();
    return destinations().filter((destination) => !term || `${destination.label} ${destination.url} ${destination.group}`.toLowerCase().includes(term));
  });
  const select = (url: string) => {
    props.onValue(url);
    setOpen(false);
    setQuery('');
  };

  const control = (
    <Popover.Root open={open()} onOpenChange={setOpen} placement="bottom-start" gutter={6} sameWidth fitViewport overflowPadding={12}>
      <Popover.Anchor class="flex">
        <input type="text" class={`${controlClass} rounded-e-none border-e-0`} value={props.value} placeholder={props.placeholder ?? '/about/ or https://example.com'} onInput={(event) => props.onValue(event.currentTarget.value)} />
        <Popover.Trigger
          class="inline-flex h-9 shrink-0 items-center gap-1 rounded-e-lg border border-[#8c9196] bg-[#f6f6f7] px-2.5 text-xs font-medium text-[#303030] transition hover:bg-[#eeeeef] focus:border-[#005bd3] focus:outline-none focus:ring-1 focus:ring-[#005bd3]"
          classList={{ 'bg-[#eef6ff] text-[#005bd3]': open() }}
          aria-label="Browse link destinations"
        ><Link2 size={14} /> Browse <ChevronDown size={14} /></Popover.Trigger>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content class="z-[100] overflow-hidden rounded-ds border border-border-strong bg-surface shadow-ds-lg" onOpenAutoFocus={(event) => event.preventDefault()}>
          <div class="border-b border-border p-2">
            <div class="flex items-center gap-2 rounded border border-border-strong bg-surface px-2 text-text-muted focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
              <Search size={14} />
              <input autofocus type="search" class="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint" placeholder="Search pages and content" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} />
            </div>
          </div>
          <div class="max-h-64 overflow-y-auto py-1">
            <Show when={!data.loading} fallback={<p class="px-3 py-4 text-xs text-text-muted">Loading destinations…</p>}>
              <Show when={matches().length} fallback={<p class="px-3 py-4 text-xs text-text-muted">No matching pages or entries. Paste a URL above instead.</p>}>
                <For each={matches()}>
                  {(destination) => (
                    <button type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted focus:bg-surface-muted focus:outline-none" onClick={() => select(destination.url)}>
                      <span class="w-20 shrink-0 truncate text-[10px] font-semibold uppercase tracking-[.04em] text-text-faint">{destination.group}</span>
                      <span class="min-w-0 flex-1"><span class="block truncate text-[13px] text-text">{destination.label}</span><span class="block truncate text-[11px] text-text-faint">{destination.url}</span></span>
                    </button>
                  )}
                </For>
              </Show>
            </Show>
          </div>
          <div class="flex gap-1 border-t border-border bg-surface-muted/50 px-2 py-1.5">
            <button type="button" class="rounded px-2 py-1 text-[11px] text-text-muted hover:bg-surface hover:text-text" onClick={() => select('#main')}>Link to main content</button>
            <button type="button" class="rounded px-2 py-1 text-[11px] text-text-muted hover:bg-surface hover:text-text" onClick={() => select('#top')}>Link to page top</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  return props.label ? <Field label={props.label} info={props.info}>{control}</Field> : control;
}
