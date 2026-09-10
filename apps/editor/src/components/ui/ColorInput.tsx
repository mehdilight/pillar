import { createUniqueId } from 'solid-js';
import Field from './Field';

interface ColorInputProps {
  label?: string;
  info?: string;
  value: string;
  onValue: (value: string) => void;
}

export default function ColorInput(props: ColorInputProps) {
  const id = createUniqueId();
  const current = () => props.value || '#000000';

  return (
    <Field label={props.label} info={props.info} for={id}>
      <div class="relative flex items-center h-9 bg-white border border-[#c9cccf] rounded-lg shadow-xs transition-colors hover:border-[#8c9196] focus-within:border-[#005bd3] focus-within:ring-1 focus-within:ring-[#005bd3]">
        <label
          for={id}
          class="relative w-6 h-6 ml-1.5 rounded-md border border-black/15 shadow-xs flex-shrink-0 cursor-pointer overflow-hidden flex items-center justify-center"
          style={{ 'background-color': current() }}
          title="Pick color"
        >
          <input
            id={id}
            type="color"
            class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={current()}
            onInput={(event) => props.onValue(event.currentTarget.value)}
          />
        </label>
        <input
          type="text"
          class="flex-1 h-full bg-transparent px-2.5 text-[13px] font-mono text-[#202223] outline-none border-0 focus:ring-0"
          value={current()}
          spellcheck={false}
          onChange={(event) => props.onValue(event.currentTarget.value)}
        />
      </div>
    </Field>
  );
}
