import { t } from '../../i18n';
import { For, Show, createSignal, onMount } from 'solid-js';
import Field, { controlClass } from '../ui/Field';
import NativeSelect from '../ui/NativeSelect';
import { api } from '../../api/client';
import type { ContentCollection } from '../../types';

/**
 * A collection, by name — what a listing section reads its entries from.
 * Stays a name, not entries: a template indexes `collections[name]` with it.
 */
export default function CollectionPicker(props: { label?: string; info?: string; value: string; onValue: (value: string) => void }) {
  const [collections, setCollections] = createSignal<ContentCollection[] | null>(null);

  onMount(() => {
    api
      .collections()
      .then(setCollections)
      .catch(() => setCollections([]));
  });

  const missing = () => props.value !== '' && collections() !== null && !collections()!.some((collection) => collection.name === props.value);

  return (
    <Field label={props.label} info={props.info}>
      {/* `selected` on each option, not `value` on the select: the options arrive after the value, and a select's value set before its options exist is lost. */}
      <NativeSelect class={controlClass} onChange={(event) => props.onValue(event.currentTarget.value)}>
        <option value="" selected={props.value === ''}>
          {collections() === null ? t("Loading…") : t("Choose a collection")}
        </option>
        <For each={collections() ?? []}>
          {(collection) => (
            <option value={collection.name} selected={collection.name === props.value}>
              {collection.label} ({collection.count})
            </option>
          )}
        </For>
        <Show when={missing()}>
          <option value={props.value} selected>
            {props.value} {t("(missing)")} </option>
        </Show>
      </NativeSelect>
    </Field>
  );
}
