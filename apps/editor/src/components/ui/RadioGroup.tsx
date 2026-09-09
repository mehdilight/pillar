import { For, createUniqueId } from 'solid-js';
import Field from './Field';

interface RadioGroupProps {
  label?: string;
  info?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onValue: (value: string) => void;
}

export default function RadioGroup(props: RadioGroupProps) {
  const name = createUniqueId();

  return (
    <Field label={props.label} info={props.info}>
      <div class="flex flex-col gap-1.5">
        <For each={props.options}>
          {(option) => (
            <label class="ed-row cursor-pointer">
              <input
                type="radio"
                class="ed-radio"
                name={name}
                value={option.value}
                checked={props.value === option.value}
                onChange={() => props.onValue(option.value)}
              />
              <span class="ed-row-label">{option.label}</span>
            </label>
          )}
        </For>
      </div>
    </Field>
  );
}
