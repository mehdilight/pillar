import { Show } from 'solid-js';
import {
  CaretLeftIcon,
  FolderIcon,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  PillarLogo,
} from './Icons';
import { api, type ServerStatus } from '../lib/api';

interface HeaderProps {
  status: ServerStatus;
  onBackToLauncher: () => void;
  onReload: () => void;
}

export function Header(props: HeaderProps) {
  const isSiteActive = () => props.status.running && !!props.status.site_path;

  const handleRevealFinder = async () => {
    if (props.status.site_path) {
      await api.openInFinder(props.status.site_path);
    }
  };

  const handleOpenBrowser = async () => {
    if (props.status.preview_url) {
      await api.openInBrowser(props.status.preview_url);
    }
  };

  return (
    <header
      data-tauri-drag-region
      class="h-11 bg-stone-900 border-b border-stone-800 flex items-center justify-between px-3 pl-20 select-none z-30 shrink-0 text-xs font-medium text-stone-300"
    >
      <div class="flex items-center gap-3" data-tauri-drag-region>
        <Show
          when={isSiteActive()}
          fallback={
            <div class="flex items-center gap-2" data-tauri-drag-region>
              <PillarLogo class="w-4 h-4" />
              <span class="font-semibold text-stone-200">Pillar</span>
              <span class="text-stone-500 text-[11px]">v0.2.0</span>
            </div>
          }
        >
          <button
            onClick={props.onBackToLauncher}
            class="flex items-center gap-1.5 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors"
            title="Return to site launcher"
          >
            <CaretLeftIcon size={14} />
            <span>Sites</span>
          </button>

          <div class="h-4 w-px bg-stone-800" />

          <div class="flex items-center gap-2" data-tauri-drag-region>
            <span class="font-semibold text-stone-100 max-w-[220px] truncate">
              {props.status.site_name || 'Active Site'}
            </span>
            <Show when={props.status.port}>
              <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-[11px]">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>localhost:{props.status.port}</span>
              </span>
            </Show>
          </div>
        </Show>
      </div>

      <div class="flex items-center gap-1.5">
        <Show when={isSiteActive()}>
          <button
            onClick={handleRevealFinder}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition-colors"
            title="Reveal site folder in Finder / Explorer"
          >
            <FolderIcon size={14} />
            <span>Folder</span>
          </button>

          <button
            onClick={handleOpenBrowser}
            class="flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-stone-800 text-stone-300 hover:text-stone-100 transition-colors"
            title="Open live preview in external browser"
          >
            <ArrowSquareOutIcon size={14} />
            <span>Live Preview</span>
          </button>

          <button
            onClick={props.onReload}
            class="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="Reload editor"
          >
            <ArrowsClockwiseIcon size={14} />
          </button>
        </Show>
      </div>
    </header>
  );
}
