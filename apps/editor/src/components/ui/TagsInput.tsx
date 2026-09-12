import { t } from '../../i18n';
import { For, createSignal } from 'solid-js';
import { X } from './Icons';
import Field, { controlClass } from './Field';

interface TagsInputProps {
  label?: string;
  info?: string;
  value: string[];
  onValue: (value: string[]) => void;
}

/** A frontmatter list field — Enter or comma commits, backspace pops. */
export default function TagsInput(props: TagsInputProps) {
  const [draft, setDraft] = createSignal('');
  const tags = () => props.value ?? [];

  const commit = () => {
    const tag = draft().trim().replace(/,$/, '');

    if (tag && !tags().includes(tag)) props.onValue([...tags(), tag]);

    setDraft('');
  };

  return (
    <Field label={props.label} info={props.info}>
      <div class="flex flex-wrap items-center gap-1.5">
        <For each={tags()}>
          {(tag) => (
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f2f4] text-[#303030] border border-[#e1e3e5]">
              {tag}
              <button
                type="button"
                class="text-gray-400 hover:text-gray-700"
                onClick={() => props.onValue(tags().filter((entry) => entry !== tag))}
                aria-label={t("Remove {{v0}}", { v0: tag })}
              >
                <X size={10} />
              </button>
            </span>
          )}
        </For>
      </div>
      <input
        type="text"
        class={controlClass}
        placeholder={t("Add a tag…")}
        value={draft()}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit();

            return;
          }

          if (event.key === 'Backspace' && draft() === '' && tags().length) {
            props.onValue(tags().slice(0, -1));
          }
        }}
      />
    </Field>
  );
}
