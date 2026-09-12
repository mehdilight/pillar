import { Show } from 'solid-js';
import {
  CaretLeftIcon,
  FolderIcon,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
} from './Icons';
import { api, type ServerStatus } from '../lib/api';

interface HeaderProps {
  status: ServerStatus;
  onBackToLauncher: () => void;
  onReload: () => void;
}

const headerButton =
  'h-8 cursor-pointer flex items-center gap-2 text-gray-200 rounded-md hover:text-white focus:text-white hover:bg-[#272626] focus:bg-[#272626] px-2.5 text-xs outline-none transition-colors';

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
      class="h-14 bg-[#1a1a1a] border-b border-[#2c2d30] flex items-center justify-between px-4 select-none z-50 shrink-0 text-white"
    >
      <div class="flex items-center min-w-0 gap-2.5">
        <Show
          when={isSiteActive()}
          fallback={
            <div class="flex items-center gap-2" data-tauri-drag-region>
              <span class="font-semibold text-base tracking-tight text-white">Pillar</span>
              <span class="text-gray-500 text-sm">/</span>
              <span class="text-gray-400 text-[13px] font-medium">Desktop</span>
              <span class="text-gray-500 text-xs ml-1">v0.2.0</span>
            </div>
          }
        >
          <button
            onClick={props.onBackToLauncher}
            class="h-8 cursor-pointer flex items-center gap-1.5 text-gray-200 rounded-md hover:text-white hover:bg-[#272626] px-2.5 text-xs transition-colors"
            title="Return to site launcher"
          >
            <CaretLeftIcon size={14} />
            <span>Sites</span>
          </button>

          <span class="text-gray-600">/</span>

          <span class="font-medium text-white text-[13px] truncate max-w-[240px]" data-tauri-drag-region>
            {props.status.site_name || 'Active Site'}
          </span>
        </Show>
      </div>

      <div class="flex items-center justify-center">
        <Show when={isSiteActive() && props.status.port}>
          <div class="h-7 inline-flex items-center gap-2 rounded-full border border-[#3e4045] bg-[#2c2d30] px-3 text-[11.5px] font-medium text-gray-300">
            <span class="w-2 h-2 rounded-full bg-emerald-400" />
            <span class="font-mono">127.0.0.1:{props.status.port}</span>
            <span class="text-emerald-400 text-[11px] font-semibold">Running</span>
          </div>
        </Show>
      </div>

      <div class="flex items-center gap-1.5">
        <Show when={isSiteActive()}>
          <button
            onClick={handleRevealFinder}
            class={headerButton}
            title="Reveal site folder in Finder / Explorer"
          >
            <FolderIcon size={14} />
            <span class="hidden sm:inline">Folder</span>
          </button>

          <button
            onClick={handleOpenBrowser}
            class={headerButton}
            title="Open live preview in external browser"
          >
            <ArrowSquareOutIcon size={14} />
            <span class="hidden sm:inline">Live Preview</span>
          </button>

          <button
            onClick={props.onReload}
            class="h-8 w-8 flex items-center justify-center cursor-pointer text-gray-200 rounded-md hover:text-white hover:bg-[#272626] transition-colors"
            title="Reload editor"
          >
            <ArrowsClockwiseIcon size={14} />
          </button>
        </Show>
      </div>
    </header>
  );
}
