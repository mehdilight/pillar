import { For, createUniqueId } from 'solid-js';
import NativeSelect from './NativeSelect';
import Field from './Field';

interface SelectInputProps {
  label?: string;
  info?: string;
  error?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValue: (value: string) => void;
  id?: string;
}

export default function SelectInput(props: SelectInputProps) {
  const id = props.id || createUniqueId();

  return (
    <Field label={props.label} info={props.info} error={props.error} for={id}>
      {/* `selected` on the options, not `value` on the select: options that arrive after the value (menus, collections) would otherwise leave the first one showing. */}
      <NativeSelect
        id={id}
        onChange={(event) => props.onValue(event.currentTarget.value)}
        class="h-9 bg-white border border-[#c9cccf] rounded-lg pl-3 py-1.5 text-[13px] leading-5 text-[#202223] focus:border-[#005bd3] focus:ring-1 focus:ring-[#005bd3] outline-none shadow-xs transition-colors hover:border-[#8c9196]"
      >
        <For each={props.options}>
          {(option) => (
            <option value={option.value} selected={option.value === props.value}>
              {option.label}
            </option>
          )}
        </For>
      </NativeSelect>
    </Field>
  );
}
