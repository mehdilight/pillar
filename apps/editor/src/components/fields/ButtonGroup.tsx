import { For } from 'solid-js';
import Field from '../ui/Field';

/** A radio field drawn as a row of buttons — `display: "buttons"`, for a few short options. */
export default function ButtonGroup(props: {
  label?: string;
  info?: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onValue: (value: string) => void;
}) {
  return (
    <Field label={props.label} info={props.info}>
      <div class="inline-flex max-w-full flex-wrap self-start overflow-hidden rounded-lg border border-[#c9cccf] bg-white" role="radiogroup" aria-label={props.label}>
        <For each={props.options}>
          {(option) => (
            <button
              type="button"
              role="radio"
              aria-checked={props.value === option.value}
              class="border-r border-[#e1e3e5] px-3 py-1.5 text-xs font-medium transition-colors last:border-r-0"
              classList={{
                'bg-[#303030] text-white': props.value === option.value,
                'text-[#303030] hover:bg-[#f1f2f4]': props.value !== option.value,
              }}
              onClick={() => props.onValue(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    </Field>
  );
}
