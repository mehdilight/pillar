import { t } from '../../i18n';
import { Show, createSignal, onMount } from 'solid-js';
import RelationshipInput from './RelationshipInput';
import { api } from '../../api/client';

/**
 * A `collection_item` whose schema names no collections — written by hand in
 * a theme, say. It offers every collection's entries and stores
 * `collection/slug`, the one form that resolves without knowing which
 * collection was meant.
 */
export default function AnyEntryInput(props: {
  label?: string;
  info?: string;
  multiple?: boolean;
  max?: number;
  value: string | string[] | null | undefined;
  onValue: (value: string | string[] | null) => void;
}) {
  const [names, setNames] = createSignal<string[] | null>(null);

  onMount(() => {
    api
      .collections()
      .then((collections) => setNames(collections.map((collection) => collection.name)))
      .catch(() => setNames([]));
  });

  return (
    <Show when={names()} fallback={<p class="mb-3.5 text-[11px] text-gray-500">{t("Loading entries…")}</p>}>
      {(list) => <RelationshipInput qualify label={props.label} info={props.info} collections={list()} multiple={props.multiple} max={props.max} value={props.value} onValue={props.onValue} />}
    </Show>
  );
}
