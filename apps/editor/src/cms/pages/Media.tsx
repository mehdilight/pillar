import { t, formatDate } from '../../i18n';
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { Copy, ExternalLink, ImagePlus, Trash2, Upload } from '../../components/ui/Icons';
import Page from '../ui/Page';
import { Badge, Button, Filters, Label, Loading, Notice, Pager, Postbox, SidebarLayout } from '../ui/ds';
import AltField from '../../components/AltField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import CustomSelect from '../../components/ui/CustomSelect';
import { showToast } from '../../components/ui/Toast';
import { ACCEPTED, bytes, createMediaLibrary, extension, mediaUrl, plural } from '../../lib/media';

const PER_PAGE = 24;

type Filter = 'all' | 'site' | 'theme' | 'unused' | 'no-alt';
type Sort = 'newest' | 'name' | 'size';

const control =
  'h-8 rounded-ds border border-border-strong bg-surface px-2.5 text-[13px] text-text outline-none placeholder:text-text-faint focus:border-brand focus:ring-2 focus:ring-brand-tint';

/** Transparent images read as images, not as white boxes. */
const checkerboard =
  'bg-surface-muted bg-[length:16px_16px] bg-[position:0_0,8px_8px] bg-[image:linear-gradient(45deg,#eceef0_25%,transparent_25%,transparent_75%,#eceef0_75%),linear-gradient(45deg,#eceef0_25%,transparent_25%,transparent_75%,#eceef0_75%)]';

/** `content/posts/hello.md` is an entry the dashboard can open; other files are only named. */
const entryLink = (file: string) => {
  const match = /^content\/([^/]+)\/([^/]+)\.md$/.exec(file);

  return match ? `/content/${match[1]}/${match[2]}` : null;
};

