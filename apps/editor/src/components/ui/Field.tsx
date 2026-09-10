import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

interface FieldProps {
  label?: string;
  info?: string;
  error?: string;
  for?: string;
  children: JSX.Element;
}

/** Standard label / control / hint scaffolding for every setting input. */
export default function Field(props: FieldProps) {
  return (
    <div class="flex flex-col gap-1.5 mb-3.5">
      <Show when={props.label}>
        <label
          for={props.for}
          class="text-[13px] font-medium text-[#303030] leading-tight select-none cursor-pointer"
        >
          {props.label}
        </label>
      </Show>
      {props.children}
      <Show when={props.error}>
        <p class="text-xs text-red-600 mt-0.5">{props.error}</p>
      </Show>
      <Show when={props.info}>
        <p class="text-[11px] text-gray-500 mt-0.5 leading-normal">{props.info}</p>
      </Show>
    </div>
  );
}

/** The one input skin every text-shaped control wears. */
export const controlClass =
  'w-full h-9 bg-white border border-[#c9cccf] rounded-lg px-3 py-1.5 text-[13px] leading-5 ' +
  'text-[#202223] placeholder-gray-400 focus:border-[#005bd3] focus:ring-1 focus:ring-[#005bd3] ' +
  'outline-none shadow-xs transition-colors hover:border-[#8c9196]';
