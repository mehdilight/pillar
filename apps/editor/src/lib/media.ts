import { t, language } from '../i18n';
import { createResource, createSignal } from 'solid-js';
import { api } from '../api/client';
import { refreshStatus } from '../store/status';
import { reloadPreview } from '../store/editor';
import { showToast } from '../components/ui/Toast';
import type { MediaItem } from '../types';

/** Checked here as well as on the server, so a large file fails before it is read. */
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ACCEPTED = 'image/png,image/jpeg,image/gif,image/webp,image/avif';

/** Mirrors `Dev\Media::FILE_EXTENSIONS` — what a `file` field can hold. */
export const FILE_EXTENSIONS = ['pdf', 'zip', 'csv', 'txt', 'docx', 'xlsx', 'pptx', 'mp3', 'mp4', 'webm'];

export const ACCEPTED_FILES = FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',');

const isAcceptable = (file: File) =>
  file.type.startsWith('image/') || FILE_EXTENSIONS.includes(file.name.split('.').pop()?.toLowerCase() ?? '');

/** The address an image is shown from, whatever form a setting stored it in. */
export function mediaUrl(value: string): string {
  if (/^https?:\/\//i.test(value) || value.startsWith('/assets/')) return value;

  return value ? `/assets/${value.replace(/^\/?assets\//, '')}` : '';
}

export const bytes = (size: number) =>
  size >= 1024 * 1024
    ? `${new Intl.NumberFormat(language(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(size / (1024 * 1024))} ${t('MB')}`
    : `${new Intl.NumberFormat(language()).format(Math.max(1, Math.round(size / 1024)))} ${t('KB')}`;

export const extension = (image: MediaItem) => image.url.split('.').pop()?.toUpperCase() ?? '';

export const plural = (count: number, word: string) => t(`count.${word}`, { count });

const read = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(t("Could not read the image.")));
    reader.readAsDataURL(file);
  });

let libraryAlts: Promise<Map<string, string>> | null = null;

/**
 * The library's alt text for an image address, for showing what an image with
 * no alt of its own will get. Fetched once, and again after an alt is saved.
 */
export async function libraryAlt(url: string): Promise<string> {
  libraryAlts ??= api
    .media()
    .then((images) => new Map(images.map((image) => [image.url, image.alt])))
    .catch(() => new Map());

  return (await libraryAlts).get(mediaUrl(url)) ?? '';
}

/**
 * The media library's state and actions — shared by the Media page and every
 * image picker, so an upload behaves the same wherever it starts.
 */
export function createMediaLibrary() {
  const [images, { refetch, mutate }] = createResource(api.media);
  const [progress, setProgress] = createSignal('');
  const [error, setError] = createSignal('');

  const all = () => (images.error ? [] : images() ?? []);

  /** Uploads one by one, returning what arrived; failures are collected into `error`. */
  const upload = async (files: File[]): Promise<MediaItem[]> => {
    const chosen = files.filter(isAcceptable);

    if (progress() || chosen.length === 0) return [];

    setError('');

    const uploaded: MediaItem[] = [];
    const failures: string[] = [];

    for (const [index, file] of chosen.entries()) {
      setProgress(chosen.length === 1 ? t("Uploading…") : t("Uploading {{v0}} of {{v1}}…", { v0: index + 1, v1: chosen.length }));

      try {
        if (file.size > (file.type.startsWith('image/') ? MAX_BYTES : MAX_FILE_BYTES)) {
          throw new Error(file.type.startsWith('image/') ? t("Choose an image smaller than 10 MB.") : t("Choose a file smaller than 25 MB."));
        }

        uploaded.push(await api.uploadImage(file.name, await read(file)));
      } catch (cause) {
        failures.push(`${file.name}: ${cause instanceof Error ? cause.message : t("Upload failed.")}`);
      }
    }

    try {
      await Promise.all([refetch(), refreshStatus()]);
    } catch {
      failures.push(t("Could not refresh the library. Reload the page to see the new images."));
    }

    setProgress('');

    if (uploaded.length) showToast(t("Uploaded {{v0}}", { v0: plural(uploaded.length, uploaded.every((item) => item.kind === 'image') ? 'image' : 'file') }), 'success');

    setError(failures.join('\n'));

    // The list's copy carries what the upload response cannot: where it is used.
    return uploaded.map((item) => all().find((image) => image.url === item.url) ?? item);
  };

  const remove = async (image: MediaItem): Promise<boolean> => {
    try {
      await api.deleteMedia(image.url);
      await Promise.all([refetch(), refreshStatus()]);
      reloadPreview();
      showToast(t("Image deleted"), 'success');

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not delete the image."));

      return false;
    }
  };

  /** Saves an image's alt text; the list is patched in place rather than refetched. */
  const saveAlt = async (image: MediaItem, alt: string): Promise<MediaItem | null> => {
    try {
      const updated = await api.setMediaAlt(image.url, alt);

      mutate((list) => list?.map((item) => (item.url === updated.url ? { ...item, alt: updated.alt } : item)));
      libraryAlts = null;
      void refreshStatus();
      showToast(updated.alt ? t("Alt text saved") : t("Alt text cleared"), 'success');

      return updated;
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : t("Could not save the alt text."), 'error');

      return null;
    }
  };

  return { images, all, refetch, upload, remove, saveAlt, progress, error, setError };
}
