import { For, Show, createSignal } from 'solid-js';
import { ChevronDown, GripVertical, NamedIcon, Plus, Trash2 } from '../../components/ui/Icons';
import { FIELD_TYPES, holdsFields, isDecorative, newField } from '../../lib/fieldTypes';
import type { FieldType, SchemaSetting } from '../../types';
import FieldTypePicker from './FieldTypePicker';
import FieldEditor from './FieldEditor';

/**
 * An ordered list of fields, edited in place: drag to reorder, click to
 * configure, add from the type picker.
 *
 * Used for a content type's fields and, recursively, for a group's or a
 * repeater's — each list owns its own picker and editor drawers, so a field
 * three levels down opens over the one that holds it.
 */
export default function FieldList(props: {
  fields: SchemaSetting[];
  onChange: (fields: SchemaSetting[]) => void;
  /** Types this list may not offer — a repeater cannot hold itself forever. */
  exclude?: FieldType[];
  depth?: number;
  empty?: string;
}) {
  const [picking, setPicking] = createSignal(false);
  // The field being configured: its index, or `null` for one not yet added.
  const [editing, setEditing] = createSignal<{ index: number | null; field: SchemaSetting } | null>(null);
  const [dragged, setDragged] = createSignal<number | null>(null);
  const [over, setOver] = createSignal<number | null>(null);

  const taken = (except: number | null) => props.fields.filter((_, index) => index !== except).map((field) => field.id);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= props.fields.length) return;

    const next = [...props.fields];
    const [field] = next.splice(from, 1);

    next.splice(to, 0, field);
    props.onChange(next);
  };

  const remove = (index: number) => props.onChange(props.fields.filter((_, i) => i !== index));

  const summary = (field: SchemaSetting) => {
    if (holdsFields(field.type)) return `${field.fields?.length ?? 0} field${field.fields?.length === 1 ? '' : 's'}`;
    if (field.options?.length) return `${field.options.length} options`;
    if (field.multiple && field.type === 'image') return 'Gallery';
    if (field.collections?.length) return field.collections.join(', ') + (field.multiple ? ' · several' : '');
    if (field.time) return 'With time';

    return '';
  };

  return (
    <div>
      <Show
        when={props.fields.length}
        fallback={
          <div class="rounded-ds border border-dashed border-border-strong bg-surface px-4 py-6 text-center text-xs text-text-faint">
            {props.empty ?? 'No fields yet.'}
          </div>
        }
      >
        <ul class="overflow-hidden rounded-ds border border-border bg-surface shadow-ds-sm">
          <For each={props.fields}>
            {(field, index) => (
              <li
                class="group relative flex items-center gap-2 border-b border-border px-2 py-2 last:border-b-0 transition-colors"
                classList={{
                  'bg-brand-tint/60': over() === index() && dragged() !== index(),
                  'opacity-40': dragged() === index(),
                  'hover:bg-surface-muted': dragged() === null,
                }}
                onDragOver={(event) => {
                  if (dragged() === null) return;
                  event.preventDefault();
                  setOver(index());
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragged() !== null) move(dragged()!, index());
                  setDragged(null);
                  setOver(null);
                }}
              >
                <span
                  draggable="true"
                  class="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-text-faint active:cursor-grabbing"
                  title="Drag to reorder"
                  onDragStart={(event) => {
                    setDragged(index());
                    event.dataTransfer?.setData('text/plain', String(index()));
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDragged(null);
                    setOver(null);
                  }}
                >
                  <GripVertical size={14} />
                </span>

                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-3 rounded-ds py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onClick={() => setEditing({ index: index(), field: structuredClone(field) })}
                >
                  <span class="flex size-7 shrink-0 items-center justify-center rounded-ds bg-surface-muted text-text-secondary">
                    <NamedIcon name={FIELD_TYPES[field.type]?.icon ?? 'question'} size={15} />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13px] font-medium text-text">
                      {isDecorative(field.type) ? field.content || field.label || FIELD_TYPES[field.type].label : field.label || field.id}
                    </span>
                    <span class="block truncate text-[11.5px] text-text-faint">
                      <Show when={!isDecorative(field.type)}>
                        <span class="font-mono">{field.id}</span>
                        <span class="mx-1.5">·</span>
                      </Show>
                      {FIELD_TYPES[field.type]?.label ?? field.type}
                      <Show when={summary(field)}>
                        <span class="mx-1.5">·</span>
                        {summary(field)}
                      </Show>
                    </span>
                  </span>
                </button>

                <div class="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    class="flex size-7 items-center justify-center rounded-ds text-text-muted hover:bg-surface hover:text-text disabled:opacity-30"
                    title="Move up"
                    aria-label={`Move ${field.label || field.id} up`}
                    disabled={index() === 0}
                    onClick={() => move(index(), index() - 1)}
                  >
                    <ChevronDown size={14} class="rotate-180" />
                  </button>
                  <button
                    type="button"
                    class="flex size-7 items-center justify-center rounded-ds text-text-muted hover:bg-surface hover:text-text disabled:opacity-30"
                    title="Move down"
                    aria-label={`Move ${field.label || field.id} down`}
                    disabled={index() === props.fields.length - 1}
                    onClick={() => move(index(), index() + 1)}
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    class="flex size-7 items-center justify-center rounded-ds text-text-muted hover:bg-danger-tint hover:text-danger"
                    title="Remove"
                    aria-label={`Remove ${field.label || field.id}`}
                    onClick={() => remove(index())}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <button
        type="button"
        class="mt-2 inline-flex items-center gap-1.5 rounded-ds px-2 py-1.5 text-[13px] font-medium text-brand hover:bg-brand-tint"
        onClick={() => setPicking(true)}
      >
        <Plus size={14} />
        Add field
      </button>

      <FieldTypePicker
        open={picking()}
        onClose={() => setPicking(false)}
        exclude={props.exclude}
        onChoose={(type) => {
          setPicking(false);
          setEditing({ index: null, field: newField(type, taken(null)) });
        }}
      />

      <Show when={editing()} keyed>
        {(current) => (
          <FieldEditor
            field={current.field}
            isNew={current.index === null}
            taken={taken(current.index)}
            depth={props.depth ?? 0}
            onClose={() => setEditing(null)}
            onDone={(field) => {
              const next = [...props.fields];

              current.index === null ? next.push(field) : (next[current.index] = field);
              props.onChange(next);
              setEditing(null);
            }}
          />
        )}
      </Show>
    </div>
  );
}
