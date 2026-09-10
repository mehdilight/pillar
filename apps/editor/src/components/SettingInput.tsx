import { Match, Show, Switch, createResource } from 'solid-js';
import type { SchemaSetting } from '../types';
import { api } from '../api/client';
import TextInput from './ui/TextInput';
import DateInput from './ui/DateInput';
import LinkPicker from './ui/LinkPicker';
import TextArea from './ui/TextArea';
import NumberInput from './ui/NumberInput';
import SelectInput from './ui/SelectInput';
import RadioGroup from './ui/RadioGroup';
import RangeInput from './ui/RangeInput';
import ColorInput from './ui/ColorInput';
import Checkbox from './ui/Checkbox';
import CodeInput from './ui/CodeInput';
import TagsInput from './ui/TagsInput';
import ImagePicker from './ui/ImagePicker';
import Field from './ui/Field';
import RichEditor from './ui/LazyRichEditor';
import CheckboxGroup from './fields/CheckboxGroup';
import GroupInput from './fields/GroupInput';
import RepeaterInput from './fields/RepeaterInput';
import TableInput from './fields/TableInput';
import IconPicker from './fields/IconPicker';
import FilePicker from './fields/FilePicker';
import GalleryInput from './fields/GalleryInput';
import RelationshipInput from './fields/RelationshipInput';
import CollectionPicker from './fields/CollectionPicker';
import AnyEntryInput from './fields/AnyEntryInput';
import ButtonGroup from './fields/ButtonGroup';
import VideoPicker from './fields/VideoPicker';

interface SettingInputProps {
  setting: SchemaSetting;
  value: any;
  onChange: (value: any) => void;
  /** Where this field sits in the form — `faq.1.` — so errors inside groups and rows find their field. */
  path?: string;
}

/**
 * Renders the control a `<schema>` setting asks for.
 *
 * Every `case` here must have a matching entry in `schema/field-types.json`,
 * from which PHP's `FieldType` enum is generated. A type rendered here that PHP
 * does not accept is not a soft failure — `Setting::fromArray()` throws and the
 * whole section stops parsing. That drift is exactly what went wrong in
 * bastet's editor; the generated list is what prevents it here.
 */
