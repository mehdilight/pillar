import { For, Show, createMemo, createSignal, type JSX } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';
import Drawer from '../../components/ui/Drawer';
import { NamedIcon, Plus, Trash2 } from '../../components/ui/Icons';
import SettingInput from '../../components/SettingInput';
import { Button, Input, Label, Textarea } from '../ui/ds';
import { collections } from '../../store/content';
import { FIELD_TYPES, cleanField, handleFrom, holdsFields, isDecorative, needsOptions, validHandle } from '../../lib/fieldTypes';
import type { FieldType, SchemaSetting, VisibilityOperator, VisibilityRule } from '../../types';
import FieldList from './FieldList';

/** Groups inside repeaters inside groups — as deep as the schema parser allows. */
const MAX_DEPTH = 3;

/** Types whose default can be chosen with their own control. */
const DEFAULTABLE: FieldType[] = ['text', 'textarea', 'url', 'number', 'range', 'checkbox', 'select', 'radio', 'checkboxes', 'color', 'date', 'icon'];

/**
 * One field's settings, in a drawer over the list it belongs to.
 *
 * Edits a copy: Done hands the cleaned field back, Cancel drops it, so a half
 * configured field never reaches the schema.
 */
export default function FieldEditor(props: {
  field: SchemaSetting;
  isNew: boolean;
  /** Handles already used by the field's siblings. */
  taken: string[];
  /** The fields beside this one — what its conditions can depend on. */
  siblings: SchemaSetting[];
  depth: number;
  onDone: (field: SchemaSetting) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = createStore<SchemaSetting>(structuredClone(props.field));
  // A new field's handle follows its label until someone types a handle.
  const [handleTouched, setHandleTouched] = createSignal(!props.isNew);
  const info = () => FIELD_TYPES[draft.type];
  const decorative = () => isDecorative(draft.type);

  const set = <K extends keyof SchemaSetting>(key: K, value: SchemaSetting[K]) => setDraft(key as never, value as never);

  const errors = createMemo(() => {
    const out: string[] = [];

    if (!decorative()) {
      if (!validHandle(draft.id)) out.push('The handle must start with a letter and use only a–z, 0–9 and _.');
      else if (props.taken.includes(draft.id)) out.push(`Another field here is already called “${draft.id}”.`);
    }

    if (needsOptions(draft.type)) {
      const values = (draft.options ?? []).map((option) => option.value.trim());

      if (values.length === 0) out.push('Add at least one option.');
      if (values.some((value) => value === '')) out.push('Every option needs a value.');
      if (new Set(values).size !== values.length) out.push('Two options have the same value.');
    }

    if (holdsFields(draft.type) && !(draft.fields ?? []).some((field) => !isDecorative(field.type))) {
      out.push(`A ${info().label.toLowerCase()} needs at least one field.`);
    }

    if (draft.type === 'collection_item' && !draft.collections?.length) out.push('Choose at least one collection its entries come from.');
    if ((draft.visible_if ?? []).some((rule) => !rule.field)) out.push('Every condition needs a field.');

    return out;
  });

  const done = () => {
    if (errors().length) return;

    props.onDone(cleanField(structuredClone(unwrap(draft))));
  };

  return (
    <Drawer
      open
      onClose={props.onClose}
      width={Math.max(480, 640 - props.depth * 40)}
      title={props.isNew ? `New ${info().label.toLowerCase()} field` : decorative() ? info().label : draft.label || draft.id}
      subtitle={
        <span class="inline-flex items-center gap-1.5">
          <NamedIcon name={info().icon} size={12} />
          {info().label}
          <Show when={!decorative()}>
            <span>·</span>
            <span class="font-mono">{draft.id || '—'}</span>
          </Show>
        </span>
      }
      footer={
        <>
          <Show when={errors().length}>
            <p class="mr-auto text-xs text-danger">{errors()[0]}</p>
          </Show>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button variant="primary" disabled={errors().length > 0} onClick={done}>
            {props.isNew ? 'Add field' : 'Done'}
          </Button>
        </>
      }
    >
      <div class="space-y-6">
        <Section title="Display">
          <Show
            when={!decorative()}
            fallback={
              <Row label={draft.type === 'header' ? 'Heading' : 'Text'} for="field-content">
                <Textarea id="field-content" class="max-w-none" value={draft.content ?? ''} onInput={(event) => set('content', event.currentTarget.value)} />
              </Row>
            }
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <Row label="Label" for="field-label">
                <Input
                  id="field-label"
                  class="max-w-none"
                  autofocus
                  value={draft.label}
                  onInput={(event) => {
                    set('label', event.currentTarget.value);
                    if (!handleTouched()) set('id', handleFrom(event.currentTarget.value));
                  }}
                />
              </Row>
              <Row label="Handle" for="field-handle" hint="The key in the file — how templates read it.">
                <Input
                  id="field-handle"
                  class="max-w-none font-mono text-xs"
                  value={draft.id}
                  onInput={(event) => {
                    setHandleTouched(true);
                    set('id', event.currentTarget.value.trim());
                  }}
                />
              </Row>
            </div>
            <Show when={!props.isNew && props.field.id !== draft.id}>
              <p class="-mt-2 text-[11.5px] text-warning">Entries already saved keep their value under “{props.field.id}” until they are edited.</p>
            </Show>
            <Row label="Instructions" for="field-info" hint="Shown under the field, for whoever fills it in.">
              <Textarea id="field-info" class="max-w-none min-h-16" value={draft.info ?? ''} onInput={(event) => set('info', event.currentTarget.value)} />
            </Row>
            <Show when={['text', 'textarea', 'url', 'number'].includes(draft.type)}>
              <Row label="Placeholder" for="field-placeholder">
                <Input id="field-placeholder" class="max-w-none" value={draft.placeholder ?? ''} onInput={(event) => set('placeholder', event.currentTarget.value)} />
              </Row>
            </Show>
          </Show>
        </Section>

        <Show when={needsOptions(draft.type)}>
          <Section title="Options" hint="Label is what people see; value is what the file stores.">
            <OptionsEditor options={draft.options ?? []} onChange={(options) => set('options', options)} />
          </Section>
        </Show>

        <Show when={draft.type === 'number' || draft.type === 'range'}>
          <Section title="Limits">
            <div class="grid gap-4 sm:grid-cols-4">
              <For each={['min', 'max', 'step'] as const}>
                {(key) => (
                  <Row label={{ min: 'Minimum', max: 'Maximum', step: 'Step' }[key]} for={`field-${key}`}>
                    <Input
                      id={`field-${key}`}
                      type="number"
                      class="max-w-none"
                      value={draft[key] ?? ''}
                      onInput={(event) => set(key, event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))}
                    />
                  </Row>
                )}
              </For>
              <Show when={draft.type === 'range'}>
                <Row label="Unit" for="field-unit">
                  <Input id="field-unit" class="max-w-none" placeholder="px" value={draft.unit ?? ''} onInput={(event) => set('unit', event.currentTarget.value)} />
                </Row>
              </Show>
            </div>
          </Section>
        </Show>

        <Show when={draft.type === 'image'}>
          <Section title="Images">
            <Toggle checked={Boolean(draft.multiple)} onChange={(on) => set('multiple', on)} label="Allow several images" hint="A gallery: the field stores a list." />
          </Section>
        </Show>

        <Show when={draft.type === 'collection_item'}>
          <Section title="Entries">
            <div>
              <p class="mb-1.5 text-xs font-medium text-text-secondary">Collections</p>
              <div class="grid gap-1.5 sm:grid-cols-2">
                <For each={collections() ?? []}>
                  {(collection) => (
                    <label class="flex cursor-pointer items-center gap-2.5 rounded-ds border border-border bg-surface px-3 py-2 hover:bg-surface-muted">
                      <input
                        type="checkbox"
                        class="size-4 rounded border-border-strong text-brand focus:ring-brand"
                        checked={(draft.collections ?? []).includes(collection.name)}
                        onChange={(event) => {
                          const chosen = new Set(draft.collections ?? []);

                          event.currentTarget.checked ? chosen.add(collection.name) : chosen.delete(collection.name);
                          set('collections', (collections() ?? []).map((c) => c.name).filter((name) => chosen.has(name)));
                        }}
                      />
                      <NamedIcon name={collection.icon} size={15} class="text-text-muted" />
                      <span class="text-[13px] text-text">{collection.label}</span>
                    </label>
                  )}
                </For>
              </div>
              <p class="mt-1.5 text-[11.5px] text-text-faint">
                {(draft.collections ?? []).length > 1 ? 'Stored as collection/slug, since several collections are offered.' : 'Stored as the entry’s slug.'}
              </p>
            </div>
            <Toggle checked={Boolean(draft.multiple)} onChange={(on) => set('multiple', on)} label="Allow several entries" hint="Related posts, featured docs: the field stores a list." />
            <Show when={draft.multiple}>
              <Row label="Maximum entries" for="field-max-entries" hint="Leave empty for no limit.">
                <Input
                  id="field-max-entries"
                  type="number"
                  min="1"
                  class="max-w-[140px]!"
                  value={draft.max ?? ''}
                  onInput={(event) => set('max', event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))}
                />
              </Row>
            </Show>
          </Section>
        </Show>

        <Show when={draft.type === 'date'}>
          <Section title="Date">
            <Toggle checked={Boolean(draft.time)} onChange={(on) => set('time', on)} label="Include a time" hint="Stored as 2026-09-10T14:30." />
          </Section>
        </Show>

        <Show when={holdsFields(draft.type)}>
          <Section
            title={draft.type === 'repeater' ? 'Fields in each row' : 'Fields in the group'}
            hint={draft.type === 'repeater' ? 'Every row has these fields — an FAQ row has a question and an answer.' : 'Stored together, read as one value: author.name, author.url.'}
          >
            <FieldList
              fields={draft.fields ?? []}
              onChange={(fields) => set('fields', fields)}
              depth={props.depth + 1}
              exclude={props.depth + 1 >= MAX_DEPTH ? ['group', 'repeater'] : undefined}
              empty="Add the fields this holds."
            />
          </Section>
          <Show when={draft.type === 'repeater'}>
            <Section title="Rows">
              <Row label="Maximum rows" for="field-max" hint="Leave empty for no limit.">
                <Input
                  id="field-max"
                  type="number"
                  min="1"
                  class="max-w-[140px]!"
                  value={draft.max ?? ''}
                  onInput={(event) => set('max', event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value))}
                />
              </Row>
            </Section>
          </Show>
        </Show>

        <Show when={!decorative()}>
          <Section title="Validation" hint="Checked when an entry is published — a draft may be saved incomplete.">
            <Toggle checked={Boolean(draft.required)} onChange={(on) => set('required', on)} label="Required" hint="A published entry must fill it in. A toggle must be switched on." />
            <Show when={['text', 'textarea', 'markdown', 'richtext'].includes(draft.type)}>
              <Row label="Character limit" for="field-limit" hint="Leave empty for no limit. The form counts as you type.">
                <Input
                  id="field-limit"
                  type="number"
                  min="1"
                  class="max-w-[140px]!"
                  value={draft.character_limit ?? ''}
                  onInput={(event) => set('character_limit', event.currentTarget.value === '' ? undefined : Math.max(1, Number(event.currentTarget.value)))}
                />
              </Row>
            </Show>
            <Show when={draft.type === 'text'}>
              <Row label="Input type" for="field-input-type" hint="The keyboard on a phone — and an email address is checked.">
                <select
                  id="field-input-type"
                  class="h-8 w-full max-w-[200px] rounded-ds border border-border-strong bg-surface px-2.5 py-0 text-[13px] text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand-tint"
                  value={draft.input_type ?? 'text'}
                  onChange={(event) => set('input_type', event.currentTarget.value === 'text' ? undefined : (event.currentTarget.value as 'email' | 'tel'))}
                >
                  <option value="text">Text</option>
                  <option value="email">Email address</option>
                  <option value="tel">Phone number</option>
                </select>
              </Row>
            </Show>
          </Section>

          <Section title="Appearance">
            <Show when={draft.type === 'radio'}>
              <Toggle checked={draft.display === 'buttons'} onChange={(on) => set('display', on ? 'buttons' : undefined)} label="Show as buttons" hint="A row of buttons instead of a list — for a few short options." />
            </Show>
            <Toggle checked={Boolean(draft.hidden)} onChange={(on) => set('hidden', on)} label="Hide from the form" hint="Kept in the file and read by templates, never shown — for data a script or plugin manages." />
          </Section>

          <Section title="Conditions" hint="Show this field only when every rule holds. A hidden field is never required, and keeps its value.">
            <ConditionsEditor rules={draft.visible_if ?? []} siblings={props.siblings} onChange={(rules) => set('visible_if', rules)} />
          </Section>
        </Show>

        <Show when={DEFAULTABLE.includes(draft.type) && (!needsOptions(draft.type) || (draft.options ?? []).length > 0)}>
          <Section title="Default" hint="What a new entry starts with.">
            {/* The control brings its own bottom margin; the negative one evens the box's padding. */}
            <div class="rounded-ds border border-border bg-surface p-3">
              <div class="-mb-3.5">
                <SettingInput
                  setting={{ ...unwrap(draft), label: '', info: '', default: undefined } as SchemaSetting}
                  value={draft.default}
                  onChange={(value) => set('default', value === '' ? undefined : value)}
                />
              </div>
            </div>
            <Show when={draft.default !== undefined}>
              <button type="button" class="mt-1.5 text-[11.5px] text-text-muted hover:text-text hover:underline" onClick={() => set('default', undefined)}>
                Clear the default
              </button>
            </Show>
          </Section>
        </Show>
      </div>
    </Drawer>
  );
}

