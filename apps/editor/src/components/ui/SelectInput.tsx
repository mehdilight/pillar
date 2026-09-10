import { For, createUniqueId } from 'solid-js';
import { ChevronDown } from './Icons';
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
      <div class="relative flex items-center">
        <select
          id={id}
          value={props.value}
          onChange={(event) => props.onValue(event.currentTarget.value)}
          class="w-full h-9 appearance-none bg-white border border-[#c9cccf] rounded-lg pl-3 pr-8 py-1.5 text-[13px] leading-5 text-[#202223] focus:border-[#005bd3] focus:ring-1 focus:ring-[#005bd3] outline-none shadow-xs transition-colors hover:border-[#8c9196] cursor-pointer"
          style={{ appearance: 'none', 'background-image': 'none' }}
        >
          <For each={props.options}>
            {(option) => <option value={option.value}>{option.label}</option>}
          </For>
        </select>
        <ChevronDown
          size={14}
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
        />
      </div>
    </Field>
  );
}
