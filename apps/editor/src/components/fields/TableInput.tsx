import { t } from '../../i18n';
import { For, Index, Show } from 'solid-js';
import Field from '../ui/Field';
import { Plus, X } from '../ui/Icons';

/**
 * Rows and columns of text. The first row is the table's header by
 * convention — how a theme is expected to read it.
 */
export default function TableInput(props: { label?: string; info?: string; value: string[][]; onValue: (value: string[][]) => void }) {
  const columns = () => Math.max(0, ...props.value.map((row) => row.length));
  // Ragged rows (hand-edited files) are padded, never trimmed.
  const rows = () => props.value.map((row) => Array.from({ length: columns() }, (_, i) => row[i] ?? ''));

  const set = (r: number, c: number, text: string) => props.onValue(rows().map((row, i) => (i === r ? row.map((cell, j) => (j === c ? text : cell)) : row)));
  const addRow = () => props.onValue([...rows(), Array.from({ length: Math.max(1, columns()) }, () => '')]);
  const addColumn = () => props.onValue((rows().length ? rows() : [[]]).map((row) => [...row, '']));
  const removeRow = (r: number) => props.onValue(rows().filter((_, i) => i !== r));
  const removeColumn = (c: number) => props.onValue(rows().map((row) => row.filter((_, j) => j !== c)).filter((row) => row.length));

  const cell = 'h-8 w-full min-w-[90px] border-0 bg-transparent px-2 text-[13px] outline-none focus:bg-[#f4f8ff] focus:ring-0';

  return (
    <Field label={props.label} info={props.info ?? t("The first row is the header.")}>
      <Show
        when={props.value.length}
        fallback={
          <button type="button" class="sam-btn self-start" onClick={() => props.onValue([['', ''], ['', '']])}>
            {t("Start a table")} </button>
        }
      >
        <div class="overflow-x-auto rounded-lg border border-[#c9cccf] bg-white">
          <table class="w-full border-collapse">
            <thead>
              <tr>
                <For each={Array.from({ length: columns() })}>
                  {(_, c) => (
                    <th class="border-b border-[#e1e3e5] bg-[#f6f6f7] p-0 text-right">
                      <button
                        type="button"
                        class="m-0.5 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={t("Remove column {{v0}}", { v0: c() + 1 })}
                        onClick={() => removeColumn(c())}
                      >
                        <X size={11} />
                      </button>
                    </th>
                  )}
                </For>
                <th class="w-7 border-b border-[#e1e3e5] bg-[#f6f6f7]" />
              </tr>
            </thead>
            <tbody>
              {/* Index, not For: cells are strings, and For would replace a cell's input — and its focus — on every keystroke. */}
              <Index each={rows()}>
                {(row, r) => (
                  <tr class="border-b border-[#e1e3e5] last:border-b-0" classList={{ 'bg-[#fbfbfc]': r === 0 }}>
                    <Index each={row()}>
                      {(text, c) => (
                        <td class="border-r border-[#e1e3e5] p-0 last:border-r-0">
                          <input
                            class={cell}
                            classList={{ 'font-medium': r === 0 }}
                            aria-label={t("Row {{v0}}, column {{v1}}", { v0: r + 1, v1: c + 1 })}
                            value={text()}
                            onInput={(event) => set(r, c, event.currentTarget.value)}
                          />
                        </td>
                      )}
                    </Index>
                    <td class="w-7 p-0 text-center">
                      <button type="button" class="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={t("Remove row {{v0}}", { v0: r + 1 })} onClick={() => removeRow(r)}>
                        <X size={11} />
                      </button>
                    </td>
                  </tr>
                )}
              </Index>
            </tbody>
          </table>
        </div>
        <div class="flex gap-2">
          <button type="button" class="sam-btn" onClick={addRow}>
            <Plus size={12} /> {t("Row")} </button>
          <button type="button" class="sam-btn" onClick={addColumn}>
            <Plus size={12} /> {t("Column")} </button>
        </div>
      </Show>
    </Field>
  );
}
