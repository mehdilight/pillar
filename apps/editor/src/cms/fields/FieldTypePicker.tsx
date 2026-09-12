import { t } from '../../i18n';
import { For, Show, createMemo, createSignal } from 'solid-js';
import Drawer from '../../components/ui/Drawer';
import { NamedIcon, Search } from '../../components/ui/Icons';
import { FIELD_CATEGORIES, FIELD_TYPES, type FieldCategory } from '../../lib/fieldTypes';
import type { FieldType } from '../../types';

/**
 * Every field type, as a grid of cards — filtered by category or by search.
 *
 * Opens as a drawer over the one that asked for it, so choosing a type goes
 * straight on to that field's settings without losing the form behind.
 */
export default function FieldTypePicker(props: { open: boolean; onClose: () => void; onChoose: (type: FieldType) => void; exclude?: FieldType[] }) {
  const [category, setCategory] = createSignal<FieldCategory | 'all'>('all');
  const [query, setQuery] = createSignal('');

  const types = createMemo(() => {
    const term = query().trim().toLowerCase();

    return (Object.keys(FIELD_TYPES) as FieldType[]).filter((type) => {
      const info = FIELD_TYPES[type];

      if (props.exclude?.includes(type)) return false;
      if (term) return `${info.label} ${type} ${info.description}`.toLowerCase().includes(term);

      return category() === 'all' || info.category === category();
    });
  });

  return (
    <Drawer open={props.open} onClose={props.onClose} title={t("Field types")} width={880}>
      <div class="sticky -top-5 z-10 -mx-5 -mt-5 mb-5 border-b border-border bg-canvas/95 px-5 pb-4 pt-5 backdrop-blur">
        <div class="flex flex-wrap items-center justify-center gap-1 rounded-full border border-border bg-surface p-1 shadow-ds-sm">
          <For each={FIELD_CATEGORIES}>
            {(entry) => (
              <button
                type="button"
                class="relative rounded-full px-3.5 py-1.5 text-[13px] transition-colors"
                classList={{
                  'bg-surface-muted font-medium text-text': !query() && category() === entry.key,
                  'text-text-muted hover:text-text': query() !== '' || category() !== entry.key,
                }}
                aria-pressed={!query() && category() === entry.key}
                onClick={() => {
                  setCategory(entry.key);
                  setQuery('');
                }}
              >
                {entry.label}
              </button>
            )}
          </For>
          <label class="ml-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-text-muted focus-within:bg-surface-muted focus-within:text-text">
            <Search size={14} />
            <input
              autofocus
              type="search"
              aria-label={t("Search field types")}
              placeholder={t("Search")}
              class="w-24 border-0 bg-transparent p-0 text-[13px] outline-none placeholder:text-text-faint focus:w-40 focus:ring-0 transition-[width]"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && types().length === 1) props.onChoose(types()[0]);
              }}
            />
          </label>
        </div>
      </div>

      <Show when={types().length} fallback={<p class="py-12 text-center text-sm text-text-faint">{t("No field type matches “{{query}}”.", { query: query() })}</p>}>
        <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={types()}>
            {(type) => (
              <li class="h-full">
                <button
                  type="button"
                  class="group flex h-full w-full items-start gap-3 rounded-ds border border-border bg-surface px-4 py-3.5 text-left shadow-ds-sm transition hover:border-brand hover:shadow-ds-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onClick={() => props.onChoose(type)}
                >
                  <span class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-ds bg-surface-muted text-text-secondary transition-colors group-hover:bg-brand-tint group-hover:text-brand">
                    <NamedIcon name={FIELD_TYPES[type].icon} size={18} />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[14px] font-medium text-text">{FIELD_TYPES[type].label}</span>
                    <span class="mt-0.5 block text-xs leading-snug text-text-faint">{FIELD_TYPES[type].description}</span>
                  </span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Drawer>
  );
}
