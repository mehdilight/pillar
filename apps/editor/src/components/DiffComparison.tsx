import { For, Show, createMemo, createSignal } from 'solid-js';
import { t } from '../i18n';
import { parseDiff, type DiffLine } from '../lib/diff';

export default function DiffComparison(props: { patch: string }) {
  const [technical, setTechnical] = createSignal(false);
  const files = createMemo(() => parseDiff(props.patch));
  const cell = (line: DiffLine | undefined, changed: boolean, after: boolean) => (
    <td class="align-top border-e last:border-e-0 border-[#e1e3e5]" classList={{
      'bg-emerald-50': changed && after && !!line,
      'bg-rose-50': changed && !after && !!line,
      'bg-gray-50': !line,
    }}>
      <Show when={line} fallback={<span class="block px-3 py-2 text-xs text-gray-400">{t('No corresponding text')}</span>}>
        <div class="flex">
          <Show when={technical()}><span class="w-12 shrink-0 py-2 pe-2 text-end font-mono text-[11px] text-gray-500 select-none border-e border-gray-200">{line?.number}</span></Show>
          <div class="min-w-0 flex-1 px-3 py-2">
            <Show when={changed}><span class="block text-[10px] font-semibold mb-1" classList={{ 'text-emerald-700': after, 'text-rose-700': !after }}>{after ? t('Added text') : t('Removed text')}</span></Show>
            <span class="whitespace-pre-wrap [overflow-wrap:anywhere]" classList={{ 'font-mono text-xs': technical(), 'text-sm leading-relaxed': !technical() }}>{line?.text || '\u00a0'}</span>
          </div>
        </div>
      </Show>
    </td>
  );
  return <div class="space-y-4 text-[#202223] select-text">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-gray-600 max-w-md">{technical() ? t('Exact file text with line numbers. Only changed sections and nearby lines are shown.') : t('Compare the previously saved text with your current changes. Highlighted text was removed or added. Only changed sections are shown, not a page preview.')}</p>
      <div role="group" aria-label={t('Comparison view')} class="flex rounded-lg border border-gray-300 p-0.5 shrink-0">
        <For each={[false, true]}>{(value) => <button type="button" aria-pressed={technical() === value} onClick={() => setTechnical(value)} class="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600" classList={{ 'bg-[#202223] text-white': technical() === value, 'text-gray-600 hover:bg-gray-100': technical() !== value }}>{value ? t('Technical') : t('Reading view')}</button>}</For>
      </div>
    </div>
    <For each={files()}>{(file) => <section class="border border-gray-200 rounded-lg overflow-hidden">
      <h3 class="px-3 py-2 bg-gray-50 text-xs font-semibold break-all border-b border-gray-200">{file.path || t('Changed file')}</h3>
      <Show when={file.hunks.length} fallback={<p class="p-3 text-sm text-gray-600">{t('This change has no text comparison, for example a binary file or a rename.')}</p>}>
        <div class="overflow-x-auto" role="region" aria-label={file.path || t('Comparison view')} tabIndex={0}>
          <table class="w-full min-w-[520px] table-fixed border-collapse">
            <thead><tr><th scope="col" class="w-1/2 text-left px-3 py-2 text-xs border-e border-b border-gray-200">{t('Before')}</th><th scope="col" class="w-1/2 text-left px-3 py-2 text-xs border-b border-gray-200">{t('After')}</th></tr></thead>
            <For each={file.hunks}>{(hunk, index) => <tbody>
              <tr><td colSpan={2} class="bg-blue-50 text-blue-800 px-3 py-1.5 text-xs border-y border-blue-100"><Show when={technical()} fallback={t('Changed section {{number}}', { number: index() + 1 })}><code>{hunk.header}</code></Show></td></tr>
              <For each={hunk.rows}>{(row) => <tr>{cell(row.before, row.changed, false)}{cell(row.after, row.changed, true)}</tr>}</For>
            </tbody>}</For>
          </table>
        </div>
      </Show>
      <Show when={technical() && file.metadata.length}><pre class="p-3 text-[11px] text-gray-500 whitespace-pre-wrap break-all border-t border-gray-200">{file.metadata.join('\n')}</pre></Show>
    </section>}</For>
    <Show when={!files().length}><p class="text-sm text-gray-600">{t('No text comparison is available.')}</p></Show>
  </div>;
}
