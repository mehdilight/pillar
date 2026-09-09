import { For, Show, createEffect, createResource, createSignal, on } from 'solid-js';
import SettingInput from './SettingInput';
import MarkdownEditor from './ui/MarkdownEditor';
import { showToast } from './ui/Toast';
import { api } from '../api/client';
import * as editor from '../store/editor';
import type { ContentItem } from '../types';

/**
 * One markdown file: its frontmatter as a form, its body as text.
 *
 * The form comes from `schemas/<collection>.json` — the same setting vocabulary
 * a section's `<schema>` uses, which is why `SettingInput` renders both.
 */
export default function ContentEditor(props: { item: ContentItem }) {
  const [collections] = createResource(api.collections);
  const [frontmatter, setFrontmatter] = createSignal<Record<string, any>>({});
  const [body, setBody] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  createEffect(
    on(
      () => `${props.item.collection}/${props.item.slug}`,
      () => {
        setFrontmatter({ ...props.item.frontmatter });
        setBody(props.item.body);
      }
    )
  );

  const fields = () =>
    collections()?.find((collection) => collection.name === props.item.collection)?.fields ?? [];

  const save = async () => {
    setSaving(true);

    try {
      await api.saveItem({
        ...props.item,
        title: frontmatter().title ?? props.item.slug,
        frontmatter: frontmatter(),
        body: body(),
      });
      await editor.refreshStatus();
      showToast('Saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="flex-1 flex min-h-0 bg-[#f1f2f4]">
      <div class="flex-1 flex flex-col min-w-0 p-6 overflow-y-auto">
        <div class="mx-auto w-full max-w-3xl flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <h1 class="text-sm font-semibold text-[#202223]">
                {frontmatter().title || props.item.slug}
              </h1>
              <span class="sam-mono text-[11px] text-gray-500">
                content/{props.item.collection}/{props.item.slug}.md
              </span>
            </div>
            <button type="button" class="sam-btn primary" disabled={saving()} onClick={save}>
              {saving() ? 'Saving…' : 'Save'}
            </button>
          </div>

          <MarkdownEditor
            value={body()}
            onValue={setBody}
            minHeight={520}
            placeholder="Write in markdown…"
          />
        </div>
      </div>

      <aside class="w-[300px] shrink-0 border-l border-[#e1e3e5] bg-white overflow-y-auto">
        <div class="px-4 pt-3 pb-2 text-xs font-semibold text-gray-900">Frontmatter</div>
        <div class="px-3 pb-4">
          <Show
            when={fields().length}
            fallback={
              <p class="ed-hint px-1">
                No <code class="sam-mono">schemas/{props.item.collection}.json</code> — this
                collection has no declared fields.
              </p>
            }
          >
            <For each={fields()}>
              {(field) => (
                <SettingInput
                  setting={field}
                  value={frontmatter()[field.id]}
                  onChange={(value) => setFrontmatter({ ...frontmatter(), [field.id]: value })}
                />
              )}
            </For>
          </Show>
        </div>
      </aside>
    </div>
  );
}
