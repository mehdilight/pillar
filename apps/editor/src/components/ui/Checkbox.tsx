import { Show, createUniqueId, type JSX } from 'solid-js';
import { Check } from 'lucide-solid';

interface CheckboxProps {
  children?: JSX.Element;
  checked?: boolean;
  disabled?: boolean;
  onValue?: (checked: boolean) => void;
  class?: string;
}

export default function Checkbox(props: CheckboxProps) {
  const id = createUniqueId();

  return (
    <label
      for={id}
      class={`flex items-center gap-2.5 py-1 text-xs select-none cursor-pointer group ${
        props.disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${props.class ?? ''}`}
    >
      <div class="relative flex items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={props.checked ?? false}
          disabled={props.disabled}
          onChange={(event) => props.onValue?.(event.currentTarget.checked)}
          class="peer sr-only"
        />
        <div
          class="w-4 h-4 rounded border flex items-center justify-center transition-all"
          classList={{
            'bg-[#005bd3] border-[#005bd3] text-white shadow-xs': props.checked,
            'bg-white border-gray-300 group-hover:border-gray-400': !props.checked,
          }}
        >
          <Show when={props.checked}>
            <Check size={11} stroke-width={3} />
          </Show>
        </div>
      </div>
      <Show when={props.children}>
        <span class="text-xs font-normal text-gray-800 flex-1 leading-tight">{props.children}</span>
      </Show>
    </label>
  );
}
