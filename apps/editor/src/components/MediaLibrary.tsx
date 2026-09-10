import { For, Show, createMemo, createSignal } from 'solid-js';
import { ImagePlus, Upload } from 'lucide-solid';
import { ACCEPTED, bytes, createMediaLibrary, mediaUrl, plural } from '../lib/media';
import type { MediaItem } from '../types';
import { controlClass } from './ui/Field';
import ConfirmDialog from './ui/ConfirmDialog';
import { showToast } from './ui/Toast';

export { mediaUrl };

/** The image picker's library: choose an image, or upload one and choose it. */
export default function MediaLibrary(props: { onChoose?: (url: string) => void; compact?: boolean }) {
  const { images, all, refetch, upload: uploadFiles, remove: removeImage, progress, error, setError } = createMediaLibrary();
  const [query, setQuery] = createSignal('');
  const [format, setFormat] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [selected, setSelected] = createSignal<MediaItem>();
  const [confirm, setConfirm] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  let uploadInput!: HTMLInputElement;
  const matching = createMemo(() => all().filter((image) => image.name.toLowerCase().includes(query().trim().toLowerCase()) && (!format() || image.url.toLowerCase().endsWith(`.${format()}`))));
  const pages = () => Math.max(1, Math.ceil(matching().length / 24));
  const current = () => Math.min(page(), pages());
  const visible = () => matching().slice((current() - 1) * 24, current() * 24);
  const upload = async (files: File[]) => {
    const uploaded = await uploadFiles(files);
    uploadInput.value = '';
    if (uploaded.length) setSelected(uploaded[uploaded.length - 1]);
  };
  const remove = async () => {
    const image = selected();
    if (!image) return;
    setDeleting(true);
    if (await removeImage(image)) setSelected(undefined);
    setDeleting(false);
  };
  return <div class="flex-1 min-h-0 flex flex-col bg-[#f1f2f4]" classList={{ 'min-h-[440px]': props.compact }}
    onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); void upload(Array.from(e.dataTransfer?.files ?? [])); }}>
    <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#e1e3e5] bg-white">
      <div><h1 class="text-sm font-semibold text-[#202223]">Media library</h1><p class="ed-hint">{plural(all().length, 'image')} · Upload once, use anywhere.</p></div>
      <input ref={uploadInput} type="file" multiple accept={ACCEPTED} class="hidden" aria-label="Upload images" onChange={(e) => void upload(Array.from(e.currentTarget.files ?? []))} />
      <button type="button" class="sam-btn primary" disabled={!!progress()} onClick={() => uploadInput.click()}><Upload size={14} />{progress() || 'Upload images'}</button>
    </div>
    <div class="flex flex-1 min-h-0 overflow-y-auto flex-col md:flex-row">
      <div class="flex-1 min-w-0 p-5">
        <div class="flex flex-wrap gap-2 mb-4">
          <input type="search" aria-label="Search images" class={`${controlClass} flex-1 min-w-[140px]`} placeholder="Search images…" value={query()} onInput={(e) => { setQuery(e.currentTarget.value); setPage(1); }} />
          <select aria-label="Image type" class={`${controlClass} w-auto!`} value={format()} onChange={(e) => { setFormat(e.currentTarget.value); setPage(1); }}>
            <option value="">All image types</option><For each={['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'svg']}>{(type) => <option value={type}>{type.toUpperCase()}</option>}</For>
          </select>
        </div>
        <Show when={error()}><p class="text-xs text-red-600 mb-4 whitespace-pre-wrap" role="alert">{error()}</p></Show>
        <Show when={images.error}><div class="text-xs text-red-600 mb-4" role="alert">Could not load images. <button type="button" class="underline" onClick={() => void refetch()}>Try again</button></div></Show>
        <Show when={images.loading}><p class="ed-hint" role="status">Loading images…</p></Show>
        <Show when={visible().length} fallback={
          <Show when={!images.loading && !images.error}><div class="rounded-xl border-2 border-dashed border-[#c9cccf] p-10 text-center flex flex-col items-center gap-3">
            <ImagePlus size={28} class="text-gray-400" /><p class="text-sm font-medium text-[#303030]">{all().length ? 'No images match your search' : 'Add your first image'}</p>
            <p class="text-xs text-gray-500">{all().length ? 'Try another name or image type.' : 'Drop images here, or choose them from your computer.'}</p>
            <Show when={!all().length}><button type="button" class="sam-btn" onClick={() => uploadInput.click()}>Choose images</button></Show>
          </div></Show>
        }>
          <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            <For each={visible()}>{(image) => <button type="button" class="text-left bg-white rounded-lg overflow-hidden border hover:border-[#005bd3] focus-visible:ring-2 focus-visible:ring-[#005bd3] transition-colors"
              classList={{ 'border-[#005bd3] ring-1 ring-[#005bd3]': selected()?.url === image.url, 'border-[#e1e3e5]': selected()?.url !== image.url }}
              aria-pressed={selected()?.url === image.url} onClick={() => setSelected(image)}>
              <img src={mediaUrl(image.url)} alt={image.name} loading="lazy" class="w-full h-28 object-contain bg-[#f6f6f7]" />
              <div class="p-2.5"><p class="text-xs font-medium truncate">{image.name}</p><p class="ed-hint">{bytes(image.size)}{image.readonly ? ' · Theme image' : ''}</p></div>
            </button>}</For>
          </div>
        </Show>
        <Show when={pages() > 1}><div class="flex gap-3 items-center justify-center mt-5 text-xs">
          <button type="button" class="sam-btn" disabled={current() === 1} onClick={() => setPage(current() - 1)}>Previous</button>
          <span>Page {current()} of {pages()}</span><button type="button" class="sam-btn" disabled={current() === pages()} onClick={() => setPage(current() + 1)}>Next</button>
        </div></Show>
      </div>
      <Show when={selected()}>{(image) => <aside class="md:w-[280px] shrink-0 border-t md:border-t-0 md:border-l border-[#e1e3e5] p-4 bg-white">
        <img src={mediaUrl(image().url)} alt={image().name} class="w-full max-h-52 object-contain bg-[#f6f6f7] rounded-lg mb-4" />
        <h2 class="text-xs font-semibold break-all mb-2">{image().name}</h2>
        <p class="ed-hint">{image().width ? `${image().width} × ${image().height} pixels · ` : ''}{bytes(image().size)}</p>
        <label class="ed-hint block mt-4 mb-1" for="media-address">Image address</label>
        <input id="media-address" readOnly class={`${controlClass} text-xs!`} value={image().url} onFocus={(e) => e.currentTarget.select()} />
        <div class="flex flex-wrap gap-2 mt-3">
          <Show when={props.onChoose}><button type="button" class="sam-btn primary" onClick={() => props.onChoose?.(image().url)}>Use this image</button></Show>
          <button type="button" class="sam-btn" onClick={() => void navigator.clipboard.writeText(image().url).then(() => showToast('Image address copied', 'success')).catch(() => setError('Select the image address above and copy it.'))}>Copy address</button>
          <Show when={!selected()?.readonly}><button type="button" class="sam-btn danger" disabled={deleting()} onClick={() => setConfirm(true)}>Delete</button></Show>
        </div>
        <Show when={selected()?.readonly}><p class="ed-hint mt-3">Included with your theme or addon. You can use it, but it cannot be deleted here.</p></Show>
      </aside>}</Show>
    </div>
    <ConfirmDialog open={confirm()} onOpenChange={setConfirm} title="Delete image?" danger confirmLabel="Delete image"
      message="This removes the image from your site. Pages using it will need another image. You can restore committed files through git history."
      onConfirm={() => void remove()} />
  </div>;
}
