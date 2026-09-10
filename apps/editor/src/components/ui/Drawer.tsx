import { Show, createEffect, createSignal, onCleanup, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { X } from './Icons';

/** Open drawers, bottom first — Escape closes only the top one. */
const [stack, setStack] = createSignal<symbol[]>([]);

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: JSX.Element;
  /** Under the title, e.g. what is being edited. */
  subtitle?: JSX.Element;
  /** Pixels; the drawer never exceeds the viewport. */
  width?: number;
  children: JSX.Element;
  footer?: JSX.Element;
  /** Extra controls beside the close button. */
  actions?: JSX.Element;
}

/**
 * A panel that slides in from the right, over the page.
 *
 * Drawers stack: the field picker opens over the content type's drawer, a
 * field's settings over that, each lower one dimmed behind the one above, and
 * closing returns to the drawer underneath. Escape and the overlay close only
 * the top drawer.
 */
export default function Drawer(props: DrawerProps) {
  const id = Symbol('drawer');
  const depth = () => stack().indexOf(id);
  const onTop = () => stack()[stack().length - 1] === id;

  createEffect(() => {
    if (!props.open) return;

    setStack((open) => [...open, id]);

    const onKey = (event: KeyboardEvent) => {
      // A modal opened from the drawer (a confirm, a picker) takes Escape first.
      const modalOpen = document.querySelector('[role="dialog"][aria-modal="true"]:not(.pillar-drawer)') !== null;

      if (event.key === 'Escape' && !modalOpen && stack()[stack().length - 1] === id) {
        event.stopPropagation();
        props.onClose();
      }
    };

    window.addEventListener('keydown', onKey);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey);
      setStack((open) => open.filter((entry) => entry !== id));
    });
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 bg-black/30 transition-opacity"
          style={{ 'z-index': 60 + Math.max(0, depth()) * 2 }}
          onClick={() => onTop() && props.onClose()}
        />
        <aside
          role="dialog"
          aria-modal="true"
          class="ds-root pillar-drawer fixed inset-y-0 right-0 flex max-w-[100vw] flex-col bg-canvas shadow-[-12px_0_40px_rgba(0,0,0,0.16)]"
          style={{ 'z-index': 61 + Math.max(0, depth()) * 2, width: `${props.width ?? 560}px` }}
        >
          <header class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-5">
            <div class="min-w-0">
              <h2 class="truncate text-[15px] font-semibold text-text">{props.title}</h2>
              <Show when={props.subtitle}>
                <p class="truncate text-xs text-text-faint">{props.subtitle}</p>
              </Show>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              {props.actions}
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-ds text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
                aria-label="Close"
                onClick={() => props.onClose()}
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[13px] text-text">{props.children}</div>

          <Show when={props.footer}>
            <footer class="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">{props.footer}</footer>
          </Show>
        </aside>
      </Portal>
    </Show>
  );
}
