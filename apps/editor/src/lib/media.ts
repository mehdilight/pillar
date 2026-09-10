import { createResource, createSignal } from 'solid-js';
import { api } from '../api/client';
import { refreshStatus } from '../store/status';
import { reloadPreview } from '../store/editor';
import { showToast } from '../components/ui/Toast';
import type { MediaItem } from '../types';

/** Checked here as well as on the server, so a large file fails before it is read. */
const MAX_BYTES = 10 * 1024 * 1024;

export const ACCEPTED = 'image/png,image/jpeg,image/gif,image/webp,image/avif';

/** The address an image is shown from, whatever form a setting stored it in. */
export function mediaUrl(value: string): string {
  if (/^https?:\/\//i.test(value) || value.startsWith('/assets/')) return value;

  return value ? `/assets/${value.replace(/^\/?assets\//, '')}` : '';
}

export const bytes = (size: number) =>
  size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;

export const extension = (image: MediaItem) => image.url.split('.').pop()?.toUpperCase() ?? '';

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const read = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });

/**
 * The media library's state and actions — shared by the Media page and every
 * image picker, so an upload behaves the same wherever it starts.
 */
export function createMediaLibrary() {
  const [images, { refetch }] = createResource(api.media);
  const [progress, setProgress] = createSignal('');
  const [error, setError] = createSignal('');

  const all = () => (images.error ? [] : images() ?? []);

  /** Uploads one by one, returning what arrived; failures are collected into `error`. */
  const upload = async (files: File[]): Promise<MediaItem[]> => {
    const chosen = files.filter((file) => file.type.startsWith('image/'));

    if (progress() || chosen.length === 0) return [];

    setError('');

    const uploaded: MediaItem[] = [];
    const failures: string[] = [];

    for (const [index, file] of chosen.entries()) {
      setProgress(chosen.length === 1 ? 'Uploading…' : `Uploading ${index + 1} of ${chosen.length}…`);

      try {
        if (file.size > MAX_BYTES) throw new Error('Choose a file smaller than 10 MB.');

        uploaded.push(await api.uploadImage(file.name, await read(file)));
      } catch (cause) {
        failures.push(`${file.name}: ${cause instanceof Error ? cause.message : 'Upload failed.'}`);
      }
    }

    try {
      await Promise.all([refetch(), refreshStatus()]);
    } catch {
      failures.push('Could not refresh the library. Reload the page to see the new images.');
    }

    setProgress('');

    if (uploaded.length) showToast(`Uploaded ${plural(uploaded.length, 'image')}`, 'success');

    setError(failures.join('\n'));

    // The list's copy carries what the upload response cannot: where it is used.
    return uploaded.map((item) => all().find((image) => image.url === item.url) ?? item);
  };

  const remove = async (image: MediaItem): Promise<boolean> => {
    try {
      await api.deleteMedia(image.url);
      await Promise.all([refetch(), refreshStatus()]);
      reloadPreview();
      showToast('Image deleted', 'success');

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the image.');

      return false;
    }
  };

  return { images, all, refetch, upload, remove, progress, error, setError };
}
