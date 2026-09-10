import { Show } from 'solid-js';
import FormFields from './FormFields';
import type { SchemaSetting } from '../../types';

/** Fields kept together as one value: `author.name`, `author.url`. */
export default function GroupInput(props: {
  /** This group's path with a trailing dot: `author.`. */
  path?: string;
  label?: string;
  info?: string;
  fields: SchemaSetting[];
  value: Record<string, unknown>;
  onValue: (value: Record<string, unknown>) => void;
}) {
  return (
    <fieldset class="mb-3.5 min-w-0 rounded-lg border border-[#e1e3e5] bg-[#fbfbfc] px-3 pb-1 pt-2">
      <Show when={props.label}>
        <legend class="px-1 text-[13px] font-medium text-[#303030]">{props.label}</legend>
      </Show>
      <Show when={props.info}>
        <p class="mb-2 text-[11px] leading-normal text-gray-500">{props.info}</p>
      </Show>
      <SubFields path={props.path} fields={props.fields} value={props.value} onValue={props.onValue} />
    </fieldset>
  );
}

/** A set of fields over one object — what a group is, and each repeater row. */
export function SubFields(props: { path?: string; fields: SchemaSetting[]; value: Record<string, unknown>; onValue: (value: Record<string, unknown>) => void }) {
  return <FormFields path={props.path} fields={props.fields} values={props.value} onChange={(id, value) => props.onValue({ ...props.value, [id]: value })} />;
}
