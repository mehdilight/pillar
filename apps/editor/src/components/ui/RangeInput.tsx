import { createUniqueId } from 'solid-js';
import Field from './Field';

interface RangeInputProps {
  label?: string;
  info?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onValue: (value: number) => void;
}

export default function RangeInput(props: RangeInputProps) {
  const id = createUniqueId();

  return (
    <Field label={props.label} info={props.info} for={id}>
      <div class="space-y-1.5 py-0.5">
        <div class="flex items-center gap-3">
          <input
            id={id}
            type="range"
            class="ed-range flex-1"
            min={props.min ?? 0}
            max={props.max ?? 100}
            step={props.step ?? 1}
            value={props.value}
            onInput={(event) => props.onValue(Number(event.currentTarget.value))}
          />
          <span class="text-[11px] font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded min-w-[40px] text-center border border-gray-200">
            {props.value}
            {props.unit ? ` ${props.unit}` : ''}
          </span>
        </div>
      </div>
    </Field>
  );
}
