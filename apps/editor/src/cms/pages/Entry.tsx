import { For, Show, createEffect, createMemo, createResource, createSignal, on, onCleanup, onMount } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { A, useBeforeLeave, useNavigate, useParams, type BeforeLeaveEventArgs } from '@solidjs/router';
import { ExternalLink } from '../../components/ui/Icons';
import Page from '../ui/Page';
import { Button, Input, Label, Loading, Notice, Postbox, SidebarLayout, buttonClass } from '../ui/ds';
import RichEditor from '../../components/ui/LazyRichEditor';
import FormFields, { FieldErrors } from '../../components/fields/FormFields';
import { CurrentEntry } from '../../components/fields/RelationshipInput';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { api } from '../../api/client';
import { collectionNamed, entryUrl, loadCollections } from '../../store/content';
import { refreshStatus } from '../../store/status';
import { slotsFor } from '../../plugins/host';
import { violations } from '../../lib/fieldRules';
import type { ContentItem } from '../../types';

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Fields the page draws itself, so the details box does not repeat them. */
const OWN_FIELDS = ['title', 'draft'];

/**
 * One entry: a markdown file's frontmatter and body.
 *
 * bastet's page form, for any collection — the title large, the body in a box,
 * and everything else in the right column: publishing, the URL, the fields the
 * collection's schema declares, and whatever panels the site's plugins add.
 */
