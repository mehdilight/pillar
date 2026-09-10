import { For, Show, createSignal } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import {
  ArrowLeftFromLine,
  ChevronDown,
  FileText,
  GitBranch,
  Hammer,
  History,
  Layers,
  MoreHorizontal,
  Palette,
  Redo2,
  RotateCcw,
  Smartphone,
  Undo2,
  Upload,
} from 'lucide-solid';
import Dropdown from '../components/ui/Dropdown';
import Tooltip from '../components/ui/Tooltip';
import { Menu, MenuItem, MenuSeparator } from '../components/ui/Menu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PublishDialog from './PublishDialog';
import HistoryModal from './HistoryModal';
import { showToast } from '../components/ui/Toast';
import { api, editorConfig } from '../api/client';
import * as editor from '../store/editor';
import type { EditorTab } from '../types';

const TABS: Array<{ id: EditorTab; label: string; shortcut: string; icon: () => any }> = [
  { id: 'sections', label: 'Sections', shortcut: '⌘ 1', icon: () => <Layers size={18} /> },
  { id: 'settings', label: 'Theme settings', shortcut: '⌘ 2', icon: () => <Palette size={18} /> },
];

export default function TopBar() {
  const navigate = useNavigate();
  const [showPublish, setShowPublish] = createSignal(false);
  const [showHistory, setShowHistory] = createSignal(false);
  const [showDiscard, setShowDiscard] = createSignal(false);
  const [building, setBuilding] = createSignal(false);

  const pending = () => editor.status()?.count ?? 0;

  const runBuild = async () => {
    setBuilding(true);

    try {
      const result = await api.build();

      showToast(`Built ${result.pages} pages in ${result.ms}ms`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Build failed', 'error');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <header class="bg-[#1a1a1a] border-b border-[#2c2d30] px-3.5 flex items-center justify-between flex-shrink-0 text-sm h-14 select-none z-30 text-white">
      {/* Left: exit and the panels */}
      <div class="flex items-center gap-2">
        <Tooltip content="Exit">
          <A
            href="/"
            class="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-[#2c2d30] transition-colors inline-flex items-center justify-center"
            aria-label="Exit"
          >
            <ArrowLeftFromLine size={16} />
          </A>
        </Tooltip>

        <div class="flex items-center gap-1">
          <For each={TABS}>
            {(entry) => (
              <Tooltip content={entry.label} shortcut={entry.shortcut}>
                <button
                  type="button"
                  onClick={() => editor.setTab(entry.id)}
                  class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  classList={{
                    'bg-[#383a3e] text-[#2f81f7]': editor.tab() === entry.id,
                    'text-gray-400 hover:text-gray-200 hover:bg-[#28292c]': editor.tab() !== entry.id,
                  }}
                  aria-label={entry.label}
                >
                  {entry.icon()}
                </button>
              </Tooltip>
            )}
          </For>
        </div>
      </div>

      {/* Center: the site, the branch, the page */}
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-200">
          <GitBranch size={14} class="text-gray-400" />
          <span class="max-w-[200px] truncate">{editorConfig.siteName}</span>
          <span class="text-gray-500 font-mono">{editor.status()?.branch ?? 'main'}</span>

          <Show
            when={pending() > 0}
            fallback={
              <span class="px-2 py-0.5 text-[11px] font-medium bg-[#2c2d30] text-gray-300 border border-[#3e4045] rounded-full">
                Committed
              </span>
            }
          >
            <button
              type="button"
              onClick={() => setShowPublish(true)}
              class="px-2 py-0.5 text-[11px] font-medium bg-amber-400/15 text-amber-300 border border-amber-400/30 rounded-full hover:bg-amber-400/25 transition-colors cursor-pointer"
              title="Uncommitted changes — click to publish"
            >
              {pending()} uncommitted
            </button>
          </Show>

          <Show when={editor.offline()}>
            <span
              class="px-2 py-0.5 text-[11px] font-medium bg-gray-500/15 text-gray-300 border border-gray-500/30 rounded-full"
              title="No backend answered — edits live in memory only."
            >
              Demo data
            </span>
          </Show>
        </div>

        <Dropdown
          contentClass="w-72"
          trigger={(
            <button
              type="button"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-200 hover:bg-[#2c2d30] cursor-pointer transition-colors"
            >
              <FileText size={14} class="text-gray-400" />
              <span>{editor.currentTemplate()?.label ?? editor.templateName()}</span>
              <ChevronDown size={12} class="text-gray-400" />
            </button>
          )}
        >
          {(close) => (
            <div class="ed-picker-list py-1 max-h-80 overflow-y-auto">
              <For each={editor.templates()}>
                {(entry) => (
                  <button
                    type="button"
                    class="ed-pick-row flex items-center justify-between w-full px-3 py-1.5 text-[13px] text-left text-[#303030] hover:bg-[#f1f2f4] transition-colors"
                    classList={{ 'bg-[#f1f2f4] font-medium': entry.name === editor.templateName() }}
                    onClick={() => {
                      close();
                      // The page is the route: switching templates navigates,
                      // so the URL always says what is being edited.
                      navigate(entry.name === 'index' ? '/editor' : `/editor/${entry.name}`);
                    }}
                  >
                    <span class="ed-pick-title">{entry.label}</span>
                    <span class="ed-pick-sub font-mono text-[11px] text-gray-400">{entry.route}</span>
                  </button>
                )}
              </For>
            </div>
          )}
        </Dropdown>
      </div>

      {/* Right: device, undo/redo, more, publish */}
      <div class="flex items-center gap-2">
        <Tooltip content={editor.device() === 'mobile' ? 'Desktop view' : 'Mobile view'}>
          <button
            type="button"
            onClick={() => editor.setDevice(editor.device() === 'mobile' ? 'desktop' : 'mobile')}
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            classList={{
              'bg-[#383a3e] text-white shadow-xs': editor.device() === 'mobile',
              'text-gray-400 hover:text-gray-200 hover:bg-[#28292c]': editor.device() !== 'mobile',
            }}
            aria-label="Toggle mobile preview"
          >
            <Smartphone size={16} />
          </button>
        </Tooltip>

        <div class="flex items-center">
          <Tooltip content="Undo" shortcut="⌘ Z">
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-400 hover:bg-[#2c2d30] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              onClick={editor.undo}
              disabled={!editor.canUndo()}
              aria-label="Undo"
            >
              <Undo2 size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Redo" shortcut="⌘ ⇧ Z">
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-400 hover:bg-[#2c2d30] hover:text-white disabled:opacity-25 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              onClick={editor.redo}
              disabled={!editor.canRedo()}
              aria-label="Redo"
            >
              <Redo2 size={15} />
            </button>
          </Tooltip>
        </div>

        <Tooltip content="Build the site">
          <button
            type="button"
            onClick={runBuild}
            disabled={building()}
            class="p-1.5 rounded-lg text-gray-400 hover:bg-[#2c2d30] hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            aria-label="Build"
          >
            <Hammer size={15} />
          </button>
        </Tooltip>

        <Menu
          trigger={(
            <button
              type="button"
              class="p-1.5 rounded-lg text-gray-400 hover:bg-[#2c2d30] hover:text-white transition-colors cursor-pointer"
              title="More actions"
            >
              <MoreHorizontal size={15} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Upload size={14} />}
                onSelect={() => {
                  close();
                  setShowPublish(true);
                }}
              >
                Publish…
              </MenuItem>
              <MenuItem
                icon={<History size={14} />}
                onSelect={() => {
                  close();
                  setShowHistory(true);
                }}
              >
                Version history
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                danger
                icon={<RotateCcw size={14} />}
                onSelect={() => {
                  close();
                  setShowDiscard(true);
                }}
              >
                Discard changes
              </MenuItem>
            </>
          )}
        </Menu>

        <Tooltip content="Commit the working tree" shortcut="⌘ S">
          <button
            type="button"
            onClick={() => setShowPublish(true)}
            disabled={pending() === 0}
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
            classList={{
              'bg-[#008060] text-white hover:bg-[#006e52] shadow-sm cursor-pointer': pending() > 0,
              'bg-[#28292c] text-gray-500 border border-[#383a3e] cursor-not-allowed opacity-80':
                pending() === 0,
            }}
          >
            Publish
          </button>
        </Tooltip>
      </div>

      <PublishDialog open={showPublish()} onOpenChange={setShowPublish} />
      <HistoryModal open={showHistory()} onOpenChange={setShowHistory} />
      <ConfirmDialog
        open={showDiscard()}
        onOpenChange={setShowDiscard}
        danger
        title="Discard changes"
        message="Every uncommitted edit to templates, settings and content goes back to the last commit. This cannot be undone from here."
        confirmLabel="Discard changes"
        onConfirm={() => {
          void editor.discard().then(() => showToast('Working tree restored', 'info'));
        }}
      />
    </header>
  );
}
