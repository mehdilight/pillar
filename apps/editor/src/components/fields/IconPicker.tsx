import { For, Show, createMemo, createSignal } from 'solid-js';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import { ICON_NAMES, NamedIcon } from '../ui/Icons';
import { controlClass } from '../ui/Field';

/** More than a screenful, fewer than make the grid slow: search narrows the rest. */
const SHOWN = 180;

/**
 * An icon from the Phosphor set, stored by name — `rocket-launch`. A theme
 * renders it however it likes: Phosphor's web font, its own sprite.
 */
export default function IconPicker(props: { label?: string; info?: string; value: string; onValue: (value: string) => void }) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');

  const matching = createMemo(() => {
    const terms = query().trim().toLowerCase().split(/\s+/).filter(Boolean);

    return terms.length ? ICON_NAMES.filter((name) => terms.every((term) => name.includes(term))) : ICON_NAMES;
  });

  return (
    <Field label={props.label} info={props.info}>
      <div class="flex items-center gap-2">
        <button type="button" class="sam-btn min-w-0 flex-1 justify-start!" onClick={() => setOpen(true)}>
          <Show when={props.value} fallback={<span class="text-gray-500">Choose an icon</span>}>
            <NamedIcon name={props.value} size={16} />
            <span class="truncate font-mono text-[11.5px]">{props.value}</span>
          </Show>
        </button>
        <Show when={props.value}>
          <button type="button" class="sam-btn" onClick={() => props.onValue('')}>
            Clear
          </button>
        </Show>
      </div>

      <Modal open={open()} onOpenChange={setOpen} title="Choose an icon" wide>
        <input
          type="search"
          autofocus
          aria-label="Search icons"
          class={`${controlClass} mb-3`}
          placeholder={`Search ${ICON_NAMES.length} icons — arrow, heart, rocket…`}
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <Show when={matching().length} fallback={<p class="py-10 text-center text-xs text-gray-500">No icon matches “{query()}”.</p>}>
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
              Showing {SHOWN} of {matching().length}. Search to narrow them down.
            </p>
          </Show>
        </Show>
      </Modal>
    </Field>
  );
}
