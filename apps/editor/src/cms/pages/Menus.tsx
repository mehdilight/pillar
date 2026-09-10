import { For, Show, createEffect, createResource, createSignal } from 'solid-js';
import { A, useNavigate, useParams } from '@solidjs/router';
import { ChevronRight, GripVertical, Link2, Pencil, Plus, Trash2 } from 'lucide-solid';
import { DragDropProvider, DragDropSensors, SortableProvider, createSortable, transformStyle } from '@thisbeyond/solid-dnd';
import Page from '../ui/Page';
import { Button, Empty, Input, Label, Postbox } from '../ui/ds';
import LinkPicker from '../../components/ui/LinkPicker';
import { api } from '../../api/client';
import { showToast } from '../../components/ui/Toast';
import { refreshStatus } from '../../store/status';
import type { LinkLists, MenuItem } from '../../types';

const blankLink = (): MenuItem => ({ title: '', url: '' });
const emptyMenu = () => ({ title: '', items: [] as MenuItem[] });
const handleOf = (title: string) =>
  title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'menu';
const summary = (items: MenuItem[]) => items.map((item) => item.title.trim()).filter(Boolean).join(', ') || 'No links yet';
const sortableIds = new WeakMap<MenuItem, string>();
let nextSortableId = 0;
const sortableId = (item: MenuItem) => {
  let id = sortableIds.get(item);
  if (!id) {
    id = `menu-item-${nextSortableId++}`;
    sortableIds.set(item, id);
  }
  return id;
};

// Menu edits create new objects. Preserve the sortable key across those edits
// so Solid retains the row (including its expanded accordion state).
const retainSortableId = (previous: MenuItem, next: MenuItem) => {
  const id = sortableIds.get(previous);
  if (id) sortableIds.set(next, id);
  return next;
};

/** Navigation starts as a compact index, then opens one list for focused editing. */
export default function Menus() {
  const params = useParams<{ handle?: string }>();
  return params.handle ? <MenuEditor handle={params.handle} /> : <MenuIndex />;
}

function MenuIndex() {
  const [menus] = createResource(api.menus);
  const create = <A href="/menus/create" class="inline-flex h-8 items-center gap-1.5 rounded-ds border border-brand bg-brand px-3 text-xs font-medium text-white shadow-ds-sm transition-colors hover:border-brand-hover hover:bg-brand-hover"><Plus size={15} /> Create menu</A>;

  return (
    <Page title="Navigation" actions={create}>
      <p class="mb-5 max-w-2xl text-[13px] leading-5 text-text-muted">Link lists are reusable navigation for headers, footers, and sections. Open a menu to edit its links and order.</p>
      <Show when={!menus.loading} fallback={<p class="text-text-muted">Loading navigation…</p>}>
        <Show when={Object.keys(menus() ?? {}).length} fallback={<Empty title="No menus yet." description="Create a menu to add navigation to your theme." action={create} />}>
          <Postbox flush>
            <div class="grid grid-cols-[minmax(12rem,.9fr)_minmax(0,1fr)] border-b border-border bg-surface-muted/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.045em] text-text-faint"><span>Menu</span><span>Menu items</span></div>
            <For each={Object.entries(menus() ?? {})}>
              {([handle, menu]) => <A href={`/menus/${handle}`} class="grid grid-cols-[minmax(12rem,.9fr)_minmax(0,1fr)] items-center border-b border-border px-4 py-3.5 text-[13px] transition-colors last:border-b-0 hover:bg-brand-tint/35 focus:bg-brand-tint/35 focus:outline-none"><span class="min-w-0 font-medium text-text">{menu.title || handle}</span><span class="truncate text-text-muted">{summary(menu.items)}</span></A>}
            </For>
          </Postbox>
        </Show>
      </Show>
    </Page>
  );
}

