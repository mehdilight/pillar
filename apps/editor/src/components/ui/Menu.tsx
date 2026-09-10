import { createSignal, type JSX } from 'solid-js';
import { DropdownMenu } from '@kobalte/core';

interface MenuProps {
  trigger: () => JSX.Element;
  children: (close: () => void) => JSX.Element;
  align?: 'left' | 'right';
}

export function Menu(props: MenuProps) {
  const [open, setOpen] = createSignal(false);

  return (
    <DropdownMenu.Root open={open()} onOpenChange={setOpen} placement={props.align === 'left' ? 'bottom-start' : 'bottom-end'} gutter={6} fitViewport overflowPadding={12}>
      <DropdownMenu.Trigger asChild>{props.trigger()}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="ed-menu z-[100] w-56 overflow-hidden rounded-xl border border-[#e1e3e5] bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          {props.children(() => setOpen(false))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface MenuItemProps {
  icon?: JSX.Element;
  danger?: boolean;
  onSelect: () => void;
  children: JSX.Element;
}

export function MenuItem(props: MenuItemProps) {
  return (
    <DropdownMenu.Item
      class="ed-menu-item flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors outline-none"
      classList={{
        'text-[#8a1200] data-[highlighted]:bg-red-50': props.danger,
        'text-[#303030] data-[highlighted]:bg-[#f1f2f4]': !props.danger,
      }}
      onSelect={props.onSelect}
    >
      {props.icon}
      <span>{props.children}</span>
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator class="ed-menu-sep my-1 border-t border-[#e1e3e5]" />;
}
