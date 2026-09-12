import { t } from '../../i18n';
import { For, Show, createEffect, createResource, createSignal, on } from 'solid-js';
import { A } from '@solidjs/router';
import Page from '../ui/Page';
import { Badge, Button, Empty, Input, Label, Loading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/ds';
import Drawer from '../../components/ui/Drawer';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconChooser } from '../../components/fields/IconPicker';
import { NamedIcon, Plus } from '../../components/ui/Icons';
import { showToast } from '../../components/ui/Toast';
import FieldList from '../fields/FieldList';
import { api } from '../../api/client';
import { collections, loadCollections } from '../../store/content';
import { refreshStatus } from '../../store/status';
import { FIELD_TYPES, cleanField } from '../../lib/fieldTypes';
import type { ContentCollection, SchemaSetting } from '../../types';

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
    <Page title={t("Content types")} actions={<Button variant="primary" size="sm" onClick={() => setEditing('new')}>{t("New content type")}</Button>}>
      <Show when={collections() !== null} fallback={<Loading variant="table" rows={4} />}>
        <Show
          when={collections()?.length}
          fallback={<Empty title={t("No content types yet.")} description={t("A content type is a folder of markdown with a form for its frontmatter.")} />}
        >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Type")}</TableHead>
              <TableHead>{t("Fields")}</TableHead>
              <TableHead>{t("Renders through")}</TableHead>
              <TableHead style={{ width: '90px' }}>{t("Entries")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <For each={collections()}>
              {(collection) => (
                <TableRow>
                  <TableCell class="font-semibold">
                    <div class="flex items-start gap-2.5">
                      <span class="mt-0.5 text-text-muted">
                        <NamedIcon name={collection.icon} size={16} />
                      </span>
                      <div>
                        <A href={`/content/${collection.name}`} class="text-brand hover:underline">
                          {collection.label}
                        </A>
                        <div class="mt-1 text-xs font-normal">
                          <span class="font-mono text-text-faint">content/{collection.name}/</span>
                          <span class="mx-1 text-text-faint">|</span>
                          <button type="button" class="text-brand hover:underline" onClick={() => setEditing(collection)}>
                            {t("Edit fields")} </button>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Show when={collection.fields.length} fallback={<span class="text-xs text-text-faint">{t("No schema — no form")}</span>}>
                      <div class="flex flex-wrap gap-1">
                        <For each={collection.fields}>
                          {(field) => (
                            <Badge>
                              {field.label || field.content || field.id}
                              <span class="ml-1 text-text-faint">{FIELD_TYPES[field.type]?.label ?? field.type}</span>
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
      </Show>

      <TypeDrawer subject={editing()} onClose={() => setEditing(null)} />
    </Page>
  );
}

type Preset = { key: string; default: boolean } & SchemaSetting;

const presetField = ({ key: _key, default: _default, ...field }: Preset): SchemaSetting => field;

/**
 * Create a type, or change its label, icon and fields — in a drawer, with
 * each field configured in a drawer of its own over it.
 */
function TypeDrawer(props: { subject: ContentCollection | 'new' | null; onClose: () => void }) {
  const [presets] = createResource(async () => (await api.fieldPresets()) as Preset[]);
  const [name, setName] = createSignal('');
  const [label, setLabel] = createSignal('');
  const [icon, setIcon] = createSignal('');
  const [fields, setFields] = createSignal<SchemaSetting[]>([]);
  const [baseline, setBaseline] = createSignal('');
  const [pending, setPending] = createSignal(false);
  const [discarding, setDiscarding] = createSignal(false);

  const isNew = () => props.subject === 'new';
  const existing = () => (props.subject === 'new' || props.subject === null ? null : props.subject);
  const snapshot = () => JSON.stringify([name(), label(), icon(), fields()]);
  const dirty = () => props.subject !== null && snapshot() !== baseline();

  createEffect(
    on([() => props.subject, presets], () => {
      const type = existing();

      setName(type?.name ?? '');
      setLabel(type?.label ?? '');
      setIcon(type?.icon ?? (isNew() ? 'file-text' : ''));
      setFields(type ? structuredClone(type.fields) : (presets() ?? []).filter((preset) => preset.default).map(presetField));
      setBaseline(snapshot());
    })
  );

  // Presets not yet in the type, one click each.
  const suggestions = () => (presets() ?? []).filter((preset) => !fields().some((field) => field.id === preset.id));

  const close = () => {
    if (pending()) return;
    dirty() ? setDiscarding(true) : props.onClose();
  };

  const save = async () => {
    setPending(true);

    const definitions = fields().map(cleanField);

    try {
      if (isNew()) {
        const created = await api.createCollection({ name: name().trim(), label: label().trim(), fields: definitions, icon: icon() || undefined });

        showToast(t("Created {{v0}}", { v0: created.name }), 'success');
      } else {
        const type = existing()!;

        await api.updateCollection(type.name, { label: label().trim() || type.label, fields: definitions, icon: icon() || undefined });
        showToast(t("Updated {{v0}}", { v0: type.label }), 'success');
      }

      await Promise.all([loadCollections(), refreshStatus()]);
      props.onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not save the content type"), 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Drawer
        open={props.subject !== null}
        onClose={close}
        width={720}
        title={isNew() ? t("New content type") : existing()?.label ?? ''}
        subtitle={isNew() ? t("A folder of markdown, and the form for its entries") : <span class="font-mono">schemas/{existing()?.name}.json</span>}
        footer={
          <>
            <Show when={dirty()}>
              <span class="mr-auto text-xs text-text-muted">{t("Unsaved changes")}</span>
            </Show>
            <Button onClick={close} disabled={pending()}>
              {t("Cancel")} </Button>
            <Button variant="primary" onClick={save} disabled={pending() || (isNew() && name().trim().length < 2)}>
              {pending() ? t("Saving…") : isNew() ? t("Create content type") : t("Save")}
            </Button>
          </>
        }
      >
        <div class="space-y-6">
          <section class="grid gap-4 sm:grid-cols-[1fr_1fr_200px]">
            <Show when={isNew()}>
              <div>
                <Label for="type-name">{t("Name")}</Label>
                <Input id="type-name" autofocus value={name()} placeholder={t("guides")} onInput={(event) => setName(event.currentTarget.value)} class="max-w-none font-mono text-xs" />
                <p class="mt-1 text-[11.5px] text-text-faint">{t("Plural and lowercase — the folder and the URL.")}</p>
              </div>
            </Show>
            <div classList={{ 'sm:col-span-2': !isNew() }}>
              <Label for="type-label">{t("Label")}</Label>
              <Input id="type-label" value={label()} placeholder={t("Guides")} onInput={(event) => setLabel(event.currentTarget.value)} class="max-w-none" />
            </div>
            <div>
              <Label for="type-icon">{t("Icon")}</Label>
              <IconChooser id="type-icon" cms value={icon()} onValue={setIcon} />
            </div>
          </section>

          <section>
            <div class="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 class="text-[11.5px] font-semibold uppercase tracking-[.05em] text-text-muted">{t("Fields")}</h3>
                <p class="mt-0.5 text-xs text-text-faint">{t("The form every entry gets. Drag to reorder; click one to configure it.")}</p>
              </div>
              <span class="text-xs tabular-nums text-text-faint">{fields().length}</span>
            </div>

            <FieldList fields={fields()} onChange={setFields} empty={t("No fields yet — entries will only have a body.")} />

            <Show when={suggestions().length}>
              <div class="mt-4 flex flex-wrap items-center gap-1.5">
                <span class="mr-1 text-xs text-text-faint">{t("Quick add")}</span>
                <For each={suggestions()}>
                  {(preset) => (
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 py-1 text-xs text-text-secondary hover:border-brand hover:text-brand"
                      onClick={() => setFields([...fields(), presetField(preset)])}
                    >
                      <Plus size={11} />
                      {t(preset.label)}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <Show when={isNew()}>
            <p class="text-xs text-text-faint">
              {t("Creates")} <code class="font-mono">content/{name().trim() || 'name'}/</code>, <code class="font-mono">schemas/{name().trim() || 'name'}.json</code> {t("and a template for its entries.")} </p>
          </Show>
        </div>
      </Drawer>

      <ConfirmDialog
        open={discarding()}
        onOpenChange={setDiscarding}
        danger
        title={t("Discard changes?")}
        message={t("Your changes to this content type have not been saved.")}
        confirmLabel={t("Discard")}
        onConfirm={() => {
          setDiscarding(false);
          props.onClose();
        }}
      />
    </>
  );
}
