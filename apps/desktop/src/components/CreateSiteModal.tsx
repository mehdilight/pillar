import { createSignal, Show } from 'solid-js';
import { FolderIcon, PlusIcon } from './Icons';
import { api } from '../lib/api';

interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (folderPath: string) => void;
}

const buttonBase =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium leading-none shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const buttonSecondary = `${buttonBase} border-[#c9cccf] bg-white text-[#202223] hover:border-[#6d7175] hover:bg-[#f1f2f4] cursor-pointer`;
const buttonPrimary = `${buttonBase} border-[#005bd3] bg-[#005bd3] text-white hover:border-[#004bb5] hover:bg-[#004bb5] bg-[linear-gradient(rgba(0,0,0,0)_63%,rgba(255,255,255,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer`;

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
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
        <div class="w-full max-w-md bg-white border border-[#e1e3e5] rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-5 text-[#202223] flex flex-col gap-4">
          <div class="flex items-center justify-between border-b border-[#e1e3e5] pb-3">
            <h2 class="text-sm font-semibold text-[#202223]">Create New Site</h2>
            <button
              onClick={props.onClose}
              class="text-[#6d7175] hover:text-[#202223] text-sm font-medium px-2 py-0.5 rounded hover:bg-[#f1f2f4] transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            <Show when={error()}>
              <div class="p-3 rounded-md bg-[rgba(216,44,13,0.08)] border border-[rgba(216,44,13,0.3)] text-[#d82c0d] text-xs leading-relaxed">
                {error()}
              </div>
            </Show>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-[#303030]">
                Site Name
              </label>
              <input
                type="text"
                value={siteName()}
                onInput={(e) => setSiteName(e.currentTarget.value)}
                placeholder="e.g. My Architecture Journal"
                class="h-8 w-full rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[13px] text-[#202223] placeholder:text-[#8c9196] focus:border-[#005bd3] focus:ring-2 focus:ring-[#005bd3]/15 outline-none transition-colors"
                required
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium text-[#303030]">
                Destination Folder
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  value={parentDir()}
                  readOnly
                  placeholder="Choose where to save site…"
                  class="flex-1 h-8 rounded-lg border border-[#c9cccf] bg-[#f6f6f7] px-2.5 text-[13px] text-[#202223] placeholder:text-[#8c9196] truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePickParent}
                  class={buttonSecondary}
                >
                  <FolderIcon size={14} />
                  <span>Choose…</span>
                </button>
              </div>
            </div>

            <Show when={fullPath()}>
              <div class="p-2.5 rounded-md bg-[#f6f6f7] border border-[#e1e3e5] text-xs flex flex-col gap-1">
                <span class="text-[#6d7175] font-medium text-[11px]">Will be created at:</span>
                <span class="font-mono text-[#202223] break-all text-[11.5px]">{fullPath()}</span>
              </div>
            </Show>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#e1e3e5]">
              <button
                type="button"
                onClick={props.onClose}
                disabled={isSubmitting()}
                class={buttonSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting() || !parentDir()}
                class={buttonPrimary}
              >
                <Show when={isSubmitting()} fallback={<PlusIcon size={14} />}>
                  <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </Show>
                <span>{isSubmitting() ? 'Creating…' : 'Create Site'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}