export default function SettingInput(props: SettingInputProps) {
  const setting = () => props.setting;
  // A required field says so where it is labelled.
  const label = () => (setting().required && setting().label ? `${setting().label} *` : setting().label);
  const value = () => props.value ?? setting().default;
  const options = () => setting().options ?? [];
  const firstOption = () => options()[0]?.value ?? '';
  const [menus] = createResource(() => setting().type === 'menu', () => api.menus());
  const menuOptions = () => {
    const available = Object.entries(menus() ?? {}).map(([value, menu]) => ({ value, label: menu.title || value }));
    const selected = String(value() ?? '');

    return selected && !available.some((option) => option.value === selected)
      ? [{ value: selected, label: `${selected} (missing)` }, ...available]
      : available;
  };

  return (
    <Switch fallback={<UnknownType type={setting().type} />}>
      {/* ── Decorative: structure for the sidebar, no value ───────────── */}
      <Match when={setting().type === 'header'}>
        <div class="ed-field">
          <div class="ed-group-head">{setting().content || setting().label}</div>
          <Show when={setting().info}>
            <p class="ed-hint">{setting().info}</p>
          </Show>
        </div>
      </Match>

      <Match when={setting().type === 'paragraph'}>
        <div class="ed-field">
          <p class="ed-hint" style={{ 'margin-top': 0 }}>
            {setting().content || setting().label}
          </p>
        </div>
      </Match>

      {/* ── Text ──────────────────────────────────────────────────────── */}
      <Match when={setting().type === 'text'}>
        <TextInput
          label={label()}
          info={setting().info}
          type={setting().input_type ?? 'text'}
          value={value() ?? ''}
          placeholder={setting().placeholder ?? setting().default}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'url'}>
        <LinkPicker
          label={label()}
          info={setting().info}
          value={value() ?? ''}
          placeholder={setting().placeholder ?? setting().default ?? '/'}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'textarea'}>
        <TextArea
          label={label()}
          info={setting().info}
          value={value() ?? ''}
          placeholder={setting().placeholder ?? setting().default}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'markdown' || setting().type === 'richtext'}>
        <Field label={label()} info={setting().info}>
          <RichEditor
            value={value() ?? ''}
            onValue={props.onChange}
            // `richtext` settings store HTML; `markdown` ones, markdown.
            format={setting().type === 'richtext' ? 'html' : 'markdown'}
            minHeight={160}
          />
        </Field>
      </Match>

      <Match when={setting().type === 'html' || setting().type === 'code'}>
        <CodeInput
          label={label()}
          info={setting().info}
          language={setting().type === 'html' ? 'html' : 'code'}
          value={value() ?? ''}
          onValue={props.onChange}
        />
      </Match>

      {/* ── Numbers ───────────────────────────────────────────────────── */}
      <Match when={setting().type === 'number'}>
        <NumberInput
          label={label()}
          info={setting().info}
          value={value() ?? ''}
          min={setting().min}
          max={setting().max}
          step={setting().step}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'range'}>
        <RangeInput
          label={label()}
          info={setting().info}
          value={Number(value() ?? setting().min ?? 0)}
          min={setting().min}
          max={setting().max}
          step={setting().step}
          unit={setting().unit}
          onValue={props.onChange}
        />
      </Match>

      {/* ── Choices ───────────────────────────────────────────────────── */}
      <Match when={setting().type === 'checkbox'}>
        <div class="ed-field">
          <Checkbox checked={Boolean(value() ?? false)} onValue={props.onChange}>
            {label()}
          </Checkbox>
          <Show when={setting().info}>
            <p class="ed-hint" style={{ 'margin-left': '23px' }}>
              {setting().info}
            </p>
          </Show>
        </div>
      </Match>

      <Match when={setting().type === 'radio' && setting().display === 'buttons'}>
        <ButtonGroup label={label()} info={setting().info} value={String(value() ?? firstOption())} options={options()} onValue={props.onChange} />
      </Match>

      <Match when={setting().type === 'radio'}>
        <RadioGroup
          label={label()}
          info={setting().info}
          value={String(value() ?? firstOption())}
          options={options()}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'checkboxes'}>
        <CheckboxGroup
          label={label()}
          info={setting().info}
          options={options()}
          value={Array.isArray(value()) ? value() : []}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'select'}>
        <SelectInput
          label={label()}
          info={setting().info}
          value={String(value() ?? firstOption())}
          options={options()}
          onValue={props.onChange}
        />
      </Match>

      {/* ── Appearance ────────────────────────────────────────────────── */}
      <Match when={setting().type === 'color'}>
        <ColorInput
          label={label()}
          info={setting().info}
          value={String(value() ?? '#000000')}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'icon'}>
        <IconPicker label={label()} info={setting().info} value={String(value() ?? '')} onValue={props.onChange} />
      </Match>

      {/* ── Assets & content references ───────────────────────────────── */}
      <Match when={setting().type === 'image' && setting().multiple}>
        <GalleryInput label={label()} info={setting().info} value={Array.isArray(value()) ? value() : []} onValue={props.onChange} />
      </Match>

      <Match when={setting().type === 'file'}>
        <FilePicker label={label()} info={setting().info} extensions={setting().extensions} value={value() ?? null} onValue={props.onChange} />
      </Match>

      <Match when={setting().type === 'video'}>
        <VideoPicker label={label()} info={setting().info} value={value() ?? null} onValue={props.onChange} />
      </Match>

      <Match when={setting().type === 'image'}>
        <ImagePicker
          label={label()}
          info={setting().info}
          value={value() ?? undefined}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'tags'}>
        <TagsInput
          label={label()}
          info={setting().info}
          value={Array.isArray(value()) ? value() : []}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'date'}>
        <DateInput label={label()} info={setting().info} time={setting().time} value={String(value() ?? '')} onValue={props.onChange} />
      </Match>

      {/*
        A reference to something else in the site — a menu, a collection, an
        entry, a page — always chosen from what the site has, never typed.
      */}
      <Match when={setting().type === 'menu'}>
        <SelectInput
          label={label()}
          info={setting().info ?? 'Choose a navigation list. Manage lists under Navigation.'}
          value={String(value() ?? '')}
          options={menuOptions()}
          onValue={props.onChange}
        />
      </Match>

      {/* ── Relationships: linked by reference, read by templates as entries ─ */}
      <Match when={setting().type === 'collection_item' && setting().collections?.length}>
        <RelationshipInput
          label={label()}
          info={setting().info}
          collections={setting().collections!}
          multiple={setting().multiple}
          max={setting().max}
          value={value()}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'page'}>
        <RelationshipInput label={label()} info={setting().info} collections={['pages']} value={value()} onValue={props.onChange} />
      </Match>

      <Match when={setting().type === 'collection'}>
        <CollectionPicker label={label()} info={setting().info} value={String(value() ?? '')} onValue={props.onChange} />
      </Match>

      {/* ── Structure: fields inside fields ───────────────────────────── */}
      <Match when={setting().type === 'group'}>
        <GroupInput
          path={`${props.path ?? setting().id}.`}
          label={label()}
          info={setting().info}
          fields={setting().fields ?? []}
          value={value() && typeof value() === 'object' && !Array.isArray(value()) ? value() : {}}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'repeater'}>
        <RepeaterInput
          path={`${props.path ?? setting().id}.`}
          label={label()}
          info={setting().info}
          fields={setting().fields ?? []}
          max={setting().max}
          value={Array.isArray(value()) ? value().filter((row: unknown) => row && typeof row === 'object') : []}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'table'}>
        <TableInput
          label={label()}
          info={setting().info}
          value={Array.isArray(value()) ? value().map((row: unknown) => (Array.isArray(row) ? row.map(String) : [])) : []}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'collection_item'}>
        <AnyEntryInput label={label()} info={setting().info} multiple={setting().multiple} max={setting().max} value={value()} onValue={props.onChange} />
      </Match>
    </Switch>
  );
}

/**
 * A type this build does not know.
 *
 * Shown rather than swallowed: a theme using a type the editor cannot render is
 * a real mistake in the `<schema>` block, and hiding it produces a section whose
 * settings silently do nothing.
 */
function UnknownType(props: { type: string }) {
  return (
    <div class="ed-field">
      <p class="ed-error">
        Unknown setting type <code class="sam-mono">{props.type}</code>.
      </p>
    </div>
  );
}
