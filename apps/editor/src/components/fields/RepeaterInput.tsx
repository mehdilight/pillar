import { Index, Show, createSignal } from 'solid-js';
import { ChevronDown, ChevronRight, Plus, Trash2 } from '../ui/Icons';
import { SubFields } from './GroupInput';
import type { SchemaSetting } from '../../types';

type Row = Record<string, unknown>;

/**
 * A list of rows with the same fields — FAQs, team members, pricing tiers.
 *
 * Rows fold to one line titled by their first text field, so a long list stays
 * scannable, and a new row opens ready to fill in.
 */
export default function RepeaterInput(props: {
  /** This repeater's path with a trailing dot: `faq.` — its rows are `faq.0.`, `faq.1.`. */
  path?: string;
  label?: string;
  info?: string;
  fields: SchemaSetting[];
  max?: number;
  value: Row[];
  onValue: (value: Row[]) => void;
}) {
  // Folded rows, by position — moved along with the rows they belong to.
  const [folded, setFolded] = createSignal<boolean[]>(props.value.map(() => props.value.length > 3));

  const full = () => props.max !== undefined && props.value.length >= props.max;

  const titleOf = (row: Row, index: number) => {
    for (const field of props.fields) {
      const value = row[field.id];

      if (['text', 'textarea', 'url', 'select', 'radio'].includes(field.type) && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return `Row ${index + 1}`;
  };

  const update = (index: number, row: Row) => props.onValue(props.value.map((current, i) => (i === index ? row : current)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= props.value.length) return;

    const rows = [...props.value];
    const flags = [...folded()];

    rows.splice(to, 0, rows.splice(from, 1)[0]);
    flags.splice(to, 0, flags.splice(from, 1)[0]);
    setFolded(flags);
    props.onValue(rows);
  };

  const add = () => {
    setFolded([...folded().map(() => true), false]);
    props.onValue([...props.value, {}]);
  };

  const remove = (index: number) => {
    setFolded(folded().filter((_, i) => i !== index));
    props.onValue(props.value.filter((_, i) => i !== index));
  };

  const toggle = (index: number) => setFolded(folded().map((flag, i) => (i === index ? !flag : flag)));

  return (
    <div class="mb-3.5 min-w-0">
      <Show when={props.label}>
        <div class="mb-1.5 flex items-baseline justify-between gap-2">
          <span class="text-[13px] font-medium leading-tight text-[#303030]">{props.label}</span>
          <span class="text-[11px] text-gray-500">
            {props.value.length}
            {props.max !== undefined ? ` of ${props.max}` : ''}
          </span>
        </div>
      </Show>

      <div class="flex flex-col gap-2">
        {/* Index, not For: an edit replaces its row's object, and For would rebuild the row — dropping focus mid-word. */}
        <Index each={props.value}>
          {(row, index) => (
            <div class="min-w-0 rounded-lg border border-[#e1e3e5] bg-white shadow-xs">
              <div class="flex items-center gap-1 pl-1 pr-1.5" classList={{ 'border-b border-[#e1e3e5]': !folded()[index] }}>
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left"
                  aria-expanded={!folded()[index]}
                  onClick={() => toggle(index)}
                >
                  <span class="text-gray-400">{folded()[index] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
                  <span class="w-5 shrink-0 text-[11px] tabular-nums text-gray-400">{index + 1}</span>
                  <span class="truncate text-xs font-medium text-[#303030]">{titleOf(row(), index)}</span>
                </button>
                <button
                  type="button"
                  class="rounded-md p-1 text-gray-400 hover:bg-[#f1f2f4] hover:text-gray-700 disabled:opacity-30"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronDown size={13} class="rotate-180" />
                </button>
                <button
                  type="button"
                  class="rounded-md p-1 text-gray-400 hover:bg-[#f1f2f4] hover:text-gray-700 disabled:opacity-30"
                  aria-label="Move down"
                  disabled={index === props.value.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  type="button"
                  class="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${titleOf(row(), index)}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <Show when={!folded()[index]}>
                <div class="px-3 pb-0.5 pt-3">
                  <SubFields path={`${props.path ?? ''}${index}.`} fields={props.fields} value={row()} onValue={(next) => update(index, next)} />
                </div>
              </Show>
            </div>
          )}
        </Index>
      </div>

      <button
        type="button"
        class="mt-2 -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-[#005bd3] hover:bg-[#e9eef7] disabled:cursor-not-allowed disabled:opacity-40"
        disabled={full()}
        onClick={add}
      >
        <Plus size={13} />
        {full() ? `At most ${props.max} rows` : 'Add row'}
      </button>
      <Show when={props.info}>
        <p class="mt-1 text-[11px] leading-normal text-gray-500">{props.info}</p>
      </Show>
    </div>
  );
}
