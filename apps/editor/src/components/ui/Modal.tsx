import { Show, onCleanup, createEffect, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { X } from './Icons';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
  wide?: boolean;
  /** Body gets no padding — for flush lists / grids. */
  flushBody?: boolean;
}

/**
 * Dialog shell.
 *
 * Above drawers (z 60+), since a modal is often opened from inside one.
 *
 * Radix has no Solid build, so this is the same markup driven by an Escape
 * listener and an overlay click — the class strings are bastet's, unchanged,
 * so both editors keep one look.
 */
export default function Modal(props: ModalProps) {
  createEffect(() => {
    if (!props.open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onOpenChange(false);
    };

    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90]"
          onClick={() => props.onOpenChange(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] border border-[#e1e3e5] z-[90] flex flex-col overflow-hidden outline-none max-h-[85vh]"
          classList={{
            'w-[900px] max-w-[92vw]': props.wide,
            'w-[520px] max-w-[90vw]': !props.wide,
          }}
        >
          <div class="flex items-center justify-between px-4 py-2.5 h-11 border-b border-[#e1e3e5] bg-white shrink-0">
            <h2 class="text-xs font-semibold text-[#202223] m-0">{props.title}</h2>
            <button
              type="button"
              class="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close"
              onClick={() => props.onOpenChange(false)}
            >
              <X size={15} />
            </button>
          </div>

          <div
            class="flex-1 min-h-0 overflow-y-auto"
            classList={{ 'p-4 flex flex-col gap-3': !props.flushBody }}
          >
            {props.children}
          </div>

          <Show when={props.footer}>
            <div class="px-5 py-3 border-t border-[#e1e3e5] bg-gray-50 flex items-center justify-end gap-2 shrink-0">
              {props.footer}
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  );
}
