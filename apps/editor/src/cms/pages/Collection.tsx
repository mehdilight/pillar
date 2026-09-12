import { t, formatDate } from '../../i18n';
import { For, Show, createMemo, createResource, createSignal } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import Page from '../ui/Page';
import {
  Badge,
  Empty,
  Filters,
  Loading,
  Pager,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  buttonClass,
} from '../ui/ds';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { showToast } from '../../components/ui/Toast';
import { api } from '../../api/client';
import { collectionNamed, entryUrl, loadCollections } from '../../store/content';
import { refreshStatus } from '../../store/status';
import type { ContentItem } from '../../types';

const PER_PAGE = 20;

/** One collection's entries, as a table — bastet's pages list, for any collection. */
export default function Collection() {
  const params = useParams<{ collection: string }>();
  const [items, { refetch }] = createResource(() => params.collection, (name) => api.items(name));
  const [query, setQuery] = createSignal('');
  const [filter, setFilter] = createSignal<'all' | 'published' | 'drafts'>('all');
  const [page, setPage] = createSignal(1);
  const [deleting, setDeleting] = createSignal<ContentItem | null>(null);

  const collection = () => collectionNamed(params.collection);
  const label = () => collection()?.label ?? params.collection;

  const isDraft = (item: ContentItem) => Boolean(item.frontmatter?.draft);

  const matching = createMemo(() => {
    const term = query().trim().toLowerCase();

    return (items() ?? [])
      .filter((item) => (filter() === 'all' ? true : filter() === 'drafts' ? isDraft(item) : !isDraft(item)))
      .filter((item) => !term || item.title.toLowerCase().includes(term) || item.slug.toLowerCase().includes(term));
  });

  const pages = () => Math.max(1, Math.ceil(matching().length / PER_PAGE));
  const current = () => Math.min(page(), pages());
  const visible = () => matching().slice((current() - 1) * PER_PAGE, current() * PER_PAGE);

  const count = (key: 'all' | 'published' | 'drafts') =>
    (items() ?? []).filter((item) => (key === 'all' ? true : key === 'drafts' ? isDraft(item) : !isDraft(item))).length;

  const remove = async (item: ContentItem) => {
    try {
      await api.deleteItem(item.collection, item.slug);
      showToast(t("Deleted “{{v0}}”", { v0: item.title || item.slug }), 'success');
      await Promise.all([refetch(), loadCollections(), refreshStatus()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("Could not delete"), 'error');
    }
  };

  return (
    <Page
      title={label()}
      actions={
        <A href={`/content/${params.collection}/new`} class={buttonClass('primary', 'sm')}>
          {t("New entry")} </A>
      }
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Filters
          current={filter()}
          onChange={(key) => {
            setFilter(key as 'all' | 'published' | 'drafts');
            setPage(1);
          }}
          items={[
            { key: 'all', get label() { return t("All"); }, count: count('all') },
            { key: 'published', get label() { return t("Published"); }, count: count('published') },
            { key: 'drafts', get label() { return t("Drafts"); }, count: count('drafts') },
          ]}
        />
        <input
          type="search"
          class="mb-3.5 h-8 w-full max-w-[260px] rounded-ds border border-border-strong bg-surface px-2.5 text-[13px] text-text outline-none placeholder:text-text-faint focus:border-brand focus:ring-2 focus:ring-brand-tint"
          placeholder={t("Search {{v0}}", { v0: label().toLowerCase() })}
          value={query()}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setPage(1);
          }}
        />
      </div>

      <Show when={!items.loading} fallback={<Loading label={t("Loading {{v0}}…", { v0: label().toLowerCase() })} />}>
        <Show
          when={visible().length}
          fallback={
            <Empty
              title={query() || filter() !== 'all' ? t("Nothing matches.") : t("No {{v0}} yet.", { v0: label().toLowerCase() })}
              description={query() || filter() !== 'all' ? t("Try another search or filter.") : t("Each entry is a markdown file in your site.")}
              action={
                <A href={`/content/${params.collection}/new`} class={buttonClass('primary', 'sm')}>
                  {t("New entry")} </A>
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Title")}</TableHead>
                <TableHead>{t("URL")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead>{t("Date")}</TableHead>
                <TableHead>{t("Updated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={visible()}>
                {(item) => (
                  <TableRow>
                    <TableCell class="font-semibold">
                      <A href={`/content/${item.collection}/${item.slug}`} class="text-brand hover:underline">
                        {item.title || item.slug}
                      </A>
                      <div class="text-xs mt-1 font-normal">
                        <A href={`/content/${item.collection}/${item.slug}`} class="text-brand hover:underline">
                          {t("Edit")} </A>
                        <span class="text-text-faint mx-1">|</span>
                        <a href={`/preview${entryUrl(item.collection, item.slug)}`} target="_blank" rel="noopener" class="text-brand hover:underline">
                          {t("View")} </a>
                        <span class="text-text-faint mx-1">|</span>
                        <button type="button" class="text-danger hover:underline" onClick={() => setDeleting(item)}>
                          {t("Delete")} </button>
                      </div>
                    </TableCell>
                    <TableCell class="text-xs text-text-muted font-mono">{entryUrl(item.collection, item.slug)}</TableCell>
                    <TableCell>
                      <Badge variant={isDraft(item) ? 'default' : 'success'}>{isDraft(item) ? t("Draft") : t("Published")}</Badge>
                    </TableCell>
                    <TableCell class="text-xs text-text-muted">{String(item.frontmatter?.date ?? '—')}</TableCell>
                    <TableCell class="text-xs text-text-muted">
                      {item.updated_at ? formatDate(item.updated_at) : '—'}
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
          <Pager page={current()} pages={pages()} total={matching().length} onChange={setPage} />
        </Show>
      </Show>

      <ConfirmDialog
        open={deleting() !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        danger
        title={t("Delete entry")}
        message={t("“{{title}}” is removed from {{path}}. Until you publish, Discard on the Publish page brings it back; after that, only git history has it.", { title: deleting()?.title || deleting()?.slug, path: `content/${params.collection}/` })}
        confirmLabel={t("Delete")}
        onConfirm={() => {
          const item = deleting();

          if (item) void remove(item);
        }}
      />
    </Page>
  );
}
