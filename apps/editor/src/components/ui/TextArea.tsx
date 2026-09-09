import { createUniqueId, splitProps, type JSX } from 'solid-js';
import Field, { controlClass } from './Field';

interface TextAreaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  info?: string;
  error?: string;
  onValue?: (value: string) => void;
}

export default function TextArea(props: TextAreaProps) {
  const [own, rest] = splitProps(props, ['label', 'info', 'error', 'onValue', 'class', 'id']);
  const id = own.id || createUniqueId();

  return (
    <Field label={own.label} info={own.info} error={own.error} for={id}>
      <textarea
        id={id}
        rows={3}
        {...rest}
        class={`${controlClass} h-auto resize-y ${own.class ?? ''}`}
        onInput={(event) => own.onValue?.(event.currentTarget.value)}
      />
    </Field>
  );
}
