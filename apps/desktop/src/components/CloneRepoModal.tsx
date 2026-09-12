import { createSignal, createEffect, For, Show } from 'solid-js';
import {
  GitHubIcon,
  FolderIcon,
  LockIcon,
  GitBranchIcon,
  WarningCircleIcon,
  ArrowsClockwiseIcon,
} from './Icons';
import { api, type GitHubRepo, type SiteInfo } from '../lib/api';

interface CloneRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloned: (site: SiteInfo) => void;
}

const buttonBase =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium leading-none shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const buttonSecondary = `${buttonBase} border-[#c9cccf] bg-white text-[#202223] hover:border-[#6d7175] hover:bg-[#f1f2f4] cursor-pointer`;
const buttonPrimary = `${buttonBase} border-[#005bd3] bg-[#005bd3] text-white hover:border-[#004bb5] hover:bg-[#004bb5] bg-[linear-gradient(rgba(0,0,0,0)_63%,rgba(255,255,255,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer`;

export function CloneRepoModal(props: CloneRepoModalProps) {
  const [repos, setRepos] = createSignal<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedRepo, setSelectedRepo] = createSignal<GitHubRepo | null>(null);
  const [targetParentDir, setTargetParentDir] = createSignal('');
  const [isCloning, setIsCloning] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen) {
      loadRepos();
    } else {
      setSelectedRepo(null);
      setSearchQuery('');
      setError(null);
    }
  });

  const loadRepos = async () => {
    setIsLoadingRepos(true);
    setError(null);
    try {
      const list = await api.listGithubRepos();
      setRepos(list);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to load repositories.');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const filteredRepos = () => {
    const q = searchQuery().trim().toLowerCase();
    if (!q) return repos();
    return repos().filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  };

  const targetPath = () => {
    const repo = selectedRepo();
    if (!repo || !targetParentDir()) return '';
    const cleanParent = targetParentDir().replace(/\/+$/, '');
    return `${cleanParent}/${repo.name}`;
  };

  const handlePickParent = async () => {
    try {
      const selected = await api.pickFolder();
      if (selected) {
        setTargetParentDir(selected);
        setError(null);
      }
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleClone = async () => {
    const repo = selectedRepo();
    if (!repo) {
      setError('Please select a repository to clone.');
      return;
    }
    const path = targetPath();
    if (!path) {
      setError('Please select a destination folder.');
      return;
    }

    setIsCloning(true);
    setError(null);

    try {
      const site = await api.cloneGithubRepo(repo.full_name, path, repo.clone_url);
      props.onCloned(site);
      props.onClose();
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err.message || 'Failed to clone repository.');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
        <div class="w-full max-w-xl bg-white border border-[#e1e3e5] rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-5 text-[#202223] flex flex-col gap-4 max-h-[85vh]">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-[#e1e3e5] pb-3 shrink-0">
            <div class="flex items-center gap-2">
              <GitHubIcon size={18} class="text-[#202223]" />
              <h2 class="text-sm font-semibold text-[#202223]">Clone from GitHub</h2>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                onClick={loadRepos}
                disabled={isLoadingRepos()}
                class="p-1 rounded text-[#6d7175] hover:text-[#202223] hover:bg-[#f1f2f4] transition-colors cursor-pointer"
                title="Refresh repositories"
              >
                <ArrowsClockwiseIcon size={14} class={isLoadingRepos() ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={props.onClose}
                class="text-[#6d7175] hover:text-[#202223] text-sm font-medium px-2 py-0.5 rounded hover:bg-[#f1f2f4] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <Show when={error()}>
            <div class="p-3 rounded-md bg-[rgba(216,44,13,0.08)] border border-[rgba(216,44,13,0.3)] text-[#d82c0d] text-xs leading-relaxed flex items-start gap-2 shrink-0">
              <WarningCircleIcon size={16} class="shrink-0 mt-0.5" />
              <span class="break-all">{error()}</span>
            </div>
          </Show>

          {/* Search Input */}
          <div class="shrink-0">
            <input
              type="text"
              placeholder="Search repositories…"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="h-8 w-full rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[13px] text-[#202223] placeholder:text-[#8c9196] focus:border-[#005bd3] focus:ring-2 focus:ring-[#005bd3]/15 outline-none transition-colors"
            />
          </div>

          {/* Repos List */}
          <div class="flex-1 overflow-y-auto border border-[#e1e3e5] rounded-lg min-h-[160px] max-h-[260px] divide-y divide-[#e1e3e5]">
            <Show
              when={!isLoadingRepos()}
              fallback={
                <div class="p-8 text-center text-xs text-[#6d7175] flex items-center justify-center gap-2">
                  <span class="w-3.5 h-3.5 border-2 border-[#005bd3] border-t-transparent rounded-full animate-spin" />
                  <span>Loading repositories from GitHub…</span>
                </div>
              }
            >
              <Show
                when={filteredRepos().length > 0}
                fallback={
                  <div class="p-8 text-center text-xs text-[#6d7175]">
                    No repositories found matching your search.
                  </div>
                }
              >
                <For each={filteredRepos()}>
                  {(repo) => {
                    const isSelected = () => selectedRepo()?.id === repo.id;
                    return (
                      <div
                        onClick={() => setSelectedRepo(repo)}
                        class={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected()
                            ? 'bg-[#e0f0ff] border-l-4 border-[#005bd3]'
                            : 'hover:bg-[#f6f6f7]'
                        }`}
                      >
                        <div class="flex flex-col min-w-0 pr-3">
                          <div class="flex items-center gap-1.5 min-w-0">
                            <span class="text-xs font-semibold text-[#202223] truncate">
                              {repo.name}
                            </span>
                            <Show when={repo.private}>
                              <LockIcon size={12} class="text-[#8c9196] shrink-0" />
                            </Show>
                          </div>
                          <Show when={repo.description}>
                            <p class="text-[11.5px] text-[#6d7175] truncate m-0 mt-0.5">
                              {repo.description}
                            </p>
                          </Show>
                        </div>
                        <div class="flex items-center gap-1 text-[11px] font-mono text-[#8c9196] shrink-0">
                          <GitBranchIcon size={12} />
                          <span>{repo.default_branch}</span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </Show>
            </Show>
          </div>

          {/* Destination Folder Picker */}
          <div class="flex flex-col gap-1 shrink-0">
            <label class="text-xs font-medium text-[#303030]">
              Destination Directory
            </label>
            <div class="flex items-center gap-2">
              <input
                type="text"
                value={targetParentDir()}
                readOnly
                placeholder="Choose parent directory…"
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

          <Show when={targetPath()}>
            <div class="p-2.5 rounded-md bg-[#f6f6f7] border border-[#e1e3e5] text-xs flex flex-col gap-1 shrink-0">
              <span class="text-[#6d7175] font-medium text-[11px]">Will be cloned to:</span>
              <span class="font-mono text-[#202223] break-all text-[11.5px]">{targetPath()}</span>
            </div>
          </Show>

          {/* Footer Actions */}
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#e1e3e5] shrink-0">
            <button
              type="button"
              onClick={props.onClose}
              disabled={isCloning()}
              class={buttonSecondary}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClone}
              disabled={isCloning() || !selectedRepo() || !targetParentDir()}
              class={buttonPrimary}
            >
              <Show when={isCloning()} fallback={<GitHubIcon size={14} />}>
                <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </Show>
              <span>{isCloning() ? 'Cloning…' : 'Clone Repository'}</span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
