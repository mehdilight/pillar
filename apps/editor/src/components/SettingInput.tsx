import { Match, Show, Switch, createResource } from 'solid-js';
import type { SchemaSetting } from '../types';
import { api } from '../api/client';
import TextInput from './ui/TextInput';
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
import Field, { controlClass } from './ui/Field';
import RichEditor from './ui/LazyRichEditor';

interface SettingInputProps {
  setting: SchemaSetting;
  value: any;
  onChange: (value: any) => void;
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
          label={setting().label}
          info={setting().info}
          value={value() ?? ''}
          placeholder={setting().placeholder ?? setting().default}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'url'}>
        <TextInput
          label={setting().label}
          info={setting().info}
          value={value() ?? ''}
          placeholder={setting().placeholder ?? setting().default ?? '/'}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'textarea'}>
        <TextArea
          label={setting().label}
          info={setting().info}
          value={value() ?? ''}
          placeholder={setting().placeholder ?? setting().default}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'markdown' || setting().type === 'richtext'}>
        <Field label={setting().label} info={setting().info}>
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
          label={setting().label}
          info={setting().info}
          language={setting().type === 'html' ? 'html' : 'code'}
          value={value() ?? ''}
          onValue={props.onChange}
        />
      </Match>

      {/* ── Numbers ───────────────────────────────────────────────────── */}
      <Match when={setting().type === 'number'}>
        <NumberInput
          label={setting().label}
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
          label={setting().label}
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
            {setting().label}
          </Checkbox>
          <Show when={setting().info}>
            <p class="ed-hint" style={{ 'margin-left': '23px' }}>
              {setting().info}
            </p>
          </Show>
        </div>
      </Match>

      <Match when={setting().type === 'radio'}>
        <RadioGroup
          label={setting().label}
          info={setting().info}
          value={String(value() ?? firstOption())}
          options={options()}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'select'}>
        <SelectInput
          label={setting().label}
          info={setting().info}
          value={String(value() ?? firstOption())}
          options={options()}
          onValue={props.onChange}
        />
      </Match>

      {/* ── Appearance ────────────────────────────────────────────────── */}
      <Match when={setting().type === 'color'}>
        <ColorInput
          label={setting().label}
          info={setting().info}
          value={String(value() ?? '#000000')}
          onValue={props.onChange}
        />
      </Match>

      {/* ── Assets & content references ───────────────────────────────── */}
      <Match when={setting().type === 'image' || setting().type === 'video'}>
        <ImagePicker
          label={setting().label}
          info={setting().info}
          value={value() ?? undefined}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'tags'}>
        <TagsInput
          label={setting().label}
          info={setting().info}
          value={Array.isArray(value()) ? value() : []}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'date'}>
        <Field label={setting().label} info={setting().info}>
          <input
            type="date"
            class={controlClass}
            value={String(value() ?? '').slice(0, 10)}
            onInput={(event) => props.onChange(event.currentTarget.value)}
          />
        </Field>
      </Match>

      {/*
        A reference to something else in the site — a collection, an item, a
        page, a menu. Resolved against the site's own data once `pillar dev`
        serves it; a free-text handle until then, which is what gets written to
        the JSON either way.
      */}
      <Match when={setting().type === 'menu'}>
        <SelectInput
          label={setting().label}
          info={setting().info ?? 'Choose a navigation list. Manage lists under Navigation.'}
          value={String(value() ?? '')}
          options={menuOptions()}
          onValue={props.onChange}
        />
      </Match>

      <Match when={setting().type === 'collection' || setting().type === 'collection_item' || setting().type === 'page'}>
        <TextInput
          label={setting().label}
          info={setting().info ?? `Handle of the ${setting().type.replace('_', ' ')}.`}
          value={value() ?? ''}
          placeholder={setting().placeholder ?? setting().default}
          class="font-mono text-xs"
          onValue={props.onChange}
        />
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
