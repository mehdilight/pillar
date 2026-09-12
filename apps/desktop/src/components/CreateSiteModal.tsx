import { createSignal, Show } from 'solid-js';
import { FolderIcon, PlusIcon } from './Icons';
import { api } from '../lib/api';

interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (folderPath: string) => void;
}

export function CreateSiteModal(props: CreateSiteModalProps) {
  const [siteName, setSiteName] = createSignal('My Pillar Site');
  const [parentDir, setParentDir] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const slug = () =>
    siteName()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-pillar-site';

  const fullPath = () => {
    if (!parentDir()) return '';
    const cleanParent = parentDir().replace(/\/+$/, '');
    return `${cleanParent}/${slug()}`;
  };

  const handlePickParent = async () => {
    try {
      const selected = await api.pickFolder();
      if (selected) {
        setParentDir(selected);
        setError(null);
      }
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!siteName().trim()) {
      setError('Please enter a site name.');
      return;
    }
    if (!parentDir()) {
      setError('Please select a destination folder.');
      return;
    }

    const targetPath = fullPath();
    setIsSubmitting(true);
    setError(null);

    try {
      await api.createSite(targetPath, siteName().trim());
      props.onCreated(targetPath);
      props.onClose();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to create site');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div class="w-full max-w-md bg-stone-900 border border-stone-800 rounded-xl shadow-2xl p-6 text-stone-100 flex flex-col gap-4">
          <div class="flex items-center justify-between border-b border-stone-800 pb-3">
            <div class="flex items-center gap-2">
              <div class="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
                <PlusIcon size={18} />
              </div>
              <h2 class="text-base font-semibold">Create New Site</h2>
            </div>
            <button
              onClick={props.onClose}
              class="text-stone-400 hover:text-stone-200 text-sm font-medium px-2 py-1 rounded hover:bg-stone-800"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <Show when={error()}>
              <div class="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs leading-relaxed">
                {error()}
              </div>
            </Show>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Site Name
              </label>
              <input
                type="text"
                value={siteName()}
                onInput={(e) => setSiteName(e.currentTarget.value)}
                placeholder="e.g. My Architecture Journal"
                class="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Location
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  value={parentDir()}
                  readOnly
                  placeholder="Select destination folder..."
                  class="flex-1 px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-sm text-stone-300 placeholder:text-stone-600 truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePickParent}
                  class="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium flex items-center gap-1.5 border border-stone-700 shrink-0 transition-colors"
                >
                  <FolderIcon size={14} />
                  <span>Choose...</span>
                </button>
              </div>
            </div>

            <Show when={fullPath()}>
              <div class="p-2.5 rounded-lg bg-stone-950/60 border border-stone-800 text-xs flex flex-col gap-1">
                <span class="text-stone-500 font-medium text-[11px]">Will be created at:</span>
                <span class="font-mono text-stone-300 break-all text-[11px]">{fullPath()}</span>
              </div>
            </Show>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={props.onClose}
                disabled={isSubmitting()}
                class="px-4 py-2 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting() || !parentDir()}
                class="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-stone-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5"
              >
                <Show when={isSubmitting()} fallback={<PlusIcon size={14} />}>
                  <span class="w-3 h-3 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                </Show>
                <span>{isSubmitting() ? 'Creating...' : 'Create & Open'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
