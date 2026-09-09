import type { JSX } from 'solid-js';
import Dropdown from './Dropdown';

interface MenuProps {
  trigger: (open: () => void) => JSX.Element;
  children: (close: () => void) => JSX.Element;
  align?: 'left' | 'right';
}

export function Menu(props: MenuProps) {
  return (
    <Dropdown
      align={props.align ?? 'right'}
      contentClass="w-56 py-1"
      trigger={(open) => props.trigger(open)}
    >
      {(close) => <div class="ed-menu">{props.children(close)}</div>}
    </Dropdown>
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
    <button
      type="button"
      class="ed-menu-item flex items-center gap-2.5 w-full px-3 py-1.5 text-[13px] text-left transition-colors"
      classList={{
        'text-[#8a1200] hover:bg-red-50': props.danger,
        'text-[#303030] hover:bg-[#f1f2f4]': !props.danger,
      }}
      onClick={props.onSelect}
    >
      {props.icon}
      <span>{props.children}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div class="ed-menu-sep my-1 border-t border-[#e1e3e5]" />;
}
