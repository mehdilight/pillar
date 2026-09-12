import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import {
  FolderIcon,
  PlusIcon,
  GitHubIcon,
  CodeIcon,
  HammerIcon,
  ArrowSquareOutIcon,
  GitBranchIcon,
} from './Icons';
import type { SiteInfo, ServerStatus } from '../lib/api';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  recentSites: SiteInfo[];
  serverStatus: ServerStatus;
  onOpenSite: (path: string) => void;
  onCreateNew: () => void;
  onPickFolder: () => void;
  onCloneGithub: () => void;
  onRevealFinder: () => void;
  onOpenCodeEditor: () => void;
  onBuildStatic: () => void;
  onSyncGithub: () => void;
  onCloseSite: () => void;
}

export function QuickSwitcherModal(props: QuickSwitcherProps) {
  const [query, setQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  const actions = () => {
    const isSiteActive = props.serverStatus.running && !!props.serverStatus.site_path;
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      category: 'Sites' | 'Actions';
      icon: string;
      run: () => void;
    }> = [];

    // Active site actions
    if (isSiteActive) {
      list.push({
        id: 'open-code',
        title: 'Open in VS Code / Cursor',
        subtitle: props.serverStatus.site_path || '',
        category: 'Actions',
        icon: 'code',
        run: () => {
          props.onClose();
          props.onOpenCodeEditor();
        },
      });
      list.push({
        id: 'build-static',
        title: 'Build Static Site (dist/)',
        subtitle: 'Compile markdown & templates into production HTML',
        category: 'Actions',
        icon: 'build',
        run: () => {
          props.onClose();
          props.onBuildStatic();
        },
      });
      list.push({
        id: 'sync-github',
        title: 'Sync with GitHub',
        subtitle: 'Pull latest commits and push local updates',
        category: 'Actions',
        icon: 'github',
        run: () => {
          props.onClose();
          props.onSyncGithub();
        },
      });
      list.push({
        id: 'reveal-finder',
        title: 'Reveal in Finder',
        subtitle: props.serverStatus.site_path || '',
        category: 'Actions',
        icon: 'folder',
        run: () => {
          props.onClose();
          props.onRevealFinder();
        },
      });
      list.push({
        id: 'close-site',
        title: 'Close Site (Back to Overview)',
        subtitle: 'Stop development server',
        category: 'Actions',
        icon: 'close',
        run: () => {
          props.onClose();
          props.onCloseSite();
        },
      });
    }

    // General Actions
    list.push({
      id: 'create-new',
      title: 'Create New Site…',
      subtitle: 'Initialize a new Pillar static project',
      category: 'Actions',
      icon: 'plus',
      run: () => {
        props.onClose();
        props.onCreateNew();
      },
    });
    list.push({
      id: 'open-folder',
      title: 'Open Site Folder…',
      subtitle: 'Select any Pillar folder on your disk',
      category: 'Actions',
      icon: 'folder',
      run: () => {
        props.onClose();
        props.onPickFolder();
      },
    });
    list.push({
      id: 'clone-github',
      title: 'Clone from GitHub…',
      subtitle: 'Download a remote repository to local directory',
      category: 'Actions',
      icon: 'github',
      run: () => {
        props.onClose();
        props.onCloneGithub();
      },
    });

    // Recent Sites
    for (const site of props.recentSites) {
      if (site.path === props.serverStatus.site_path) continue;
      list.push({
        id: `site-${site.path}`,
        title: site.name,
        subtitle: site.path,
        category: 'Sites',
        icon: 'site',
        run: () => {
          props.onClose();
          props.onOpenSite(site.path);
        },
      });
    }

    return list;
  };

  const filteredItems = () => {
    const q = query().trim().toLowerCase();
    const all = actions();
    if (!q) return all;
    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isOpen) return;
    const items = filteredItems();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (items.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (items.length || 1)) % (items.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[selectedIndex()];
      if (item) item.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-xs font-sans"
        onClick={() => props.onClose()}
      >
        <div
          class="w-full max-w-lg bg-white border border-[#e1e3e5] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.16)] overflow-hidden text-[#202223] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search bar */}
          <div class="flex items-center px-3.5 py-3 border-b border-[#e1e3e5] gap-2.5">
            <span class="text-[#8c9196] text-sm">⌘</span>
            <input
              ref={inputRef}
              type="text"
              value={query()}
              onInput={(e) => {
                setQuery(e.currentTarget.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or jump to site… (↑↓ to navigate, ↵ to run)"
              class="w-full bg-transparent text-[13.5px] text-[#202223] placeholder:text-[#8c9196] outline-none"
            />
            <span class="text-[11px] font-mono text-[#8c9196] bg-[#f1f2f4] px-1.5 py-0.5 rounded">
              ESC
            </span>
          </div>

          {/* List */}
          <div class="max-h-[340px] overflow-y-auto p-1.5 divide-y divide-transparent">
            <Show
              when={filteredItems().length > 0}
              fallback={
                <div class="p-6 text-center text-xs text-[#6d7175]">
                  No matches found for "{query()}"
                </div>
              }
            >
              <For each={filteredItems()}>
                {(item, idx) => {
                  const isSelected = () => selectedIndex() === idx();
                  return (
                    <div
                      onClick={() => item.run()}
                      onMouseEnter={() => setSelectedIndex(idx())}
                      class={`px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected()
                          ? 'bg-[#005bd3] text-white'
                          : 'hover:bg-[#f6f6f7] text-[#202223]'
                      }`}
                    >
                      <div class="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          class={`p-1.5 rounded-md text-xs shrink-0 ${
                            isSelected()
                              ? 'bg-white/15 text-white'
                              : 'bg-[#f1f2f4] text-[#6d7175]'
                          }`}
                        >
                          <Show when={item.icon === 'code'}>
                            <CodeIcon size={14} />
                          </Show>
                          <Show when={item.icon === 'build'}>
                            <HammerIcon size={14} />
                          </Show>
                          <Show when={item.icon === 'github'}>
                            <GitHubIcon size={14} />
                          </Show>
                          <Show when={item.icon === 'folder'}>
                            <FolderIcon size={14} />
                          </Show>
                          <Show when={item.icon === 'plus'}>
                            <PlusIcon size={14} />
                          </Show>
                          <Show when={item.icon === 'site'}>
                            <FolderIcon size={14} />
                          </Show>
                          <Show when={item.icon === 'close'}>
                            <ArrowSquareOutIcon size={14} />
                          </Show>
                        </div>

                        <div class="flex flex-col min-w-0">
                          <span class="text-xs font-medium truncate leading-tight">
                            {item.title}
                          </span>
                          <span
                            class={`text-[11px] truncate mt-0.5 leading-tight ${
                              isSelected() ? 'text-white/80' : 'text-[#6d7175]'
                            }`}
                          >
                            {item.subtitle}
                          </span>
                        </div>
                      </div>

                      <span
                        class={`text-[10.5px] uppercase font-semibold tracking-wider shrink-0 ${
                          isSelected() ? 'text-white/70' : 'text-[#8c9196]'
                        }`}
                      >
                        {item.category}
                      </span>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