export default function Entry() {
  const params = useParams<{ collection: string; slug?: string }>();
  const navigate = useNavigate();
  const isNew = () => params.slug === undefined;

  const [existing] = createResource(
    () => (isNew() ? null : `${params.collection}/${params.slug}`),
    async () => (await api.items(params.collection)).find((item) => item.slug === params.slug) ?? null
  );

  const [title, setTitle] = createSignal('');
  const [customSlug, setCustomSlug] = createSignal<string | null>(null);
  const [frontmatter, setFrontmatter] = createSignal<Record<string, any>>({});
  const [body, setBody] = createSignal('');
  const [saved, setSaved] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [leaving, setLeaving] = createSignal<BeforeLeaveEventArgs | null>(null);
  // Shown under their fields once a save has been tried — not while typing a new entry.
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  const collection = () => collectionNamed(params.collection);
  const fields = () => (collection()?.fields ?? []).filter((field) => !OWN_FIELDS.includes(field.id));
  const slug = createMemo(() => (isNew() ? customSlug() ?? slugify(title()) : params.slug ?? ''));
  // `new` is the create route's own segment — an entry by that name could
  // never be opened, since /content/posts/new would always mean "create".
  const validSlug = () => /^[a-z0-9][a-z0-9_-]*$/.test(slug()) && (!isNew() || slug() !== 'new');
  const draft = () => Boolean(frontmatter().draft);

  const snapshot = () => JSON.stringify({ title: title(), frontmatter: frontmatter(), body: body() });
  const dirty = () => snapshot() !== saved();

  // A new entry starts from the schema's defaults, as a draft; an existing one
  // from its file. Either way the loaded state is the "saved" baseline.
  //
  // The collection is tracked only for arriving — through a memo, since `on`
  // re-runs whenever a source notifies, equal value or not. A save refreshes
  // the collection list, and re-running this on that would put the file as it
  // was when the page opened back into the form, over what was just saved.
  const hasCollection = createMemo(() => collection() !== null);

  createEffect(
    on([() => params.collection, () => params.slug, existing, hasCollection], () => {
      if (isNew()) {
        const defaults = Object.fromEntries(
          (collection()?.fields ?? []).filter((field) => field.default !== undefined).map((field) => [field.id, field.default])
        );

        setTitle('');
        setCustomSlug(null);
        setFrontmatter({ ...defaults, draft: true });
        setBody('');
      } else {
        const item = existing();

        if (!item) return;

        setTitle(String(item.frontmatter?.title ?? item.title ?? ''));
        setFrontmatter({ ...item.frontmatter });
        setBody(item.body);
      }

      setSaved(snapshot());
      setErrors({});
    })
  );

  const problems = () => violations(fields(), frontmatter());

  // Fixing a field clears its message as soon as it is fixed.
  createEffect(
    on(problems, (current) => {
      if (Object.keys(errors()).length) setErrors(Object.fromEntries(current.map((problem) => [problem.path, problem.message])));
    }, { defer: true })
  );

  const save = async () => {
    if (saving() || !title().trim() || !validSlug()) return;

    // The fields' rules — required, limits, email addresses — hold once an
    // entry is published. A draft saves half-written, told what is left.
    const found = problems();

    setErrors(Object.fromEntries(found.map((problem) => [problem.path, problem.message])));

    if (found.length && !draft()) {
      showToast(`Fix ${found.length === 1 ? 'one field' : `${found.length} fields`} before publishing — or save it as a draft.`, 'error');
      document.querySelector(`[data-field="${CSS.escape(found[0].path)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      return;
    }

    setSaving(true);

    const item: ContentItem = {
      collection: params.collection,
      slug: slug(),
      title: title().trim(),
      frontmatter: { ...frontmatter(), title: title().trim() },
      body: body(),
    };

    try {
      // A new entry is created exclusively — the server refuses to overwrite
      // an existing file, so two entries can never collide on a URL.
      isNew() ? await api.createItem(item) : await api.saveItem(item);

      setSaved(snapshot());
      showToast(
        found.length ? `Saved as a draft — ${found.length === 1 ? 'one field needs' : `${found.length} fields need`} attention before publishing` : isNew() ? 'Entry created' : 'Saved',
        'success'
      );
      void refreshStatus();
      void loadCollections();

      if (isNew()) navigate(`/content/${params.collection}/${item.slug}`, { replace: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteItem(params.collection, slug());
      setSaved(snapshot());
      showToast('Entry deleted', 'success');
      void refreshStatus();
      void loadCollections();
      navigate(`/content/${params.collection}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete', 'error');
    }
  };

  // Leaving with unsaved changes asks first — within the dashboard through the
  // router, and for a closed tab through the browser's own prompt.
  useBeforeLeave((event) => {
    if (dirty() && !event.defaultPrevented) {
      event.preventDefault();
      setLeaving(event);
    }
  });

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      if (dirty()) event.preventDefault();
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    });
  });

  const saveLabel = () => (saving() ? 'Saving…' : isNew() ? 'Create entry' : 'Save');

  return (
    <Page
      title={isNew() ? `New ${collection()?.label ?? params.collection} entry` : title() || params.slug}
      backTo={`/content/${params.collection}`}
      actions={
        <>
          <Show when={dirty()}>
            <span class="text-xs text-text-muted">Unsaved changes</span>
          </Show>
          <Button variant="primary" size="sm" onClick={save} disabled={saving() || !title().trim() || !validSlug()}>
            {saveLabel()}
          </Button>
        </>
      }
    >
      <Show when={isNew() || existing() !== undefined} fallback={<Loading label="Loading the entry…" />}>
        <Show
          when={isNew() || existing()}
          fallback={
            <Notice type="error">
              There is no {params.slug} in {params.collection}. <A href={`/content/${params.collection}`} class="underline">Back to the list</A>
            </Notice>
          }
        >
          <CurrentEntry.Provider
            value={{
              get collection() {
                return params.collection;
              },
              get slug() {
                return slug();
              },
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <SidebarLayout variant="form">
                <div class="min-w-0 space-y-4">
                  <div>
                    <label for="entry-title" class="sr-only">
                      Title
                    </label>
                    <Input
                      id="entry-title"
                      placeholder="Title"
                      class="h-[42px] max-w-none text-base font-medium"
                      value={title()}
                      onInput={(event) => setTitle(event.currentTarget.value)}
                    />
                  </div>

                  <Postbox title="Content" flush>
                    <div class="p-3">
                      <RichEditor value={body()} onValue={setBody} minHeight={420} placeholder="Start writing…" />
                    </div>
                  </Postbox>

                  {/*
                    The collection's fields, in schema order, beside the content they
                    describe — short ones two to a row, repeaters, tables and long text
                    across the full width. The sidebar keeps what is about the file rather
                    than in it: publishing, the URL, plugin panels.
                  */}
                  <Show when={fields().length}>
                    <Postbox title="Details">
                      <FieldErrors.Provider value={errors}>
                        <FormFields grid fields={fields()} values={frontmatter()} onChange={(id, value) => setFrontmatter({ ...frontmatter(), [id]: value })} />
                      </FieldErrors.Provider>
                    </Postbox>
                  </Show>
                </div>

                <div>
                  <Postbox title="Publish">
                    <label class="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        class="size-4 rounded border-border-strong text-brand focus:ring-brand"
                        checked={!draft()}
                        onChange={(event) => setFrontmatter({ ...frontmatter(), draft: !event.currentTarget.checked })}
                      />
                      Published — included when the site is built
                    </label>
                    <p class="mt-2 text-[11.5px] text-text-faint">
                      Saving writes the file. Changes go live when you publish them.
                    </p>
                    <div class="mt-4 flex flex-wrap gap-2">
                      <Button variant="primary" type="submit" disabled={saving() || !title().trim() || !validSlug()}>
                        {saveLabel()}
                      </Button>
                      <Show when={!isNew()}>
                        <a href={`/preview${entryUrl(params.collection, slug())}`} target="_blank" rel="noopener" class={buttonClass()}>
                          <ExternalLink size={13} />
                          Preview
                        </a>
                      </Show>
                    </div>
                    <Show when={!isNew()}>
                      <button type="button" class="mt-3 text-xs text-danger hover:underline" onClick={() => setDeleting(true)}>
                        Delete this entry
                      </button>
                    </Show>
                  </Postbox>

                  <Postbox title="URL">
                    <Label for="entry-slug">URL name</Label>
                    <Input
                      id="entry-slug"
                      value={slug()}
                      disabled={!isNew()}
                      onInput={(event) => setCustomSlug(event.currentTarget.value)}
                      class="max-w-none font-mono text-xs"
                    />
                    <Show when={slug() && !validSlug()}>
                      <p class="mt-1 text-xs text-danger">Letters, numbers, hyphens or underscores.</p>
                    </Show>
                    <p class="mt-1.5 text-xs text-text-faint break-all">{entryUrl(params.collection, slug() || 'your-entry')}</p>
                    <Show when={!isNew()}>
                      <p class="mt-1 text-[11.5px] text-text-faint">The URL is the file's name, so it is fixed once created.</p>
                    </Show>
                  </Postbox>


                  {/* Plugin panels — whatever the site's enabled plugins registered. */}
                  <For each={slotsFor('content.item.sidebar')}>
                    {(panel) => (
                      <section data-pillar-plugin={panel.plugin} class="mb-4 min-w-0 rounded-ds border border-border bg-surface shadow-ds-sm">
                        <Dynamic
                          component={panel.component}
                          collection={params.collection}
                          slug={slug()}
                          frontmatter={frontmatter()}
                          body={body()}
                          setFrontmatter={setFrontmatter}
                        />
                      </section>
                    )}
                  </For>
                </div>
              </SidebarLayout>
            </form>
          </CurrentEntry.Provider>
        </Show>
      </Show>

      <ConfirmDialog
        open={deleting()}
        onOpenChange={setDeleting}
        danger
        title="Delete entry"
        message={`This removes content/${params.collection}/${slug()}.md. Until you publish, Discard on the Publish page brings it back.`}
        confirmLabel="Delete"
        onConfirm={() => void remove()}
      />

      <ConfirmDialog
        open={leaving() !== null}
        onOpenChange={(open) => !open && setLeaving(null)}
        danger
        title="Leave without saving?"
        message="Your changes to this entry have not been saved."
        confirmLabel="Leave"
        onConfirm={() => {
          const event = leaving();

          setLeaving(null);
          event?.retry(true);
        }}
      />
    </Page>
  );
}
