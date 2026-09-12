import { t } from './i18n';
import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup } from 'solid-js';
import { Field, controlClass } from '@pillar/editor';
import { SettingInput } from '@pillar/editor';
import { analyse, type Assessment } from './analysis';
import SearchPreview from './SearchPreview';
import ImageField, { imagePreviewUrl } from './ImageField';

export interface SeoPreview {
  title: string; description: string; url: string; html: string; noindex: boolean;
  social_title?: string; social_description?: string; image?: string; image_preview?: string;
}

/** Bastet's analysis and overrides, presented around an author's everyday tasks. */
export default function SeoPanel(props: {
  collection: string; slug: string; frontmatter: Record<string, any>; body: string;
  onMeta: (meta: Record<string, any>) => void;
  preview: (input: Record<string, unknown>) => Promise<SeoPreview>;
}) {
  const meta = () => props.frontmatter.seo ?? {};
  const set = (key: string, value: unknown) => props.onMeta({ ...meta(), [key]: value });
  const [input, setInput] = createSignal<Record<string, unknown>>();
  createEffect(() => {
    const next = { collection: props.collection, slug: props.slug, frontmatter: props.frontmatter, body: props.body };
    const timer = window.setTimeout(() => setInput(next), 250);
    onCleanup(() => window.clearTimeout(timer));
  });
  const [preview] = createResource(input, props.preview);
  const resolved = () => preview.error ? undefined : preview();
  const assessment = createMemo(() => analyse({
    title: resolved()?.title ?? '', description: resolved()?.description ?? '',
    content: resolved()?.html ?? '', handle: props.slug,
    keyphrase: String(meta().focus_keyphrase ?? ''), language: 'en',
  }));
  const textField = (id: string, label: string, fallback: () => string, multiline = false, info?: string) => (
    <Field label={label} for={`seo-${id}`} info={info}>
      <Show when={multiline} fallback={
        <input id={`seo-${id}`} class={controlClass} value={meta()[id] ?? ''} placeholder={fallback()} onInput={(e) => set(id, e.currentTarget.value)} />
      }>
        <textarea id={`seo-${id}`} class={`${controlClass} h-auto! min-h-[88px] resize-y`} rows={3} value={meta()[id] ?? ''} placeholder={fallback()} onInput={(e) => set(id, e.currentTarget.value)} />
      </Show>
      <Show when={meta()[id]} fallback={<span class="text-[11px] text-gray-500">{t("Filled in automatically")}</span>}>
        <button type="button" class="text-[11px] text-[#005bd3] text-left hover:underline" onClick={() => set(id, '')}>{multiline ? t("Use automatic description") : t("Use automatic title")}</button>
      </Show>
    </Field>
  );

  return <section class="border-t border-[#e1e3e5] px-3 py-4" aria-label={t("Search and sharing")}>
    <h2 class="text-xs font-semibold text-gray-900 mb-2">{t("Search &amp; sharing")}</h2>
    <p class="text-xs leading-5 text-gray-500 mb-4">{t("Your page title and text are used automatically. Change them here if you want people to see something different.")}</p>
    <SearchPreview title={resolved()?.title || props.frontmatter.title || props.slug}
      description={resolved()?.description || ''} url={resolved()?.url || `/${props.collection === 'pages' ? '' : `${props.collection}/`}${props.slug}/`}
      hidden={resolved()?.noindex} loading={preview.loading} />
    {textField('title', t("Title in search results"), () => resolved()?.title || props.frontmatter.title || '', false)}
    {textField('description', t("Description in search results"), () => resolved()?.description || t("What is this page about?"), true, t("A short summary that helps people decide to open your page."))}

    <details class="border-t border-[#e1e3e5] py-3">
      <summary class="text-xs font-semibold text-[#303030] cursor-pointer">{t("When someone shares this page")}</summary>
      <p class="ed-hint mt-3 mb-3">{t("This is the preview shown in a message or social post. It uses your search title and description unless you change them.")}</p>
      <div class="rounded-lg border border-[#e1e3e5] overflow-hidden mb-4 bg-[#f6f6f7]" aria-label={t("Shared link preview")}>
        <Show when={resolved()?.image_preview}><img class="w-full h-28 object-cover" src={imagePreviewUrl(resolved()!.image_preview!)} alt={t("Sharing preview")} /></Show>
        <div class="p-3"><p class="text-xs font-semibold text-[#202223]">{resolved()?.social_title || resolved()?.title || props.frontmatter.title}</p>
          <p class="text-[11px] leading-4 text-gray-500 mt-1">{resolved()?.social_description || resolved()?.description}</p></div>
      </div>
      <ImageField value={meta().og_image} onValue={(value) => set('og_image', value)} />
      {textField('og_title', t("Shared link title"), () => resolved()?.title || '')}
      {textField('og_description', t("Shared link description"), () => resolved()?.description || '', true)}
    </details>

    <details class="border-t border-[#e1e3e5] py-3">
      <summary class="text-xs font-semibold text-gray-600 cursor-pointer">{t("Writing suggestions · optional")}</summary>
      <p class="ed-hint mt-3 mb-3">{t("A few ideas to improve your text. You don’t need to pass every check to publish.")}</p>
      <Field label={t("What would someone search for?")} for="seo-focus-keyphrase" info={t("A few words that describe this page, such as “getting started with Pillar”.")}>
        <input id="seo-focus-keyphrase" class={controlClass} value={meta().focus_keyphrase ?? ''} onInput={(e) => set('focus_keyphrase', e.currentTarget.value)} />
      </Field>
      <Show when={meta().focus_keyphrase}>
        <Assessments entries={assessment().seo.assessments} />
      </Show>
      <p class="text-xs font-semibold mt-4 mb-2">{t("Easy to read")}</p>
      <Assessments entries={assessment().readability.assessments} />
    </details>

    <details class="border-t border-[#e1e3e5] py-3">
      <summary class="text-xs font-semibold text-gray-600 cursor-pointer">{t("Advanced settings")}</summary>
      <p class="ed-hint mt-3 mb-3">{t("You can leave these as they are for most pages.")}</p>
      <SettingInput setting={{ id: 'seo-visible', label: t("Allow this page to appear in search"), type: 'checkbox', info: t("Drafts stay hidden until they are published.") }}
        value={!meta().noindex} onChange={(value) => set('noindex', !value)} />
      <SettingInput setting={{ id: 'seo-follow', label: t("Allow search engines to follow links"), type: 'checkbox' }}
        value={!meta().nofollow} onChange={(value) => set('nofollow', !value)} />
      <Field label={t("Original page address")} for="seo-canonical" info={t("Only needed if this text was first published elsewhere. Otherwise, leave empty.")}>
        <input id="seo-canonical" class={controlClass} type="url" placeholder="https://…" value={meta().canonical ?? ''} onInput={(e) => set('canonical', e.currentTarget.value)} />
      </Field>
    </details>
    <Show when={preview.error}><p class="text-xs text-red-600 mt-2" role="alert">{t("Preview could not update. Try editing again, or save and reopen this page.")}</p></Show>
    <p class="ed-hint mt-2">{t("Use the Save button above to apply these changes.")}</p>
  </section>;
}

function colour(rating: string): string {
  return rating === 'good' ? '#0a8043' : rating === 'ok' ? '#9a6700' : rating === 'bad' ? '#c5221f' : '#6b7280';
}
function translate(entry: Assessment): string {
  return t(entry.key, entry.vars);
}
function Assessments(props: { entries: Assessment[] }) {
  return <ul class="flex flex-col gap-2 text-[11px] leading-4">
    <For each={props.entries}>{(entry) => <li class="flex gap-2 items-start">
      <span class="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: colour(entry.rating) }} aria-label={t(`rating.${entry.rating}`)} />
      <span>{translate(entry)}</span>
    </li>}</For>
  </ul>;
}
