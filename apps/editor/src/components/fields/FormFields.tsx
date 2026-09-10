import { For, Show, createContext, useContext } from 'solid-js';
import SettingInput from '../SettingInput';
import { isDecorative, isWide } from '../../lib/fieldTypes';
import { isVisible } from '../../lib/fieldRules';
import type { SchemaSetting } from '../../types';

/**
 * Problems to show beside their fields, by dotted path — `faq.1.question`.
 * Provided by the page that validates (the entry form); empty elsewhere.
 */
export const FieldErrors = createContext<() => Record<string, string>>(() => ({}));

/**
 * A list of fields over one object of values: an entry's frontmatter, a
 * group, a repeater row, a section's settings.
 *
 * Owns what every such list needs: `hidden` fields are not drawn,
 * `visible_if` is evaluated against the values beside each field, a field
 * with a character limit counts, and a field with a problem says so under
 * itself. Hidden fields keep their values — hiding is not deleting.
 */
export default function FormFields(props: {
  fields: SchemaSetting[];
  values: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
  /** Prefix for the fields' paths: `faq.1.` inside a repeater's second row. */
  path?: string;
  /** Short fields two to a row, wide ones across — for a page's main column. */
  grid?: boolean;
}) {
  const errors = useContext(FieldErrors);

  return (
    <div class="min-w-0" classList={{ 'grid gap-x-5 sm:grid-cols-2': props.grid }}>
      <For each={props.fields}>
        {(field) => {
          const path = () => `${props.path ?? ''}${field.id}`;
          const length = () => {
            const value = props.values[field.id];

            return typeof value === 'string' ? [...value].length : 0;
          };

          return (
            <Show when={!field.hidden && isVisible(field, props.values)}>
              <div
                class="min-w-0"
                classList={{ 'sm:col-span-2': Boolean(props.grid) && (isWide(field) || isDecorative(field.type)) }}
                data-field={path()}
              >
                <SettingInput setting={field} path={path()} value={props.values[field.id]} onChange={(value) => props.onChange(field.id, value)} />
                <Show when={field.character_limit}>
                  <p class="-mt-2.5 mb-3 text-right text-[11px] tabular-nums" classList={{ 'text-red-600': length() > field.character_limit!, 'text-gray-400': length() <= field.character_limit! }}>
                    {length()} / {field.character_limit}
                  </p>
                </Show>
                <Show when={errors()[path()]}>
                  <p class="-mt-2 mb-3.5 text-xs text-red-600" role="alert">
                    {errors()[path()]}
                  </p>
                </Show>
              </div>
            </Show>
          );
        }}
      </For>
    </div>
  );
}
