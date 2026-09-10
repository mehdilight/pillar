import { Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import Modal from './ui/Modal';
import Field, { controlClass } from './ui/Field';
import SettingInput from './SettingInput';
import { showToast } from './ui/Toast';
import { api } from '../api/client';
import * as editor from '../store/editor';
import type { ContentCollection, ContentItem } from '../types';

const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function NewEntryModal(props: { collection: ContentCollection | null; onClose: () => void; onCreated: (item: ContentItem) => void | Promise<void> }) {
  const [title, setTitle] = createSignal('');
  const [customSlug, setCustomSlug] = createSignal<string | null>(null);
  const [draft, setDraft] = createSignal(true);
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal('');
  const slug = createMemo(() => customSlug() ?? slugify(title()));
  const valid = () => /^[a-z0-9][a-z0-9_-]*$/.test(slug());
  createEffect(on(() => props.collection?.name, () => { setTitle(''); setCustomSlug(null); setDraft(true); setError(''); }));
  const create = async (event?: SubmitEvent) => {
    event?.preventDefault();
    const collection = props.collection;
    if (!collection || !title().trim() || !valid() || pending()) return;
    setPending(true); setError('');
    const defaults = Object.fromEntries(collection.fields.filter((field) => field.default !== undefined).map((field) => [field.id, field.default]));
    const item: ContentItem = { collection: collection.name, slug: slug(), title: title().trim(), frontmatter: { ...defaults, title: title().trim(), draft: draft() }, body: '' };
    try {
      await api.createItem(item);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the entry. Try again.');
      setPending(false); return;
    }
    // Creation succeeded: close even if a later refresh fails, so retry cannot duplicate it.
    props.onClose();
    try { await props.onCreated(item); await editor.refreshStatus(); } catch { showToast('Entry created. Reopen the collection if it has not refreshed.', 'info'); } finally { setPending(false); }
  };
  return <Modal open={!!props.collection} onOpenChange={(open) => { if (!open && !pending()) props.onClose(); }} title={`New entry in ${props.collection?.label ?? ''}`}
    footer={<><button type="button" class="sam-btn" disabled={pending()} onClick={props.onClose}>Cancel</button>
      <button type="submit" form="new-entry-form" class="sam-btn primary" disabled={pending() || !title().trim() || !valid()}>{pending() ? 'Creating…' : 'Create entry'}</button></>}>
    <form id="new-entry-form" onSubmit={(event) => void create(event)}>
      <p class="text-xs text-gray-500 leading-5 mb-4">Give your entry a title. You can write the content on the next screen.</p>
      <Field label="Title" for="new-entry-title"><input autofocus id="new-entry-title" class={controlClass} value={title()} placeholder="e.g. Getting started" required onInput={(e) => setTitle(e.currentTarget.value)} /></Field>
      <Field label="URL name" for="new-entry-slug" info="Created from the title. You can change it using letters, numbers and hyphens." error={slug() && !valid() ? 'Use letters, numbers, hyphens or underscores.' : undefined}>
        <input id="new-entry-slug" class={controlClass} value={slug()} onInput={(e) => setCustomSlug(e.currentTarget.value)} required />
        <p class="ed-hint break-all">/{props.collection?.name === 'pages' ? '' : `${props.collection?.name ?? ''}/`}{slug() || 'your-entry'}/</p>
      </Field>
      <SettingInput setting={{ id: 'new-entry-draft', type: 'checkbox', label: 'Start as a draft', info: 'Drafts can be edited and previewed, but stay out of your built site.' }} value={draft()} onChange={setDraft} />
      <Show when={error()}><p class="text-xs text-red-600 mt-3" role="alert">{error()}</p></Show>
    </form>
  </Modal>;
}