function MenuEditor(props: { handle: string }) {
  const navigate = useNavigate();
  const [menus, { refetch }] = createResource(api.menus);
  const [draft, setDraft] = createSignal<LinkLists[string] | null>(null);
  const [loadedHandle, setLoadedHandle] = createSignal<string | null>(null);
  const [expandedItems, setExpandedItems] = createSignal<Record<string, true>>({});
  const creating = () => props.handle === 'create';
  const current = () => draft() ?? emptyMenu();
  const handle = () => creating() ? handleOf(current().title) : props.handle;

  createEffect(() => {
    const available = menus();
    if (!available || loadedHandle() === props.handle) return;
    setDraft(structuredClone(creating() ? emptyMenu() : available[props.handle] ?? emptyMenu()));
    setLoadedHandle(props.handle);
  });

  const update = (next: LinkLists[string]) => setDraft(next);
  const setItemExpanded = (id: string, expanded: boolean) => {
    setExpandedItems((current) => {
      const next = { ...current };
      if (expanded) next[id] = true;
      else delete next[id];
      return next;
    });
  };
  const save = async () => {
    const title = current().title.trim();
    if (!title) return showToast('Give this menu a name before saving.', 'error');
    const all = menus() ?? {};
    let target = handle();
    let suffix = 2;
    while (creating() && all[target]) target = `${handle()}-${suffix++}`;
    try {
      await api.saveMenus({ ...all, [target]: { ...current(), title } });
      await Promise.all([refetch(), refreshStatus()]);
      showToast('Menu saved', 'success');
      if (creating()) navigate(`/menus/${target}`, { replace: true });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save menu', 'error');
    }
  };
  const remove = async () => {
    if (creating() || !window.confirm(`Delete “${current().title || props.handle}”?`)) return;
    const all = { ...(menus() ?? {}) };
    delete all[props.handle];
    try {
      await api.saveMenus(all);
      await refreshStatus();
      showToast('Menu deleted', 'success');
      navigate('/menus');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete menu', 'error');
    }
  };

  return (
    <Page title={creating() ? 'Create menu' : current().title || props.handle} backTo="/menus" actions={<div class="flex items-center gap-2"><Show when={!creating()}><Button variant="link" class="text-danger" onClick={() => void remove()}>Delete</Button></Show><Button variant="primary" disabled={menus.loading} onClick={() => void save()}>Save changes</Button></div>}>
      <Show when={!menus.loading} fallback={<p class="text-text-muted">Loading menu…</p>}>
        <div class="max-w-4xl">
          <Postbox title="Menu details">
            <div class="max-w-2xl"><Label>Menu name</Label><Input autofocus placeholder="For example, Main menu" value={current().title} onInput={(event) => update({ ...current(), title: event.currentTarget.value })} /><p class="mt-2 text-xs text-text-muted">Handle: <code class="font-mono text-[11px] text-text-secondary">{handle()}</code><Show when={creating()}><span> · Created from the menu name when you save.</span></Show></p></div>
          </Postbox>
          <Postbox title="Menu items" flush actions={<Button size="sm" onClick={() => update({ ...current(), items: [...current().items, blankLink()] })}><Plus size={14} /> Add menu item</Button>}>
            <MenuRows items={current().items} onChange={(items) => update({ ...current(), items })} isExpanded={(id) => expandedItems()[id] === true} onExpandedChange={setItemExpanded} />
          </Postbox>
        </div>
      </Show>
    </Page>
  );
}

function MenuRows(props: { items: MenuItem[]; onChange: (items: MenuItem[]) => void; isExpanded: (id: string) => boolean; onExpandedChange: (id: string, expanded: boolean) => void; depth?: number }) {
  return (
    <DragDropProvider
      onDragEnd={({ draggable, droppable }) => {
        if (!droppable) return;
        const from = props.items.findIndex((item) => sortableId(item) === draggable.id);
        const to = props.items.findIndex((item) => sortableId(item) === droppable.id);
        if (from < 0 || to < 0 || from === to) return;
        const next = [...props.items];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        props.onChange(next);
      }}
    >
      <DragDropSensors>
        <SortableProvider ids={props.items.map(sortableId)}>
          <div class={props.depth ? 'bg-surface-muted/30' : ''}>
            <For each={props.items.map(sortableId)}>{(id) => {
              const item = () => props.items.find((current) => sortableId(current) === id)!;
              return <SortableMenuRow item={item()} id={id} onChange={(next) => props.onChange(props.items.map((current) => sortableId(current) === id ? retainSortableId(current, next) : current))} onRemove={() => props.onChange(props.items.filter((current) => sortableId(current) !== id))} isExpanded={props.isExpanded} onExpandedChange={props.onExpandedChange} depth={props.depth} />;
            }}</For>
            <Show when={props.items.length === 0}><div class="flex flex-col items-center px-5 py-10 text-center"><Link2 size={22} class="mb-2 text-text-faint" /><p class="text-[13px] font-medium text-text">This menu has no links.</p><p class="mt-1 text-xs text-text-muted">Add a destination for people to navigate to.</p></div></Show>
          </div>
        </SortableProvider>
      </DragDropSensors>
    </DragDropProvider>
  );
}

