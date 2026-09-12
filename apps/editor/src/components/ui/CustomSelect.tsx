import { Select } from '@kobalte/core';
import { Show, createMemo, type JSX } from 'solid-js';
import { Check, ChevronDown } from './Icons';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface CustomSelectProps<T = string> {
  options: Array<SelectOption<T> | T>;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  class?: string;
  triggerClass?: string;
  contentClass?: string;
  itemClass?: string;
  id?: string;
  name?: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'dark';
  'aria-label'?: string;
  title?: string;
}

/**
 * Accessible custom select component built on Kobalte primitives.
 *
 * Supports single selection with keyboard navigation, typeahead, focus management,
 * portaled dropdowns escaping overflow containers, and matches both dashboard and
 * dark header visual themes.
 */
export default function CustomSelect<T = string>(props: CustomSelectProps<T>) {
  const normalizedOptions = createMemo((): SelectOption<T>[] =>
    props.options.map((opt) =>
      typeof opt === 'object' && opt !== null && 'value' in opt && 'label' in opt
        ? (opt as SelectOption<T>)
        : { value: opt as unknown as T, label: String(opt) }
    )
  );

  const selectedOption = createMemo(() => {
    const opts = normalizedOptions();
    if (props.value !== undefined) {
      return opts.find((opt) => opt.value === props.value);
    }
    if (props.defaultValue !== undefined) {
      return opts.find((opt) => opt.value === props.defaultValue);
    }
    return undefined;
  });

  const isDark = () => props.variant === 'dark';
  const isSm = () => props.size === 'sm';

  return (
    <div class={`inline-block min-w-0 ${props.class ?? 'w-full'}`}>
      <Select.Root<SelectOption<T>>
        options={normalizedOptions()}
        optionValue="value"
        optionTextValue="label"
        optionDisabled="disabled"
        value={selectedOption()}
        onChange={(val) => {
          if (val && props.onChange) {
            props.onChange(val.value);
          }
        }}
        placeholder={props.placeholder}
        disabled={props.disabled}
        gutter={4}
        sameWidth
        fitViewport
        itemComponent={(itemProps) => (
          <Select.Item
            item={itemProps.item}
            class={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors outline-none select-none ${
              isDark()
                ? 'text-gray-200 hover:bg-[#2c2d30] data-[highlighted]:bg-[#2c2d30] data-[highlighted]:text-white'
                : 'text-text hover:bg-surface-muted data-[highlighted]:bg-surface-muted'
            } data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 ${props.itemClass ?? ''}`}
          >
            <div class="flex flex-col min-w-0 pr-1">
              <Select.ItemLabel class="truncate font-medium">
                {itemProps.item.rawValue.label}
              </Select.ItemLabel>
              <Show when={itemProps.item.rawValue.description}>
                <span class="text-[11px] text-text-muted truncate">
                  {itemProps.item.rawValue.description}
                </span>
              </Show>
            </div>
            <Select.ItemIndicator class={`shrink-0 ${isDark() ? 'text-blue-400' : 'text-brand'}`}>
              <Check size={13} />
            </Select.ItemIndicator>
          </Select.Item>
        )}
      >
        <Select.HiddenSelect id={props.id} name={props.name} />
        <Select.Trigger
          class={`flex w-full items-center justify-between gap-2 rounded-ds border px-2.5 text-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isSm() ? 'h-7 text-[11.5px]' : 'h-8 text-[13px]'
          } ${
            isDark()
              ? 'bg-[#1a1a1a] border-[#383a3e] text-gray-200 hover:text-white hover:border-[#4a4a4a] focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
              : 'bg-surface border-border-strong text-text hover:border-text-muted focus:border-brand focus:ring-2 focus:ring-brand-tint'
          } ${props.triggerClass ?? ''}`}
          aria-label={props['aria-label']}
          title={props.title}
        >
          <Select.Value<SelectOption<T>> class="truncate text-left flex-1 min-w-0">
            {(state) => (
              <span class="truncate block">
                {state.selectedOption()?.label ?? props.placeholder ?? ''}
              </span>
            )}
          </Select.Value>
          <Select.Icon class={`shrink-0 ${isDark() ? 'text-gray-400' : 'text-text-muted'}`}>
            <ChevronDown size={12} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            class={`z-[100] max-h-60 overflow-y-auto rounded-xl border p-1 shadow-lg outline-none min-w-[var(--kb-popper-anchor-width)] ${
              isDark()
                ? 'border-[#2c2d30] bg-[#1a1a1a] text-white shadow-black/40'
                : 'border-border bg-surface text-text shadow-ds-md'
            } ${props.contentClass ?? ''}`}
          >
            <Select.Listbox class="space-y-0.5 outline-none" />
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
