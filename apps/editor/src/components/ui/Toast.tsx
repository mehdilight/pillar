import { For, createSignal } from 'solid-js';
import { CheckCircle2, AlertCircle, Info } from 'lucide-solid';

type ToastKind = 'success' | 'error' | 'info';

interface ToastEntry {
  id: number;
  message: string;
  kind: ToastKind;
}

const [toasts, setToasts] = createSignal<ToastEntry[]>([]);
let nextId = 1;

/** Module-level so any component can raise one without a provider chain. */
export function showToast(message: string, kind: ToastKind = 'info') {
  const id = nextId++;

  setToasts((entries) => [...entries, { id, message, kind }]);
  window.setTimeout(() => setToasts((entries) => entries.filter((entry) => entry.id !== id)), 3200);
}

export default function Toast() {
  return (
    <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div
            class="flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.18)] text-xs font-medium text-white bg-[#1a1a1a] border border-[#2c2d30]"
            classList={{
              'text-[#4ade80]': toast.kind === 'success',
              'text-[#fca5a5]': toast.kind === 'error',
            }}
          >
            {toast.kind === 'success' ? (
              <CheckCircle2 size={14} />
            ) : toast.kind === 'error' ? (
              <AlertCircle size={14} />
            ) : (
              <Info size={14} />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </For>
    </div>
  );
}
