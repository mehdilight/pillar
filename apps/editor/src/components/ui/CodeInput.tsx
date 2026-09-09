import { createUniqueId } from 'solid-js';
import Field from './Field';

interface CodeInputProps {
  label?: string;
  info?: string;
  value: string;
  language?: string;
  onValue: (value: string) => void;
  minHeight?: number;
}

/**
 * Stored verbatim, never tag-stripped — unlike `html`, which is display
 * content. `code` is injected into the page, so stripping `<script>` would
 * strip the point.
 */
export default function CodeInput(props: CodeInputProps) {
  const id = createUniqueId();

  return (
    <Field label={props.label} info={props.info} for={id}>
      <div class="ed-code-editor">
        <div class="ed-code-head">
          <span class="ed-code-lang">{props.language ?? 'html'}</span>
        </div>
        <textarea
          id={id}
          class="w-full text-xs font-mono p-2.5 border border-[#8c9196] rounded-b-lg bg-white resize-y outline-none focus:border-[#005bd3] focus:ring-0"
          style={{ 'min-height': `${props.minHeight ?? 120}px`, 'white-space': 'pre', 'tab-size': 2 }}
          spellcheck={false}
          value={props.value ?? ''}
          onInput={(event) => props.onValue(event.currentTarget.value)}
        />
      </div>
    </Field>
  );
}
