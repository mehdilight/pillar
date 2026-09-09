import { Show, createSignal, onCleanup, type JSX } from 'solid-js';

interface DropdownProps {
  trigger: (open: () => void, isOpen: () => boolean) => JSX.Element;
  children: (close: () => void) => JSX.Element;
  contentClass?: string;
  align?: 'left' | 'right';
}

/** A click-outside popover. Radix's role, without Radix. */
export default function Dropdown(props: DropdownProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  const onDocumentDown = (event: MouseEvent) => {
    if (root && !root.contains(event.target as Node)) setIsOpen(false);
  };

  document.addEventListener('mousedown', onDocumentDown);
  onCleanup(() => document.removeEventListener('mousedown', onDocumentDown));

  return (
    <div class="relative" ref={root}>
      {props.trigger(() => setIsOpen((open) => !open), isOpen)}
      <Show when={isOpen()}>
        <div
          class={`absolute top-full mt-1.5 z-50 bg-white rounded-xl border border-[#e1e3e5] shadow-[0_12px_32px_rgba(0,0,0,0.14)] overflow-hidden ${
            props.contentClass ?? 'w-64'
          }`}
          classList={{ 'right-0': props.align === 'right', 'left-0': props.align !== 'right' }}
        >
          {props.children(() => setIsOpen(false))}
        </div>
      </Show>
    </div>
  );
}
