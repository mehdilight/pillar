import { For, Show, createEffect, createResource, createSignal, on } from 'solid-js';
import { A } from '@solidjs/router';
import Page from '../ui/Page';
import { Badge, Button, Empty, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/ds';
import Modal from '../../components/ui/Modal';
import { showToast } from '../../components/ui/Toast';
import { api } from '../../api/client';
import { collections, loadCollections } from '../../store/content';
import { refreshStatus } from '../../store/status';
import type { ContentCollection } from '../../types';

/**
 * Content types: the collections a site has, and the fields each entry carries.
 *
 * A type is three files — `schemas/<name>.json`, `content/<name>/`, and
 * `templates/<singular>.json` — and this page writes exactly those, so a type
 * made here and one typed into an editor are the same thing.
 */
export default function Types() {
  const [editing, setEditing] = createSignal<ContentCollection | 'new' | null>(null);

  return (
    <Page title="Content types" actions={<Button variant="primary" size="sm" onClick={() => setEditing('new')}>New content type</Button>}>
      <Show
        when={collections()?.length}
        fallback={<Empty title="No content types yet." description="A content type is a folder of markdown with a form for its frontmatter." />}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead>Renders through</TableHead>
              <TableHead style={{ width: '90px' }}>Entries</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={collections()}>
              {(collection) => (
                <TableRow>
                  <TableCell class="font-semibold">
                    <A href={`/content/${collection.name}`} class="text-brand hover:underline">
                      {collection.label}
                    </A>
                    <div class="text-xs mt-1 font-normal">
                      <span class="font-mono text-text-faint">content/{collection.name}/</span>
                      <span class="text-text-faint mx-1">|</span>
                      <button type="button" class="text-brand hover:underline" onClick={() => setEditing(collection)}>
                        Edit fields
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Show when={collection.fields.length} fallback={<span class="text-xs text-text-faint">No schema — no form</span>}>
                      <div class="flex flex-wrap gap-1">
                        <For each={collection.fields}>
                          {(field) => (
                            <Badge>
                              {field.label || field.id}
                              <span class="ml-1 text-text-faint">{field.type}</span>
                            </Badge>
                          )}
                        </For>
                      </div>
                    </Show>
                  </TableCell>
                  <TableCell class="text-xs font-mono text-text-muted">templates/{collection.template ?? collection.name}.json</TableCell>
                  <TableCell class="text-xs tabular-nums text-text-muted">{collection.count}</TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </Show>

      <TypeModal subject={editing()} onClose={() => setEditing(null)} />
    </Page>
  );
}

/**
 * Create a type, or change one's label and fields.
 *
 * Fields come from the server's presets. A field the type already has that is
 * not a preset — one added by hand to the schema file — is kept as it is and
 * shown as such: this form must never quietly delete what it cannot edit.
 */
function TypeModal(props: { subject: ContentCollection | 'new' | null; onClose: () => void }) {
  const [presets] = createResource(api.fieldPresets);
  const [name, setName] = createSignal('');
  const [label, setLabel] = createSignal('');
  const [chosen, setChosen] = createSignal<string[]>([]);
  const [pending, setPending] = createSignal(false);

  const isNew = () => props.subject === 'new';
  const existing = () => (props.subject === 'new' || props.subject === null ? null : props.subject);
  const presetIds = () => (presets() ?? []).map((preset) => preset.key);
  const custom = () => (existing()?.fields ?? []).filter((field) => !presetIds().includes(field.id));

  createEffect(
    on([() => props.subject, presets], () => {
      const type = existing();

      setName(type?.name ?? '');
      setLabel(type?.label ?? '');
      setChosen(
        type
          ? type.fields.map((field) => field.id).filter((id) => presetIds().includes(id))
          : (presets() ?? []).filter((preset) => preset.default).map((preset) => preset.key)
      );
    })
  );

  const toggle = (key: string) => setChosen((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  const save = async () => {
    setPending(true);

    try {
      if (isNew()) {
        const created = await api.createCollection({ name: name().trim(), label: label().trim(), fields: chosen() });

        showToast(`Created ${created.name}`, 'success');
      } else {
        const type = existing()!;
        // Existing order first, newly ticked presets after. A field the type
        // already has travels back as its full definition, even when its id
        // is a preset's: Docs' `order` is labelled "Sidebar position", and
        // sending the bare key would reset it to the preset's "Position".
        const kept = type.fields
          .filter((field) => !presetIds().includes(field.id) || chosen().includes(field.id))
          .map((field) => field as unknown as Record<string, unknown>);
        const added = chosen().filter((key) => !type.fields.some((field) => field.id === key));

        await api.updateCollection(type.name, { label: label().trim() || type.label, fields: [...kept, ...added] });
        showToast(`Updated ${type.label}`, 'success');
      }

      await Promise.all([loadCollections(), refreshStatus()]);
      props.onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the content type', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={props.subject !== null}
      onOpenChange={(open) => !open && !pending() && props.onClose()}
      title={isNew() ? 'New content type' : `Edit ${existing()?.label ?? ''}`}
      footer={
        <>
          <Button onClick={props.onClose} disabled={pending()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={pending() || (isNew() && name().trim().length < 2)}>
            {pending() ? 'Saving…' : isNew() ? 'Create' : 'Save'}
          </Button>
        </>
      }
    >
      <div class="ds-root space-y-4 bg-transparent">
        <Show when={isNew()}>
          <div>
            <Label for="type-name">Name</Label>
            <Input id="type-name" value={name()} placeholder="guides" onInput={(event) => setName(event.currentTarget.value)} class="max-w-none" />
            <p class="mt-1.5 text-xs text-text-faint">Plural and lowercase — it becomes the folder and the URL.</p>
          </div>
        </Show>

        <div>
          <Label for="type-label">Label</Label>
          <Input id="type-label" value={label()} placeholder="Guides" onInput={(event) => setLabel(event.currentTarget.value)} class="max-w-none" />
        </div>

        <div>
          <p class="mb-2 text-xs font-medium text-text-secondary">Fields</p>
          <div class="grid grid-cols-2 gap-2">
            <For each={presets() ?? []}>
              {(preset) => (
                <label class="flex items-center gap-2 rounded-ds border border-border px-3 py-2 text-xs cursor-pointer hover:bg-surface-muted">
                  <input type="checkbox" class="size-4 rounded border-border-strong text-brand" checked={chosen().includes(preset.key)} onChange={() => toggle(preset.key)} />
                  <span class="font-medium text-text">{preset.label}</span>
                  <span class="ml-auto text-text-faint">{preset.type}</span>
                </label>
              )}
            </For>
          </div>
          <Show when={custom().length}>
            <p class="mt-3 text-xs text-text-muted">
              Kept as written in <code class="font-mono">schemas/{existing()?.name}.json</code>:{' '}
              {custom().map((field) => field.label || field.id).join(', ')}
            </p>
          </Show>
        </div>

        <Show when={isNew()}>
          <p class="text-xs text-text-faint">
            Creates <code class="font-mono">content/{name().trim() || 'name'}/</code>, <code class="font-mono">schemas/{name().trim() || 'name'}.json</code> and a template for its entries.
          </p>
        </Show>
      </div>
    </Modal>
  );
}