const OPERATORS: Array<{ value: VisibilityOperator; label: string }> = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'empty', label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
];

const selectClass =
  'h-8 rounded-ds border border-border-strong bg-surface px-2.5 py-0 text-[13px] text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand-tint';

/** "Show when [kind] [is] [video]" — rules over the fields beside this one. */
function ConditionsEditor(props: { rules: VisibilityRule[]; siblings: SchemaSetting[]; onChange: (rules: VisibilityRule[]) => void }) {
  const candidates = () => props.siblings.filter((field) => !isDecorative(field.type) && field.id);
  const update = (index: number, patch: Partial<VisibilityRule>) => props.onChange(props.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  const sibling = (id: string) => candidates().find((field) => field.id === id);

  return (
    <div>
      <Show when={props.rules.length} fallback={<p class="text-xs text-text-faint">Always shown.</p>}>
        <div class="space-y-2">
          <For each={props.rules}>
            {(rule, index) => (
              <div class="flex flex-wrap items-center gap-2">
                <span class="w-12 text-xs text-text-muted">{index() === 0 ? 'Show if' : 'and'}</span>
                <select aria-label="Field" class={`${selectClass} min-w-0 flex-1`} value={rule.field} onChange={(event) => update(index(), { field: event.currentTarget.value, value: undefined })}>
                  <option value="">Choose a field…</option>
                  <For each={candidates()}>{(field) => <option value={field.id}>{field.label || field.id}</option>}</For>
                </select>
                <select aria-label="Comparison" class={selectClass} value={rule.operator ?? 'equals'} onChange={(event) => update(index(), { operator: event.currentTarget.value as VisibilityOperator })}>
                  <For each={OPERATORS}>{(operator) => <option value={operator.value}>{operator.label}</option>}</For>
                </select>
                <Show when={!['empty', 'not_empty'].includes(rule.operator ?? 'equals')}>
                  <Show
                    when={sibling(rule.field)?.options?.length || sibling(rule.field)?.type === 'checkbox'}
                    fallback={
                      <Input aria-label="Value" class="max-w-none min-w-0 flex-1" value={String(rule.value ?? '')} onInput={(event) => update(index(), { value: event.currentTarget.value })} />
                    }
                  >
                    <select aria-label="Value" class={`${selectClass} min-w-0 flex-1`} value={String(rule.value ?? '')} onChange={(event) => update(index(), { value: sibling(rule.field)?.type === 'checkbox' ? event.currentTarget.value === 'true' : event.currentTarget.value })}>
                      <option value="">Choose…</option>
                      <For each={sibling(rule.field)?.type === 'checkbox' ? [{ value: 'true', label: 'On' }, { value: 'false', label: 'Off' }] : sibling(rule.field)?.options ?? []}>
                        {(option) => <option value={option.value}>{option.label}</option>}
                      </For>
                    </select>
                  </Show>
                </Show>
                <button
                  type="button"
                  class="flex size-8 shrink-0 items-center justify-center rounded-ds text-text-muted hover:bg-danger-tint hover:text-danger"
                  aria-label="Remove this rule"
                  onClick={() => props.onChange(props.rules.filter((_, i) => i !== index()))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
      <button
        type="button"
        class="mt-2 -ml-2 inline-flex items-center gap-1.5 rounded-ds px-2 py-1.5 text-[13px] font-medium text-brand hover:bg-brand-tint disabled:cursor-not-allowed disabled:opacity-40"
        disabled={candidates().length === 0}
        title={candidates().length === 0 ? 'Add another field first — a condition depends on one.' : undefined}
        onClick={() => props.onChange([...props.rules, { field: candidates()[0]?.id ?? '', operator: 'equals' }])}
      >
        <Plus size={14} />
        Add a rule
      </button>
    </div>
  );
}

function Section(props: { title: string; hint?: string; children: JSX.Element }) {
  return (
    <section>
      <h3 class="text-[11.5px] font-semibold uppercase tracking-[.05em] text-text-muted">{props.title}</h3>
      <Show when={props.hint}>
        <p class="mt-0.5 text-xs text-text-faint">{props.hint}</p>
      </Show>
      <div class="mt-3 space-y-4">{props.children}</div>
    </section>
  );
}

function Row(props: { label: string; for: string; hint?: string; children: JSX.Element }) {
  return (
    <div>
      <Label for={props.for}>{props.label}</Label>
      {props.children}
      <Show when={props.hint}>
        <p class="mt-1 text-[11.5px] text-text-faint">{props.hint}</p>
      </Show>
    </div>
  );
}

function Toggle(props: { checked: boolean; onChange: (on: boolean) => void; label: string; hint?: string }) {
  return (
    <label class="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        class="relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors"
        classList={{ 'bg-brand': props.checked, 'bg-border-strong': !props.checked }}
        onClick={() => props.onChange(!props.checked)}
      >
        <span class="absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left]" style={{ left: props.checked ? '18px' : '2px' }} />
      </button>
      <span>
        <span class="block text-[13px] font-medium text-text">{props.label}</span>
        <Show when={props.hint}>
          <span class="block text-xs text-text-faint">{props.hint}</span>
        </Show>
      </span>
    </label>
  );
}

/** Label/value pairs; a value follows its label until it is edited. */
function OptionsEditor(props: { options: Array<{ value: string; label: string }>; onChange: (options: Array<{ value: string; label: string }>) => void }) {
  const update = (index: number, patch: Partial<{ value: string; label: string }>) =>
    props.onChange(
      produce<Array<{ value: string; label: string }>>((options) => {
        Object.assign(options[index], patch);
      })(structuredClone(props.options))
    );

  return (
    <div>
      <div class="space-y-2">
        <For each={props.options}>
          {(option, index) => (
            <div class="flex items-center gap-2">
              <Input
                aria-label="Option label"
                placeholder="Label"
                class="max-w-none flex-1"
                value={option.label}
                onInput={(event) => {
                  const label = event.currentTarget.value;
                  const follows = option.value === '' || option.value === handleFrom(option.label);

                  update(index(), follows ? { label, value: handleFrom(label) } : { label });
                }}
              />
              <Input
                aria-label="Option value"
                placeholder="value"
                class="max-w-none flex-1 font-mono text-xs"
                value={option.value}
                onInput={(event) => update(index(), { value: event.currentTarget.value })}
              />
              <button
                type="button"
                class="flex size-8 shrink-0 items-center justify-center rounded-ds text-text-muted hover:bg-danger-tint hover:text-danger"
                aria-label={`Remove ${option.label || option.value}`}
                onClick={() => props.onChange(props.options.filter((_, i) => i !== index()))}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </For>
      </div>
      <button
        type="button"
        class="mt-2 -ml-2 inline-flex items-center gap-1.5 rounded-ds px-2 py-1.5 text-[13px] font-medium text-brand hover:bg-brand-tint"
        onClick={() => props.onChange([...props.options, { value: '', label: '' }])}
      >
        <Plus size={14} />
        Add option
      </button>
    </div>
  );
}
