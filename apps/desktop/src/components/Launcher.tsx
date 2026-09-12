import { For, Show } from 'solid-js';
import {
  FolderIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from './Icons';
import { api, type PhpInfo, type SiteInfo } from '../lib/api';

interface LauncherProps {
  phpInfo: PhpInfo | null;
  recentSites: SiteInfo[];
  starterPath: string | null;
  onOpenSite: (path: string) => void;
  onPickFolder: () => void;
  onCreateNew: () => void;
  onRemoveRecent: (path: string) => void;
  isLoading: boolean;
  error: string | null;
}

const buttonBase =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium leading-none shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const buttonSecondary = `${buttonBase} border-[#c9cccf] bg-white text-[#202223] hover:border-[#6d7175] hover:bg-[#f1f2f4] cursor-pointer`;
const buttonPrimary = `${buttonBase} border-[#005bd3] bg-[#005bd3] text-white hover:border-[#004bb5] hover:bg-[#004bb5] bg-[linear-gradient(rgba(0,0,0,0)_63%,rgba(255,255,255,0.12)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer`;

export function Launcher(props: LauncherProps) {
  const formatTimeAgo = (timestamp: number) => {
    const elapsed = Math.floor(Date.now() / 1000) - timestamp;
    if (elapsed < 60) return 'Just now';
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    const days = Math.floor(elapsed / 86400);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  };

  const handleRevealFinder = async (path: string, e: MouseEvent) => {
    e.stopPropagation();
    await api.openInFinder(path);
  };

  const handleRemove = async (path: string, e: MouseEvent) => {
    e.stopPropagation();
    props.onRemoveRecent(path);
  };

  return (
    <div class="flex-1 overflow-y-auto bg-[#f6f6f7] text-[#202223] py-8 px-6 select-none font-sans">
      <div class="max-w-4xl mx-auto flex flex-col gap-6">
        {/* Page Top Bar */}
        <div class="flex items-center justify-between pb-5 border-b border-[#e1e3e5]">
          <div class="flex flex-col gap-0.5">
            <h1 class="text-xl font-semibold tracking-tight text-[#202223]">
              Sites Overview
            </h1>
            <p class="text-xs text-[#6d7175]">
              Local Pillar projects and real-time visual editing
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              onClick={props.onPickFolder}
              disabled={props.isLoading}
              class={buttonSecondary}
            >
              <FolderIcon size={14} />
              <span>Open Site Folder…</span>
            </button>

            <button
              onClick={props.onCreateNew}
              disabled={props.isLoading}
              class={buttonPrimary}
            >
              <PlusIcon size={14} />
              <span>Create New Site</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        <Show when={props.error}>
          <div class="relative overflow-hidden rounded-lg bg-[rgba(216,44,13,0.08)] border border-[rgba(216,44,13,0.3)] text-[#d82c0d] px-4 py-3 pl-5 text-xs before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#d82c0d]">
            <div class="flex items-start gap-2">
              <WarningCircleIcon size={16} class="shrink-0 mt-0.5" />
              <div class="leading-relaxed">
                <span class="font-semibold block">Unable to start site</span>
                {props.error}
              </div>
            </div>
          </div>
        </Show>

        {/* Diagnostic / Overview Tiles */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* PHP Runtime Tile */}
          <div class="min-w-0 rounded-lg border border-[#e1e3e5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <p class="m-0 text-xs uppercase tracking-[.04em] text-[#6d7175] font-medium">
              PHP Runtime
            </p>
            <div class="mt-2 flex items-center gap-2">
              <Show
                when={props.phpInfo?.available}
                fallback={
                  <div class="flex items-center gap-1.5 text-xs text-[#d82c0d] font-medium">
                    <WarningCircleIcon size={16} />
                    <span>PHP not found</span>
                  </div>
                }
              >
                <span class="w-2 h-2 rounded-full bg-[#008060]" />
                <span class="text-xl font-normal leading-tight text-[#202223] truncate">
                  {props.phpInfo?.version?.split(' ')?.[1] || 'Detected'}
                </span>
              </Show>
            </div>
            <p class="mt-1.5 text-[11.5px] text-[#8c9196] truncate font-mono">
              {props.phpInfo?.path || 'Install PHP 8.2+'}
            </p>
          </div>

          {/* Recent Sites Count Tile */}
          <div class="min-w-0 rounded-lg border border-[#e1e3e5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <p class="m-0 text-xs uppercase tracking-[.04em] text-[#6d7175] font-medium">
              Saved Sites
            </p>
            <p class="mt-2 text-xl font-normal leading-tight text-[#202223]">
              {props.recentSites.length} {props.recentSites.length === 1 ? 'Site' : 'Sites'}
            </p>
            <p class="mt-1.5 text-[11.5px] text-[#8c9196]">
              {props.recentSites.length > 0 ? 'Ready to serve on localhost' : 'No saved sites'}
            </p>
          </div>

          {/* Starter Project Tile */}
          <div class="min-w-0 rounded-lg border border-[#e1e3e5] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div>
              <p class="m-0 text-xs uppercase tracking-[.04em] text-[#6d7175] font-medium">
                Example Site
              </p>
              <p class="mt-2 text-base font-medium leading-tight text-[#202223]">
                Pillar Starter
              </p>
            </div>
            <div class="mt-2 pt-2 border-t border-[#f1f2f4] flex items-center justify-between">
              <span class="text-[11.5px] text-[#8c9196]">Includes SEO & layout</span>
              <Show when={props.starterPath}>
                {(path) => (
                  <button
                    onClick={() => props.onOpenSite(path())}
                    disabled={props.isLoading}
                    class="text-xs text-[#005bd3] font-medium hover:underline cursor-pointer"
                  >
                    Launch →
                  </button>
                )}
              </Show>
            </div>
          </div>
        </div>

        {/* Postbox: Recent Sites */}
        <section class="min-w-0 rounded-lg border border-[#e1e3e5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <header class="flex items-center justify-between border-b border-[#e1e3e5] px-4 py-3">
            <h2 class="text-[13px] font-semibold leading-[1.4] text-[#202223]">
              Recent Sites
            </h2>
            <span class="text-xs text-[#6d7175]">
              {props.recentSites.length} {props.recentSites.length === 1 ? 'project' : 'projects'}
            </span>
          </header>

          <div class="p-0">
            <Show
              when={props.recentSites.length > 0}
              fallback={
                <div class="p-10 text-center flex flex-col items-center gap-2">
                  <div class="p-3 rounded-full bg-[#f1f2f4] text-[#8c9196]">
                    <FolderIcon size={24} />
                  </div>
                  <p class="text-xs text-[#6d7175] max-w-xs leading-relaxed mt-1">
                    No recent sites. Open an existing folder or click <strong>Create New Site</strong> to begin.
                  </p>
                </div>
              }
            >
              <ul class="divide-y divide-[#e1e3e5]">
                <For each={props.recentSites}>
                  {(site) => (
                    <li
                      onClick={() => props.onOpenSite(site.path)}
                      class="flex items-center justify-between px-4 py-3 hover:bg-[#f1f2f4] transition-colors cursor-pointer group"
                    >
                      <div class="flex items-center gap-3 min-w-0 pr-4">
                        <div class="p-2 rounded-md bg-[#f1f2f4] text-[#6d7175] group-hover:bg-[#e0f0ff] group-hover:text-[#005bd3] transition-colors shrink-0">
                          <FolderIcon size={16} />
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="font-medium text-[13px] text-[#202223] truncate">
                            {site.name}
                          </span>
                          <span class="text-xs font-mono text-[#6d7175] truncate mt-0.5">
                            {site.path}
                          </span>
                        </div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[11.5px] text-[#8c9196] mr-2">
                          {formatTimeAgo(site.last_opened)}
                        </span>

                        <button
                          onClick={(e) => handleRevealFinder(site.path, e)}
                          class="h-7 px-2.5 rounded-md border border-[#c9cccf] bg-white text-[#202223] hover:bg-[#f1f2f4] text-xs font-medium transition-colors"
                          title="Reveal site in Finder"
                        >
                          Finder
                        </button>

                        <button
                          onClick={() => props.onOpenSite(site.path)}
                          class="h-7 px-3 rounded-md bg-[#005bd3] text-white hover:bg-[#004bb5] text-xs font-medium transition-colors shadow-xs"
                          title="Open in Editor"
                        >
                          Open
                        </button>

                        <button
                          onClick={(e) => handleRemove(site.path, e)}
                          class="p-1.5 rounded-md text-[#8c9196] hover:text-[#d82c0d] hover:bg-white transition-colors"
                          title="Remove from recents"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </section>
      </div>
    </div>
  );
}
