import { createUniqueId } from 'solid-js';
import CustomSelect from './CustomSelect';
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
      <CustomSelect
        id={id}
        value={props.value}
        onChange={props.onValue}
        options={props.options}
        triggerClass="h-9 bg-white border-[#c9cccf] rounded-lg px-3 text-[13px] leading-5 text-[#202223] focus:border-[#005bd3] focus:ring-1 focus:ring-[#005bd3] shadow-xs hover:border-[#8c9196]"
      />
    </Field>
  );
}