function SortableMenuRow(props: { item: MenuItem; id: string; onChange: (item: MenuItem) => void; onRemove: () => void; isExpanded: (id: string) => boolean; onExpandedChange: (id: string, expanded: boolean) => void; depth?: number }) {
  const sortable = createSortable(props.id);
  const [childrenOpen, setChildrenOpen] = createSignal(true);
  const editing = () => props.isExpanded(props.id);
  const addSublink = () => {
    const sublink = blankLink();
    // Allocate its key before rendering and explicitly start it collapsed.
    props.onExpandedChange(sortableId(sublink), false);
    props.onChange({ ...props.item, items: [...(props.item.items ?? []), sublink] });
    setChildrenOpen(true);
  };

  return (
    <div ref={sortable} style={transformStyle(sortable.transform)} class="border-b border-border transition-shadow last:border-b-0" classList={{ 'relative z-10 shadow-ds-md': sortable.isActiveDraggable }}>
      <div class="group flex min-h-13 items-center gap-2 px-4 py-2">
        <button type="button" {...sortable.dragActivators} class="cursor-grab touch-none text-text-faint hover:text-text active:cursor-grabbing" aria-label={`Reorder ${props.item.title || 'menu item'}`}><GripVertical size={17} /></button>
        <div class="min-w-0 flex-1 py-1"><span class="block truncate text-[13px] font-medium text-text">{props.item.title || 'Untitled link'}</span><Show when={props.item.url}><span class="mt-0.5 block truncate text-[11px] text-text-faint">{props.item.url}</span></Show></div>
        <Show when={(props.item.items ?? []).length}><span class="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">{props.item.items!.length} nested</span></Show>
        <button type="button" class="rounded p-1 text-text-faint transition hover:bg-surface-muted hover:text-text" title={editing() ? 'Close editor' : 'Edit link'} aria-label={`Edit ${props.item.title || 'Untitled link'}`} aria-expanded={editing()} onClick={() => props.onExpandedChange(props.id, !editing())}><Pencil size={15} /></button>
        <button type="button" class="rounded p-1 text-text-faint opacity-100 transition hover:bg-danger-tint hover:text-danger md:opacity-0 md:group-hover:opacity-100" title="Remove link" onClick={props.onRemove}><Trash2 size={15} /></button>
        <Show when={(props.item.items ?? []).length}>
          <button type="button" class="rounded p-1 text-text-faint hover:bg-surface-muted hover:text-text" aria-label={`Toggle sublinks for ${props.item.title || 'Untitled link'}`} aria-expanded={childrenOpen()} aria-controls={`${props.id}-children`} onClick={() => setChildrenOpen((open) => !open)}>
            <ChevronRight size={16} class={`transition-transform ${childrenOpen() ? 'rotate-90' : ''}`} />
          </button>
        </Show>
      </div>
      <Show when={editing()}>
        <div class="border-t border-border bg-surface-muted/35 px-4 py-4 sm:pl-12">
          <div class="grid max-w-2xl items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"><div><Label>Label</Label><Input value={props.item.title} placeholder="For example, About" onInput={(event) => props.onChange({ ...props.item, title: event.currentTarget.value })} /></div><div><Label>Link</Label><LinkPicker compact value={props.item.url} onValue={(url) => props.onChange({ ...props.item, url })} /></div></div>
          <div class="mt-4 flex min-h-7 items-center justify-between gap-4"><span class="inline-flex items-center gap-1.5 text-xs text-text-faint"><Link2 size={13} /> Choose a path or paste any URL.</span><button type="button" class="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-brand hover:underline" onClick={addSublink}><Plus size={13} class="shrink-0" /><span>Add sublink</span></button></div>
        </div>
      </Show>
      <Show when={(props.item.items ?? []).length}>
        <div id={`${props.id}-children`} hidden={!childrenOpen()} class="mx-4 mb-4 overflow-hidden rounded-ds border border-border border-s-2 border-s-brand/15 bg-surface sm:ml-12">
          <MenuRows items={props.item.items ?? []} depth={(props.depth ?? 0) + 1} onChange={(items) => props.onChange({ ...props.item, items })} isExpanded={props.isExpanded} onExpandedChange={props.onExpandedChange} />
        </div>
      </Show>
    </div>
  );
}
