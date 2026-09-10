import { For, Show, createEffect, createResource, createSignal, onCleanup } from 'solid-js';
import Field, { controlClass } from '../../../../apps/editor/src/components/ui/Field';
import SettingInput from '../../../../apps/editor/src/components/SettingInput';
import { api } from '../../../../apps/editor/src/api/client';
import type { SchemaSetting } from '../../../../apps/editor/src/types';
import ImageField from './ImageField';
import SearchPreview from './SearchPreview';

/** Everyday settings first; template syntax and crawler settings stay in Advanced. */
export default function SeoSettingsPanel(props: {
  fields: SchemaSetting[];
  values: Record<string, any>;
  onChange: (id: string, value: unknown) => void;
}) {
  const value = (key: string) => props.values[`plugin:seo:${key}`] ?? '';
  const change = (key: string, next: unknown) => props.onChange(`plugin:seo:${key}`, next);
  const [input, setInput] = createSignal<Record<string, unknown>>();
  createEffect(() => {
    const settings = Object.fromEntries(Object.entries(props.values).filter(([key]) => key.startsWith('plugin:seo:')).map(([key, v]) => [key.slice(11), v]));
    const timer = window.setTimeout(() => setInput({ kind: 'home', settings }), 200);
    onCleanup(() => window.clearTimeout(timer));
  });
  const [preview] = createResource(input, (data) => api.pluginPreview('seo', data));
  const resolved = () => preview.error ? undefined : preview();
  const advanced = () => props.fields.filter((field) => !['site_name', 'home_description', 'social_image'].includes(field.id.split(':').pop()!));

  return <div>
    <p class="text-xs leading-5 text-gray-500 mb-4">Choose how your website looks in search results and shared links. Individual pages can have their own title, description and image.</p>
    <SearchPreview title={resolved()?.title || value('site_name') || props.values.site_title || 'Your website'}
      description={resolved()?.description || value('home_description') || props.values.tagline || ''}
      url={resolved()?.url || 'Your website address'} loading={preview.loading} />
    <Field label="Website name" for="seo-site-name" info="The name people recognize. Leave empty to use your site’s name.">
      <input id="seo-site-name" class={controlClass} value={value('site_name')} placeholder={props.values.site_title || 'Your website name'} onInput={(e) => change('site_name', e.currentTarget.value)} />
    </Field>
    <Field label="Short description" for="seo-home-description" info="In one or two sentences, tell people what your website is about.">
      <textarea id="seo-home-description" class={`${controlClass} h-auto! min-h-[88px] resize-y`} rows={3} value={value('home_description')} placeholder={props.values.tagline || 'What will people find here?'} onInput={(e) => change('home_description', e.currentTarget.value)} />
    </Field>
    <ImageField value={value('social_image')} onValue={(next) => change('social_image', next)} label="Default sharing image" />
    <p class="ed-hint mb-4">Used when a page doesn’t have its own image. Your changes save automatically.</p>
    <details class="border-t border-[#e1e3e5] pt-3">
      <summary class="text-xs font-semibold text-gray-600 cursor-pointer">Advanced settings</summary>
      <p class="ed-hint mt-3 mb-4">The defaults work for most websites. These options control automatic titles, publisher information and search-engine files.</p>
      <For each={advanced()}>{(field) => <SettingInput setting={field} value={props.values[field.id]} onChange={(next) => props.onChange(field.id, next)} />}</For>
      <p class="ed-hint">Title templates can use %%title%% for a page title, %%sitename%% for your website name, and %%sep%% for the separator.</p>
    </details>
    <Show when={preview.error}><p class="ed-hint mt-2">Preview could not update. Your settings can still be saved.</p></Show>
  </div>;
}
