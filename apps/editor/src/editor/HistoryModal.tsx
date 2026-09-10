import { For, Show, createResource } from 'solid-js';
import Modal from '../components/ui/Modal';
import { api } from '../api/client';

/** Version history is `git log` over the editor-owned paths. */
export default function HistoryModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [history] = createResource(() => props.open, () => api.history());

  return (
    <Modal open={props.open} onOpenChange={props.onOpenChange} title="Version history" flushBody>
      <Show
        when={history()?.length}
        fallback={<div class="px-4 py-8 text-center text-xs text-gray-400">No commits yet.</div>}
      >
        <ul class="divide-y divide-[#e1e3e5]">
          <For each={history()}>
            {(entry) => (
              <li class="flex items-start gap-3 px-4 py-3">
                <code class="sam-mono text-[11px] text-gray-400 mt-0.5">{entry.short}</code>
                <div class="flex flex-col min-w-0 flex-1">
                  <span class="text-[13px] text-[#202223] truncate">{entry.message}</span>
                  <span class="text-[11px] text-gray-500">
                    {entry.author} · {new Date(entry.date).toLocaleString()}
                  </span>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </Modal>
  );
}
