import { t } from './i18n';
import { For, Show, createEffect, createResource, createSignal, onCleanup } from 'solid-js';
import { Field, controlClass } from '@pillar/editor';
import { SettingInput } from '@pillar/editor';
import { api } from '@pillar/editor';
import type { SchemaSetting } from '@pillar/editor';
import ImageField from './ImageField';
import SearchPreview from './SearchPreview';
import type { SeoPreview } from './SeoPanel';

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
  const [preview] = createResource(input, (data) => api.preview<SeoPreview>('seo', data));
  const resolved = () => preview.error ? undefined : preview();
  const advanced = () => props.fields.filter((field) => !['site_name', 'home_description', 'social_image'].includes(field.id.split(':').pop()!));

  return <div>
    <p class="text-xs leading-5 text-gray-500 mb-4">{t("Choose how your website looks in search results and shared links. Individual pages can have their own title, description and image.")}</p>
    <SearchPreview title={resolved()?.title || value('site_name') || props.values.site_title || t("Your website")}
      description={resolved()?.description || value('home_description') || props.values.tagline || ''}
      url={resolved()?.url || t("Your website address")} loading={preview.loading} />
    <Field label={t("Website name")} for="seo-site-name" info={t("The name people recognize. Leave empty to use your site’s name.")}>
      <input id="seo-site-name" class={controlClass} value={value('site_name')} placeholder={props.values.site_title || t("Your website name")} onInput={(e) => change('site_name', e.currentTarget.value)} />
    </Field>
    <Field label={t("Short description")} for="seo-home-description" info={t("In one or two sentences, tell people what your website is about.")}>
      <textarea id="seo-home-description" class={`${controlClass} h-auto! min-h-[88px] resize-y`} rows={3} value={value('home_description')} placeholder={props.values.tagline || t("What will people find here?")} onInput={(e) => change('home_description', e.currentTarget.value)} />
    </Field>
    <ImageField value={value('social_image')} onValue={(next) => change('social_image', next)} label={t("Default sharing image")} />
    <p class="ed-hint mb-4">{t("Used when a page doesn’t have its own image. Your changes save automatically.")}</p>
    <details class="border-t border-[#e1e3e5] pt-3">
      <summary class="text-xs font-semibold text-gray-600 cursor-pointer">{t("Advanced settings")}</summary>
      <p class="ed-hint mt-3 mb-4">{t("The defaults work for most websites. These options control automatic titles, publisher information and search-engine files.")}</p>
      <For each={advanced()}>{(field) => <SettingInput setting={localizeField(field)} value={props.values[field.id]} onChange={(next) => props.onChange(field.id, next)} />}</For>
      <p class="ed-hint">{t("Title templates can use %%title%% for a page title, %%sitename%% for your website name, and %%sep%% for the separator.")}</p>
    </details>
    <Show when={preview.error}><p class="ed-hint mt-2">{t("Preview could not update. Your settings can still be saved.")}</p></Show>
  </div>;
}

/** These are the plugin's built-in labels, never the user's content values. */
function localizeField(field: SchemaSetting): SchemaSetting {
  const id = field.id.split(':').pop()!;
  const label = field.label ?? '';
  const dynamicTitle = id.startsWith('title_') && !['title_home', 'title_page'].includes(id);
  const dynamicDescription = id.startsWith('description_') && id !== 'description_page';
  return {
    ...field,
    label: dynamicTitle ? t('Collection title', { collection: label.replace(/ title$/, '') })
      : dynamicDescription ? t('Collection description', { collection: label.replace(/ description$/, '') })
      : t(label),
    info: field.info ? t(field.info) : undefined,
    content: field.content ? t(field.content) : undefined,
    placeholder: field.placeholder ? t(field.placeholder) : undefined,
    options: field.options?.map((option) => ({ ...option, label: t(option.label) })),
  };
}
