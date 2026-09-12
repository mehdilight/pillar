import { t } from '../../i18n';
import { Show, createMemo, createSignal, onMount } from 'solid-js';
import Field from '../ui/Field';
import CustomSelect from '../ui/CustomSelect';
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

  const options = createMemo(() => {
    const list: Array<{ value: string; label: string }> = [
      { value: '', label: collections() === null ? t("Loading…") : t("Choose a collection") },
    ];

    if (collections()) {
      for (const col of collections()!) {
        list.push({ value: col.name, label: `${col.label} (${col.count})` });
      }
    }

    if (missing()) {
      list.push({ value: props.value, label: `${props.value} ${t("(missing)")}` });
    }

    return list;
  });

  return (
    <Field label={props.label} info={props.info}>
      <CustomSelect
        value={props.value}
        onChange={props.onValue}
        options={options()}
        triggerClass="h-9 bg-white border-[#c9cccf] rounded-lg px-3 text-[13px] leading-5 text-[#202223] focus:border-[#005bd3] focus:ring-1 focus:ring-[#005bd3] shadow-xs hover:border-[#8c9196]"
      />
    </Field>
  );
}