const added = (seconds: number) =>
  formatDate(seconds * 1000, { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Every image the site has. Uploads land in `assets/uploads/`, versioned like
 * any other file; theme and addon images are listed too, read-only.
 */
export default function Media() {
  const library = createMediaLibrary();
  const [filter, setFilter] = createSignal<Filter>('all');
  const [sort, setSort] = createSignal<Sort>('newest');
  const [query, setQuery] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [selectedUrl, setSelectedUrl] = createSignal<string | null>(null);
  const [confirming, setConfirming] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);

  let uploadInput!: HTMLInputElement;

  const selected = () => library.all().find((image) => image.url === selectedUrl());

  const counts = createMemo(() => {
    const all = library.all();

    return {
      all: all.length,
      site: all.filter((image) => !image.readonly).length,
      theme: all.filter((image) => image.readonly).length,
      unused: all.filter((image) => image.used_in.length === 0).length,
      noAlt: all.filter((image) => !image.alt).length,
    };
  });

  const matching = createMemo(() => {
    const term = query().trim().toLowerCase();
    const kept = library.all().filter((image) => {
      if (filter() === 'site' && image.readonly) return false;
      if (filter() === 'theme' && !image.readonly) return false;
      if (filter() === 'unused' && image.used_in.length) return false;
      if (filter() === 'no-alt' && image.alt) return false;

      return !term || image.name.toLowerCase().includes(term) || image.alt.toLowerCase().includes(term);
    });

    return [...kept].sort((a, b) =>
      sort() === 'name' ? a.name.localeCompare(b.name) : sort() === 'size' ? b.size - a.size : b.modified - a.modified
    );
  });

  const pages = () => Math.max(1, Math.ceil(matching().length / PER_PAGE));
  const current = () => Math.min(page(), pages());
  const visible = () => matching().slice((current() - 1) * PER_PAGE, current() * PER_PAGE);
  const totalSize = () => library.all().reduce((sum, image) => sum + image.size, 0);

  // A filter that hides the selected image closes its details.
  createEffect(() => {
    if (selectedUrl() && !matching().some((image) => image.url === selectedUrl())) setSelectedUrl(null);
  });

  const upload = async (files: File[]) => {
    const uploaded = await library.upload(files);

    uploadInput.value = '';

    if (uploaded.length) {
      setFilter('all');
      setSort('newest');
      setQuery('');
      setPage(1);
      setSelectedUrl(uploaded[uploaded.length - 1].url);
    }
  };

  const remove = async () => {
    const image = selected();

    if (!image) return;

    setDeleting(true);

    if (await library.remove(image)) setSelectedUrl(null);

    setDeleting(false);
  };

  const copy = (text: string, what: string) =>
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(t("{{what}} copied", { what }), 'success'))
      .catch(() => library.setError(t("Could not copy. Select the {{v0}} and copy it yourself.", { v0: what.toLowerCase() })));

  // Files dropped anywhere on the page, or pasted, are uploaded. The counter
  // absorbs the enter/leave pairs every child element fires while dragging.
  onMount(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (event: DragEvent) => hasFiles(event) && event.preventDefault();
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      void upload(Array.from(event.dataTransfer?.files ?? []));
    };
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);

      if (files.length) void upload(files);
    };

    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    onCleanup(() => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    });
  });

  const deleteMessage = () => {
    const uses = selected()?.used_in ?? [];

    return uses.length
      ? t("This image is used in {{v0}} ({{v1}}). They will show a broken image until you choose another. If it was already published, Discard on the Publish page brings it back.", { v0: plural(uses.length, 'file'), v1: uses.join(', ') })
      : t("Nothing on the site uses this image. If it was already published, Discard on the Publish page brings it back.");
  };

  return (
    <Page
      title={t("Media")}
      actions={
        <Button variant="primary" size="sm" disabled={Boolean(library.progress())} onClick={() => uploadInput.click()}>
          <Upload size={13} />
          {library.progress() || t("Upload images")}
        </Button>
      }
    >
      <input
        ref={uploadInput}
        type="file"
        multiple
        accept={ACCEPTED}
        class="hidden"
        aria-label={t("Upload images")}
        onChange={(event) => void upload(Array.from(event.currentTarget.files ?? []))}
      />

      <Show when={library.error()}>
        <Notice type="error">
          <span class="whitespace-pre-wrap">{library.error()}</span>
        </Notice>
      </Show>

      <div class="flex flex-wrap items-start justify-between gap-x-3">
        <Filters
          current={filter()}
          onChange={(key) => {
            setFilter(key as Filter);
            setPage(1);
          }}
          items={[
            { key: 'all', get label() { return t("All"); }, count: counts().all },
            { key: 'site', get label() { return t("Uploads"); }, count: counts().site },
            ...(counts().theme ? [{ key: 'theme', get label() { return t("Theme"); }, count: counts().theme }] : []),
            { key: 'unused', get label() { return t("Unused"); }, count: counts().unused },
            { key: 'no-alt', get label() { return t("No alt text"); }, count: counts().noAlt },
          ]}
        />
        <div class="mb-3.5 flex w-full flex-wrap gap-2 sm:w-auto">
          <input
            type="search"
            aria-label={t("Search images")}
            class={`${control} min-w-0 flex-1 sm:w-[220px]`}
            placeholder={t("Search images")}
            value={query()}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setPage(1);
            }}
          />
          <div class="w-36">
            <CustomSelect<Sort>
              aria-label={t("Sort images")}
              value={sort()}
              onChange={(val) => setSort(val)}
              options={[
                { value: 'newest', label: t("Newest first") },
                { value: 'name', label: t("Name") },
                { value: 'size', label: t("Largest first") },
              ]}
            />
          </div>
        </div>
      </div>

      <SidebarLayout variant="form">
        <div class="min-w-0">
          <Show when={!library.images.loading} fallback={<Loading label={t("Loading images…")} />}>
            <Show when={library.images.error}>
              <Notice type="error">
                {t("Could not load the images.")}{' '}
                <button type="button" class="underline" onClick={() => void library.refetch()}>
                  {t("Try again")} </button>
              </Notice>
            </Show>

            <Show
              when={visible().length}
              fallback={
                <Show when={!library.images.error}>
                  <Show
                    when={library.all().length}
                    fallback={
                      <button
                        type="button"
                        class="flex w-full flex-col items-center gap-2 rounded-ds border-2 border-dashed border-border-strong bg-surface px-6 py-16 text-center transition-colors hover:border-brand hover:bg-brand-tint/40"
                        onClick={() => uploadInput.click()}
                      >
                        <ImagePlus size={28} class="text-text-faint" />
                        <span class="text-sm font-medium text-text">{t("Add your first image")}</span>
                        <span class="text-xs text-text-faint">{t("Drop images here, paste one, or click to choose. PNG, JPG, GIF, WebP or AVIF, up to 10 MB.")}</span>
                      </button>
                    }
                  >
                    <div class="rounded-ds border border-border bg-surface p-12 text-center">
                      <p class="text-sm font-medium text-text">{t("No images match.")}</p>
                      <p class="mt-1 text-xs text-text-faint">{t("Try another search or filter.")}</p>
                    </div>
                  </Show>
                </Show>
              }
            >
              <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                <For each={visible()}>
                  {(image) => (
                    <li>
                      <button
                        type="button"
                        class="group block w-full overflow-hidden rounded-ds border bg-surface text-left shadow-ds-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        classList={{
                          'border-brand ring-2 ring-brand/30': selectedUrl() === image.url,
                          'border-border hover:border-border-strong hover:shadow-ds-md': selectedUrl() !== image.url,
                        }}
                        aria-pressed={selectedUrl() === image.url}
                        onClick={() => setSelectedUrl(selectedUrl() === image.url ? null : image.url)}
                      >
                        <div class={`relative aspect-[4/3] border-b border-border ${checkerboard}`}>
                          <img src={mediaUrl(image.url)} alt={image.alt} loading="lazy" class="absolute inset-0 size-full object-contain p-2" />
                          <Show when={image.readonly}>
                            <span class="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{t("Theme")}</span>
                          </Show>
                        </div>
                        <div class="px-2.5 py-2">
                          <p class="truncate text-xs font-medium text-text" title={image.name}>
                            {image.name}
                          </p>
                          <p class="mt-0.5 flex items-center gap-1 text-[11px] text-text-faint">
                            <span>{extension(image)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{bytes(image.size)}</span>
                            <Show when={image.used_in.length === 0}>
                              <span aria-hidden="true">·</span>
                              <span>{t("Unused")}</span>
                            </Show>
                            <Show when={!image.alt}>
                              <span aria-hidden="true">·</span>
                              <span class="text-warning">{t("No alt")}</span>
                            </Show>
                          </p>
                        </div>
                      </button>
                    </li>
                  )}
                </For>
              </ul>

              <Pager page={current()} pages={pages()} total={matching().length} onChange={setPage} />
            </Show>
          </Show>
        </div>

        <div class="lg:sticky lg:top-4 lg:self-start">
          <Show
            when={selected()}
            keyed
            fallback={
              <Postbox title={t("Library")}>
                <dl class="grid grid-cols-2 gap-3">
                  <div>
                    <dt class="text-[11.5px] text-text-faint">{t("Images")}</dt>
                    <dd class="mt-0.5 text-lg text-text">{counts().all}</dd>
                  </div>
                  <div>
                    <dt class="text-[11.5px] text-text-faint">{t("Total size")}</dt>
                    <dd class="mt-0.5 text-lg text-text">{bytes(totalSize())}</dd>
                  </div>
                </dl>
                <Show when={counts().noAlt}>
                  <button
                    type="button"
                    class="mt-3 w-full rounded-ds bg-warning-tint px-3 py-2 text-left text-xs text-warning hover:underline"
                    onClick={() => {
                      setFilter('no-alt');
                      setPage(1);
                    }}
                  >
                    {plural(counts().noAlt, 'image')} {t("without alt text")} </button>
                </Show>
                <p class="mt-3 text-[11.5px] leading-relaxed text-text-faint">
                  {t("Select an image to see where it is used. Uploads are saved to")} <code class="font-mono">assets/uploads/</code> {t("and published with the rest of the site.")} </p>
                <p class="mt-2 text-[11.5px] leading-relaxed text-text-faint">{t("Drop images anywhere on this page, or paste one, to upload.")}</p>
              </Postbox>
            }
          >
            {(image) => (
              <Postbox
                title={t("Details")}
                actions={
                  <button type="button" class="text-xs text-text-muted hover:text-text" onClick={() => setSelectedUrl(null)}>
                    {t("Close")} </button>
                }
              >
                <a
                  href={mediaUrl(image.url)}
                  target="_blank"
                  rel="noopener"
                  class={`group relative block overflow-hidden rounded-ds border border-border ${checkerboard}`}
                  title={t("Open the original")}
                >
                  <img src={mediaUrl(image.url)} alt={image.alt || image.name} class="mx-auto max-h-56 w-full object-contain" />
                  <span class="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-ds bg-surface/90 text-text-muted opacity-0 shadow-ds-sm transition-opacity group-hover:opacity-100">
                    <ExternalLink size={12} />
                  </span>
                </a>

                <h3 class="mt-3 break-all text-[13px] font-semibold text-text">{image.name}</h3>
                <Show when={image.readonly}>
                  <Badge class="mt-1.5">{t("From the theme")}</Badge>
                </Show>

                <div class="mt-3">
                  <AltField image={image} onSave={(alt) => library.saveAlt(image, alt)} />
                </div>

                <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                  <Show when={image.width}>
                    <dt class="text-text-faint">{t("Dimensions")}</dt>
                    <dd class="text-text-secondary tabular-nums">
                      {image.width} × {image.height}
                    </dd>
                  </Show>
                  <dt class="text-text-faint">{t("Size")}</dt>
                  <dd class="text-text-secondary">
                    {bytes(image.size)} · {extension(image)}
                  </dd>
                  <dt class="text-text-faint">{t("Modified")}</dt>
                  <dd class="text-text-secondary">{added(image.modified)}</dd>
                </dl>

                <Label for="media-address" class="mt-4">
                  {t("Address")} </Label>
                <div class="flex gap-1.5">
                  <input
                    id="media-address"
                    readOnly
                    class={`${control} min-w-0 flex-1 font-mono text-[11.5px]`}
                    value={image.url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button size="sm" title={t("Copy the address")} aria-label={t("Copy the address")} onClick={() => void copy(image.url, t("Address"))}>
                    <Copy size={13} />
                  </Button>
                </div>
                <button
                  type="button"
                  class="mt-1.5 text-[11.5px] text-brand hover:underline"
                  onClick={() => void copy(`![${image.alt}](${image.url})`, t("Markdown"))}
                >
                  {t("Copy as markdown")} </button>

                <div class="mt-4 border-t border-border pt-3">
                  <p class="text-xs font-medium text-text-secondary">
                    {image.used_in.length ? t("Used in {{v0}}", { v0: plural(image.used_in.length, 'file') }) : t("Not used anywhere")}
                  </p>
                  <Show
                    when={image.used_in.length}
                    fallback={<p class="mt-1 text-[11.5px] text-text-faint">{t("No content, settings or template mentions this image.")}</p>}
                  >
                    <ul class="mt-1.5 space-y-1">
                      <For each={image.used_in}>
                        {(file) => (
                          <li class="truncate text-[11.5px]">
                            <Show when={entryLink(file)} fallback={<span class="font-mono text-text-muted">{file}</span>}>
                              {(href) => (
                                <A href={href()} class="font-mono text-brand hover:underline">
                                  {file}
                                </A>
                              )}
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>

                <Show
                  when={!image.readonly}
                  fallback={<p class="mt-4 text-[11.5px] text-text-faint">{t("Theme images can be used, but they belong to the theme and cannot be deleted here.")}</p>}
                >
                  <button
                    type="button"
                    class="mt-4 inline-flex items-center gap-1.5 text-xs text-danger hover:underline disabled:opacity-50"
                    disabled={deleting()}
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 size={13} />
                    {deleting() ? t("Deleting…") : t("Delete image")}
                  </button>
                </Show>
              </Postbox>
            )}
          </Show>
        </div>
      </SidebarLayout>

      <Show when={dragging()}>
        <div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-brand/10 p-6 backdrop-blur-[1px]">
          <div class="flex flex-col items-center gap-2 rounded-ds border-2 border-dashed border-brand bg-surface px-12 py-10 shadow-ds-lg">
            <Upload size={26} class="text-brand" />
            <p class="text-sm font-medium text-text">{t("Drop to upload")}</p>
            <p class="text-xs text-text-faint">{t("PNG, JPG, GIF, WebP or AVIF, up to 10 MB each")}</p>
          </div>
        </div>
      </Show>

      <ConfirmDialog
        open={confirming()}
        onOpenChange={setConfirming}
        danger
        title={t("Delete image?")}
        message={deleteMessage()}
        confirmLabel={t("Delete image")}
        onConfirm={() => void remove()}
      />
    </Page>
  );
}
