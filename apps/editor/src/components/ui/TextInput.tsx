import { createUniqueId, splitProps, type JSX } from 'solid-js';
import Field, { controlClass } from './Field';

interface TextInputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  info?: string;
  error?: string;
  onValue?: (value: string) => void;
}

export default function TextInput(props: TextInputProps) {
  const [own, rest] = splitProps(props, ['label', 'info', 'error', 'onValue', 'class', 'id']);
  const id = own.id || createUniqueId();

  return (
    <Field label={own.label} info={own.info} error={own.error} for={id}>
      <input
        id={id}
        type="text"
        {...rest}
        class={`${controlClass} ${own.class ?? ''}`}
        onInput={(event) => own.onValue?.(event.currentTarget.value)}
      />
    </Field>
  );
}
