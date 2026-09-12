import { t } from '../../i18n';
import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import { NamedIcon, iconNames } from '../ui/Icons';
import { controlClass } from '../ui/Field';

/** More than a screenful, fewer than make the grid slow: search narrows the rest. */
const SHOWN = 180;

/**
 * An icon from the Phosphor set, stored by name — `rocket-launch`. A theme
 * renders it however it likes: Phosphor's web font, its own sprite.
 */
export default function IconPicker(props: { label?: string; info?: string; value: string; onValue: (value: string) => void }) {
  return (
    <Field label={props.label} info={props.info}>
      <IconChooser value={props.value} onValue={props.onValue} />
    </Field>
  );
}

/**
 * The chooser itself, without a label — for a form that labels its own
 * controls, like the content type drawer. `cms` sizes it like the CMS's inputs.
 */
export function IconChooser(props: { value: string; onValue: (value: string) => void; id?: string; cms?: boolean }) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [names, setNames] = createSignal<string[] | null>(null);

  // The list of ~1,500 names is fetched the first time a picker opens, not with the dashboard.
  createEffect(() => {
    if (open() && names() === null) void iconNames().then(setNames);
  });

  const matching = createMemo(() => {
    const all = names() ?? [];
    const terms = query().trim().toLowerCase().split(/\s+/).filter(Boolean);

    return terms.length ? all.filter((name) => terms.every((term) => name.includes(term))) : all;
  });

  const button = () =>
    props.cms
      ? 'inline-flex h-8 min-w-0 flex-1 items-center gap-2 rounded-ds border border-border-strong bg-surface px-2.5 text-[13px] text-text shadow-ds-sm hover:bg-surface-muted'
      : 'sam-btn min-w-0 flex-1 justify-start!';

  return (
    <>
      <div class="flex items-center gap-2">
        <button id={props.id} type="button" class={button()} onClick={() => setOpen(true)}>
          <Show when={props.value} fallback={<span class="text-gray-500">{t("Choose an icon")}</span>}>
            <NamedIcon name={props.value} size={16} />
            <span class="truncate font-mono text-[11.5px]">{props.value}</span>
          </Show>
        </button>
        <Show when={props.value}>
          <button
            type="button"
            class={props.cms ? 'h-8 shrink-0 rounded-ds px-2 text-xs text-text-muted hover:bg-surface-muted hover:text-text' : 'sam-btn'}
            onClick={() => props.onValue('')}
          >
            {t("Clear")} </button>
        </Show>
      </div>

      <Modal open={open()} onOpenChange={setOpen} title={t("Choose an icon")} wide>
        <input
          type="search"
          autofocus
          aria-label={t("Search icons")}
          class={`${controlClass} mb-3`}
          placeholder={names() ? t("Search {{v0}} icons — arrow, heart, rocket…", { v0: names()!.length }) : t("Loading icons…")}
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <Show
          when={matching().length}
          fallback={<p class="py-10 text-center text-xs text-gray-500">{names() === null ? t("Loading icons…") : t("No icon matches “{{v0}}”.", { v0: query() })}</p>}
        >
          <div class="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5">
            <For each={matching().slice(0, SHOWN)}>
              {(name) => (
                <button
                  type="button"
                  title={name}
                  class="flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-gray-700 transition-colors hover:border-[#005bd3] hover:text-[#005bd3]"
                  classList={{ 'border-[#005bd3] bg-[#e9eef7] text-[#005bd3]': props.value === name, 'border-transparent': props.value !== name }}
                  onClick={() => {
                    props.onValue(name);
                    setOpen(false);
                  }}
                >
                  <NamedIcon name={name} size={22} />
                  <span class="w-full truncate text-center text-[10px] text-gray-500">{name}</span>
                </button>
              )}
            </For>
          </div>
          <Show when={matching().length > SHOWN}>
            <p class="mt-3 text-center text-[11px] text-gray-500">
              {t("Showing")} {SHOWN} {t("of")} {matching().length}{t(". Search to narrow them down.")} </p>
          </Show>
        </Show>
      </Modal>
    </>
  );
}
