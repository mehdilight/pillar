import { For, Show } from 'solid-js';
import {
  FolderIcon,
  PlusIcon,
  PlayIcon,
  TrashIcon,
  PillarLogo,
  CheckCircleIcon,
  WarningCircleIcon,
  SparkleIcon,
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
    <div class="flex-1 overflow-y-auto bg-stone-950 text-stone-100 flex flex-col items-center p-8 select-none">
      <div class="w-full max-w-2xl flex flex-col gap-8">
        {/* Header / Hero */}
        <div class="flex flex-col items-center text-center gap-3 pt-6">
          <div class="p-3 rounded-2xl bg-stone-900 border border-stone-800 shadow-xl">
            <PillarLogo class="w-12 h-12" />
          </div>
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-bold tracking-tight text-stone-100">
              Pillar Desktop
            </h1>
            <p class="text-sm text-stone-400">
              Local-first static site publishing with real-time visual editing
            </p>
          </div>

          {/* PHP status badge */}
          <Show when={props.phpInfo}>
            {(info) => (
              <div
                class={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                  info().available
                    ? 'bg-stone-900/90 border-stone-800 text-stone-300'
                    : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                }`}
              >
                <Show
                  when={info().available}
                  fallback={
                    <>
                      <WarningCircleIcon size={14} class="text-rose-400" />
                      <span>{info().error || 'PHP not found in PATH'}</span>
                    </>
                  }
                >
                  <CheckCircleIcon size={14} class="text-emerald-400" />
                  <span class="text-stone-400">{info().version}</span>
                </Show>
              </div>
            )}
          </Show>
        </div>

        {/* Global Error message */}
        <Show when={props.error}>
          <div class="p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-3">
            <WarningCircleIcon size={18} class="text-rose-400 shrink-0 mt-0.5" />
            <div class="flex-1 leading-relaxed">
              <span class="font-semibold block mb-0.5">Unable to start site</span>
              {props.error}
            </div>
          </div>
        </Show>

        {/* Action buttons */}
        <div class="grid grid-cols-2 gap-3">
          <button
            onClick={props.onPickFolder}
            disabled={props.isLoading}
            class="flex items-center gap-3 p-4 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 hover:border-stone-700 transition-all text-left group shadow-sm"
          >
            <div class="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <FolderIcon size={22} />
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-stone-100 group-hover:text-white">
                Open Site Folder...
              </span>
              <span class="text-xs text-stone-400">
                Open an existing Pillar project
              </span>
            </div>
          </button>

          <button
            onClick={props.onCreateNew}
            disabled={props.isLoading}
            class="flex items-center gap-3 p-4 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 hover:border-stone-700 transition-all text-left group shadow-sm"
          >
            <div class="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20 transition-colors">
              <PlusIcon size={22} />
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-stone-100 group-hover:text-white">
                Create New Site
              </span>
              <span class="text-xs text-stone-400">
                Scaffold a fresh site with layouts
              </span>
            </div>
          </button>
        </div>

        {/* Starter example shortcut (in dev or repo) */}
        <Show when={props.starterPath}>
          {(path) => (
            <div class="p-3.5 rounded-xl bg-stone-900/60 border border-stone-800/80 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2.5">
                <div class="p-1 rounded-md bg-amber-400/10 text-amber-400">
                  <SparkleIcon size={15} />
                </div>
                <div>
                  <span class="font-medium text-stone-200">Explore Starter Site</span>
                  <span class="text-stone-500 block text-[11px]">
                    Includes sample layouts, articles, and SEO plugin
                  </span>
                </div>
              </div>
              <button
                onClick={() => props.onOpenSite(path())}
                disabled={props.isLoading}
                class="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition-colors"
              >
                Launch Starter
              </button>
            </div>
          )}
        </Show>

        {/* Recent Sites list */}
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Recent Sites
            </h2>
            <Show when={props.recentSites.length > 0}>
              <span class="text-xs text-stone-500">
                {props.recentSites.length} {props.recentSites.length === 1 ? 'site' : 'sites'}
              </span>
            </Show>
          </div>

          <div class="flex flex-col gap-1.5">
            <Show
              when={props.recentSites.length > 0}
              fallback={
                <div class="p-8 rounded-xl border border-dashed border-stone-800 text-center flex flex-col items-center gap-2">
                  <FolderIcon size={28} class="text-stone-600" />
                  <span class="text-xs text-stone-400">
                    No recent sites. Open a folder or create a new site to get started.
                  </span>
                </div>
              }
            >
              <For each={props.recentSites}>
                {(site) => (
                  <div
                    onClick={() => props.onOpenSite(site.path)}
                    class="flex items-center justify-between p-3 rounded-xl bg-stone-900/70 hover:bg-stone-900 border border-stone-850 hover:border-stone-750 transition-all cursor-pointer group"
                  >
                    <div class="flex items-center gap-3 min-w-0 pr-3">
                      <div class="p-2 rounded-lg bg-stone-800 text-stone-400 group-hover:text-amber-400 transition-colors shrink-0">
                        <PlayIcon size={14} />
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="text-sm font-semibold text-stone-200 group-hover:text-white truncate">
                          {site.name}
                        </span>
                        <span class="text-xs font-mono text-stone-500 truncate">
                          {site.path}
                        </span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-[11px] text-stone-500 mr-1">
                        {formatTimeAgo(site.last_opened)}
                      </span>

                      <button
                        onClick={(e) => handleRevealFinder(site.path, e)}
                        class="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
                        title="Reveal in Finder"
                      >
                        <FolderIcon size={14} />
                      </button>

                      <button
                        onClick={(e) => handleRemove(site.path, e)}
                        class="p-1.5 rounded hover:bg-stone-800 text-stone-500 hover:text-rose-400 transition-colors"
                        title="Remove from recents"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
