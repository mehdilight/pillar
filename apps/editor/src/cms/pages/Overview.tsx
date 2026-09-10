import { For, Show, createResource, createSignal } from 'solid-js';
import { A } from '@solidjs/router';
import { Hammer } from '../../components/ui/Icons';
import Page from '../ui/Page';
import { Badge, Button, Grid, Loading, Postbox, SidebarLayout, Tile, buttonClass } from '../ui/ds';
import { showToast } from '../../components/ui/Toast';
import { api, editorConfig } from '../../api/client';
import { collections, entryUrl } from '../../store/content';
import { status } from '../../store/status';
import type { ContentItem } from '../../types';

/** Where to start: what the site has, what changed recently, and whether it is committed. */
export default function Overview() {
  const [recent] = createResource(collections, async (list) => {
    const all = (await Promise.all(list.map((collection) => api.items(collection.name)))).flat();

    return all
      .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))
      .slice(0, 8);
  });
  const [history] = createResource(() => api.history());
  const [building, setBuilding] = createSignal(false);

  const entries = () => (collections() ?? []).reduce((sum, collection) => sum + collection.count, 0);

  const build = async () => {
    setBuilding(true);

    try {
      const result = await api.build();

      showToast(`Built ${result.pages} pages in ${result.ms}ms`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Build failed', 'error');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Page
      title="Overview"
      actions={
        <>
          <Button onClick={build} disabled={building()}>
            <Hammer size={14} />
            {building() ? 'Building…' : 'Build site'}
          </Button>
          <A href="/editor" class={buttonClass('primary')}>
            Customize
          </A>
        </>
      }
    >
      <div class="mb-4">
        <Grid cols={4}>
          <Tile label="Entries" value={String(entries())} hint={`${collections()?.length ?? 0} collections`} />
          <Tile label="Uncommitted" value={String(status()?.count ?? 0)} hint={status()?.has_remote ? 'Publishing pushes' : 'No remote configured'} />
          <Tile label="Branch" value={<span class="font-mono text-xl">{status()?.branch ?? '—'}</span>} />
          <Tile label="Site" value={<span class="text-base">{editorConfig.siteName}</span>} />
        </Grid>
      </div>

      <SidebarLayout>
        <Postbox title="Recently edited" flush>
          <Show when={recent()} fallback={<Loading />}>
            <Show when={recent()!.length} fallback={<p class="p-4 text-xs text-text-faint">Nothing yet.</p>}>
              <ul>
                <For each={recent()}>{(item) => <RecentRow item={item} />}</For>
              </ul>
            </Show>
          </Show>
        </Postbox>

        <div>
          <Postbox title="Collections" flush>
            <ul>
              <For each={collections() ?? []}>
                {(collection) => (
                  <li class="border-b border-border last:border-0">
                    <A href={`/content/${collection.name}`} class="flex items-center justify-between px-4 py-2.5 hover:bg-surface-muted">
                      <span class="font-medium text-text">{collection.label}</span>
                      <span class="text-xs tabular-nums text-text-muted">{collection.count}</span>
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </Postbox>

          <Postbox title="Latest commits" flush actions={<A href="/publish" class="text-xs text-brand hover:underline">All</A>}>
            <Show when={history()?.length} fallback={<p class="p-4 text-xs text-text-faint">No commits yet.</p>}>
              <ul>
                <For each={history()!.slice(0, 5)}>
                  {(entry) => (
                    <li class="flex items-start gap-3 px-4 py-2.5 border-b border-border last:border-0">
                      <code class="font-mono text-[11px] text-text-faint mt-0.5">{entry.short}</code>
                      <span class="min-w-0 flex-1 truncate text-text-secondary">{entry.message}</span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Postbox>
        </div>
      </SidebarLayout>
    </Page>
  );
}

function RecentRow(props: { item: ContentItem }) {
  return (
    <li class="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
      <div class="min-w-0 flex-1">
        <A href={`/content/${props.item.collection}/${props.item.slug}`} class="font-semibold text-brand hover:underline">
          {props.item.title || props.item.slug}
        </A>
        <p class="text-xs font-mono text-text-faint truncate">{entryUrl(props.item.collection, props.item.slug)}</p>
      </div>
      <Show when={props.item.frontmatter?.draft}>
        <Badge>Draft</Badge>
      </Show>
      <span class="text-xs text-text-muted whitespace-nowrap">
        {props.item.updated_at ? new Date(props.item.updated_at).toLocaleDateString() : '—'}
      </span>
    </li>
  );
}
