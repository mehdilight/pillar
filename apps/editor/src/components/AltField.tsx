import { Show, createEffect, createSignal, on } from 'solid-js';
import type { MediaItem } from '../types';

/** Screen readers read past this comfortably; longer belongs in a caption. */
const RECOMMENDED = 125;

/**
 * An image's alt text in the media library — written once, used wherever the
 * image appears without alt text of its own. Saved with the button or Enter.
 */
export default function AltField(props: { image: MediaItem; onSave: (alt: string) => Promise<unknown>; id?: string }) {
  const [draft, setDraft] = createSignal(props.image.alt);
  const [saving, setSaving] = createSignal(false);

  // Another image, or the saved value coming back, replaces the draft.
  createEffect(on(() => [props.image.url, props.image.alt], () => setDraft(props.image.alt), { defer: true }));

  const changed = () => draft().trim().replace(/\s+/g, ' ') !== props.image.alt;
  const id = () => props.id ?? 'media-alt';

  const save = async () => {
    if (!changed() || saving()) return;

    setSaving(true);
    await props.onSave(draft());
    setSaving(false);
  };

  return (
    <div>
      <div class="mb-1 flex items-baseline justify-between gap-2">
        <label for={id()} class="text-xs font-medium text-text-secondary">
          Alt text
        </label>
        <Show when={!props.image.alt && !changed()}>
          <span class="text-[11px] font-medium text-warning">Missing</span>
        </Show>
      </div>
      <textarea
        id={id()}
        rows={3}
        maxLength={500}
        class="block w-full resize-y rounded-ds border border-border-strong bg-surface px-2.5 py-1.5 text-[13px] leading-snug text-text outline-none placeholder:text-text-faint focus:border-brand focus:ring-2 focus:ring-brand-tint"
        placeholder="Describe what the image shows"
        value={draft()}
        onInput={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void save();
          }
        }}
      />
      <div class="mt-1 flex items-start justify-between gap-2">
        <p class="text-[11px] leading-snug text-text-faint">
          Read by screen readers and search engines, wherever the image has no alt text of its own.
          <Show when={draft().length > RECOMMENDED}>
            {' '}
            <span class="text-warning">Keep it under {RECOMMENDED} characters.</span>
          </Show>
        </p>
        <Show when={changed()}>
          <button
            type="button"
            class="inline-flex h-7 shrink-0 items-center rounded-ds border border-brand bg-brand px-2.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            disabled={saving()}
            onClick={() => void save()}
          >
            {saving() ? 'Saving…' : 'Save'}
          </button>
        </Show>
      </div>
    </div>
  );
}
