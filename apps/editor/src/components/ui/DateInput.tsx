import { createUniqueId } from 'solid-js';
import Field, { controlClass } from './Field';

/** A date, or with `time` a date and time — stored as `2026-09-10` or `2026-09-10T14:30`. */
export default function DateInput(props: { label?: string; info?: string; value: string; time?: boolean; onValue: (value: string) => void }) {
  const id = createUniqueId();

  return (
    <Field label={props.label} info={props.info} for={id}>
      <input
        id={id}
        type={props.time ? 'datetime-local' : 'date'}
        class={controlClass}
        value={props.value.slice(0, props.time ? 16 : 10)}
        onInput={(event) => props.onValue(event.currentTarget.value)}
      />
    </Field>
  );
}
