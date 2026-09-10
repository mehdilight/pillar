import { createSignal, type JSX } from 'solid-js';
import { Popover } from '@kobalte/core';

interface DropdownProps {
  trigger: JSX.Element;
  children: (close: () => void) => JSX.Element;
  contentClass?: string;
  align?: 'left' | 'right';
}

/** A portaled Kobalte popover for dropdown-style pickers. */
export default function Dropdown(props: DropdownProps) {
  const [open, setOpen] = createSignal(false);

  return (
    <Popover.Root open={open()} onOpenChange={setOpen} placement={props.align === 'right' ? 'bottom-end' : 'bottom-start'} gutter={6} fitViewport overflowPadding={12}>
      <Popover.Trigger asChild>{props.trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class={`z-[100] overflow-hidden rounded-xl border border-[#e1e3e5] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.14)] ${props.contentClass ?? 'w-64'}`}>
          {props.children(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
