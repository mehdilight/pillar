import { createUniqueId, splitProps, type JSX } from 'solid-js';
import Field, { controlClass } from './Field';

interface NumberInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  info?: string;
  error?: string;
  onValue?: (value: number | '') => void;
}

export default function NumberInput(props: NumberInputProps) {
  const [own, rest] = splitProps(props, ['label', 'info', 'error', 'onValue', 'class', 'id']);
  const id = own.id || createUniqueId();

  return (
    <Field label={own.label} info={own.info} error={own.error} for={id}>
      <input
        id={id}
        type="number"
        {...rest}
        class={`${controlClass} ${own.class ?? ''}`}
        onInput={(event) => {
          const raw = event.currentTarget.value;

          own.onValue?.(raw === '' ? '' : Number(raw));
        }}
      />
    </Field>
  );
}
