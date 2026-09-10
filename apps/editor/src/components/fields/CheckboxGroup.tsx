import { For } from 'solid-js';
import Field from '../ui/Field';
import Checkbox from '../ui/Checkbox';

/** Any number of options; the value is the chosen values, in the options' order. */
export default function CheckboxGroup(props: {
  label?: string;
  info?: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onValue: (value: string[]) => void;
}) {
  const toggle = (value: string, on: boolean) => {
    const chosen = new Set(props.value);

    on ? chosen.add(value) : chosen.delete(value);
    props.onValue(props.options.map((option) => option.value).filter((option) => chosen.has(option)));
  };

  return (
    <Field label={props.label} info={props.info}>
      <div class="flex flex-col gap-1.5">
        <For each={props.options}>
          {(option) => (
            <Checkbox checked={props.value.includes(option.value)} onValue={(on) => toggle(option.value, on)}>
              {option.label}
            </Checkbox>
          )}
        </For>
      </div>
    </Field>
  );
}
