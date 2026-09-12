import { t } from '../../i18n';
import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { ChevronDown, Link2, Search } from './Icons';
import { Popover } from '@kobalte/core';
import { api } from '../../api/client';
import { entryUrl } from '../../store/content';
import Field, { controlClass } from './Field';

// `controlClass` is shared with the visual editor and includes `h-9`. The
// picker has two deliberate sizes, so remove that fixed height before choosing.
const pickerControlClass = controlClass.replace('h-9', '');

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
  /** Match the compact CMS inputs when the picker appears in a menu row. */
  compact?: boolean;
}

/** A URL field with a route browser. Used by menus and theme-editor settings. */
export default function LinkPicker(props: LinkPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  let searchInput: HTMLInputElement | undefined;
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
      .map((template) => ({ label: template.label, url: template.route, group: t("Pages") }));
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
    <Popover.Root open={open()} onOpenChange={setOpen} placement="bottom-start" flip="top-start bottom-start" slide gutter={6} sameWidth fitViewport overflowPadding={12}>
      <Popover.Anchor class="flex">
        <input type="text" class={`${pickerControlClass} ${props.compact ? 'h-8' : 'h-9'} rounded-e-none border-e-0`} value={props.value} placeholder={props.placeholder ?? t("/about/ or https://example.com")} onInput={(event) => props.onValue(event.currentTarget.value)} />
        <Popover.Trigger
          class={`inline-flex shrink-0 items-center gap-1 rounded-e-lg border border-[#c9cccf] bg-[#f6f6f7] px-2.5 text-xs font-medium text-[#303030] transition hover:border-[#8c9196] hover:bg-[#eeeeef] focus:border-[#005bd3] focus:outline-none focus:ring-1 focus:ring-[#005bd3] ${props.compact ? 'h-8' : 'h-9'}`}
          classList={{ 'bg-[#eef6ff] text-[#005bd3]': open() }}
          aria-label={t("Browse link destinations")}
        ><Link2 size={14} /> {t("Browse")} <ChevronDown size={14} /></Popover.Trigger>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content class="z-[100] flex min-h-0 flex-col overflow-hidden rounded-ds border border-border-strong bg-surface shadow-ds-lg" style={{ 'max-height': 'min(24rem, var(--kb-popper-content-available-height, calc(100dvh - 24px)))' }} onOpenAutoFocus={(event) => { event.preventDefault(); searchInput?.focus({ preventScroll: true }); }}>
          <div class="shrink-0 border-b border-border p-2">
            <div class="flex items-center gap-2 rounded border border-border-strong bg-surface px-2 text-text-muted focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
              <Search size={14} />
              <input ref={searchInput} type="search" class="h-8 min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-text shadow-none outline-none ring-0 placeholder:text-text-faint focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" placeholder={t("Search pages and content")} value={query()} onInput={(event) => setQuery(event.currentTarget.value)} />
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            <Show when={!data.loading} fallback={<p class="px-3 py-4 text-xs text-text-muted">{t("Loading destinations…")}</p>}>
              <Show when={matches().length} fallback={<p class="px-3 py-4 text-xs text-text-muted">{t("No matching pages or entries. Paste a URL above instead.")}</p>}>
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
          <div class="flex shrink-0 flex-wrap gap-1 border-t border-border bg-surface-muted/50 px-2 py-1.5">
            <button type="button" class="rounded px-2 py-1 text-[11px] text-text-muted hover:bg-surface hover:text-text" onClick={() => select('#main')}>{t("Link to main content")}</button>
            <button type="button" class="rounded px-2 py-1 text-[11px] text-text-muted hover:bg-surface hover:text-text" onClick={() => select('#top')}>{t("Link to page top")}</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  return props.label ? <Field label={props.label} info={props.info}>{control}</Field> : control;
}
