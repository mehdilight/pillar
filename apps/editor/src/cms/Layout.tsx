import { For, Show, createSignal, onMount, type JSX } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import {
  ExternalLink,
  ContentTypeIcon,
  Folder,
  GitBranch,
  House,
  Images,
  Layers,
  ListTree,
  Menu,
  PaintbrushVertical,
  Settings,
  Upload,
} from '../components/ui/Icons';
import { editorConfig } from '../api/client';
import { refreshStatus, status } from '../store/status';
import { collections, loadCollections } from '../store/content';

/**
 * The CMS shell: bastet's admin layout — a dark 56px header, a grey rail, the
 * page on the canvas. Content, media, settings and publishing live here; the
 * visual editor is a separate full-screen tool, reached from "Customize".
 */
export default function Layout(props: { children?: JSX.Element }) {
  const [navOpen, setNavOpen] = createSignal(false);

  onMount(() => {
    void refreshStatus().catch(() => undefined);
    void loadCollections().catch(() => undefined);
  });

  return (
    <div class="ds-root min-h-screen bg-canvas pt-14 [--sticky-top:3.5rem]">
      <Header onToggle={() => setNavOpen(!navOpen())} />
      <Sidebar open={navOpen()} onClose={() => setNavOpen(false)} />
      <Show when={navOpen()}>
        <div class="fixed inset-0 top-14 bottom-0 z-30 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
      </Show>
      <main class="min-w-0 md:ms-56">{props.children}</main>
    </div>
  );
}

const headerButton =
  'h-8 cursor-pointer flex items-center gap-2 text-gray-200 rounded-md hover:text-white focus:text-white hover:bg-[#272626] focus:bg-[#272626] px-2.5 text-xs outline-none hover:inset-shadow-xs hover:inset-shadow-gray-600 transition-colors';

function Header(props: { onToggle: () => void }) {
  const pending = () => status()?.count ?? 0;

  return (
    <header class="fixed top-0 inset-x-0 z-50 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_2fr_1fr] items-center bg-[#1a1a1a] border-b border-[#2c2d30] px-3.5 text-sm h-14 text-white">
      <div class="flex items-center min-w-0 gap-2">
        <button
          onClick={props.onToggle}
          class="md:hidden me-1 h-8 w-8 flex items-center justify-center cursor-pointer text-gray-200 rounded-md hover:text-white hover:bg-[#272626]"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
        <span class="font-semibold text-base tracking-tight">Pillar</span>
        <span class="hidden sm:inline text-gray-500">/</span>
        <span class="hidden sm:inline truncate text-gray-300 text-[13px]">{editorConfig.siteName}</span>
      </div>

      <div class="hidden md:flex justify-center">
        <A
          href="/publish"
          class="h-7 inline-flex items-center gap-2 rounded-full border px-3 text-[11.5px] font-medium transition-colors"
          classList={{
            'border-amber-400/30 bg-amber-400/15 text-amber-300 hover:bg-amber-400/25': pending() > 0,
            'border-[#3e4045] bg-[#2c2d30] text-gray-300 hover:text-white': pending() === 0,
          }}
          title="Changes and history"
        >
          <GitBranch size={13} />
          <span class="font-mono">{status()?.branch ?? 'main'}</span>
          <span>{pending() > 0 ? `${pending()} uncommitted` : 'Committed'}</span>
        </A>
      </div>

      <div class="flex justify-end items-center gap-1.5">
        <a href="/preview/" target="_blank" rel="noopener" class={headerButton} title="Open the site">
          <ExternalLink size={14} />
          <span class="hidden sm:inline">View site</span>
        </a>
        <A
          href="/editor"
          class="h-8 inline-flex items-center gap-1.5 rounded-md bg-white text-[#1a1a1a] px-3 text-xs font-semibold hover:bg-gray-100 transition-colors"
        >
          <PaintbrushVertical size={14} />
          <span>Customize</span>
        </A>
      </div>
    </header>
  );
}

const itemClass = (active: boolean) =>
  `flex items-center py-1.5 px-3.5 gap-2.5 rounded-md font-medium text-[13px] transition-colors ${
    active
      ? 'bg-white text-[#1a1a1a] shadow-xs font-semibold'
      : 'text-[#4a4a4a] hover:bg-[#f7f7f7] hover:text-[#1a1a1a] focus:bg-[#f7f7f7]'
  }`;

const iconClass = (active: boolean) => `shrink-0 ${active ? 'text-[#1a1a1a]' : 'text-[#707070]'}`;

function Sidebar(props: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(to + '/');

  const Item = (item: { to: string; label: string; icon: (active: boolean) => JSX.Element; count?: number }) => (
    <li>
      <A
        href={item.to}
        onClick={props.onClose}
        aria-current={isActive(item.to) ? 'page' : undefined}
        class={itemClass(isActive(item.to))}
      >
        {item.icon(isActive(item.to))}
        <span class="truncate flex-1">{item.label}</span>
        <Show when={item.count !== undefined}>
          <span class="text-[11px] tabular-nums text-[#8a8a8a]">{item.count}</span>
        </Show>
      </A>
    </li>
  );

  return (
    <aside
      class="fixed top-14 start-0 bottom-0 z-40 w-56 px-1.5 py-4 bg-[#ebebeb] text-sm overflow-y-auto shadow-ds-lg md:shadow-none md:block"
      classList={{ block: props.open, hidden: !props.open }}
    >
      <ul class="space-y-0.5">
        <Item to="/" label="Overview" icon={(a) => <House size={18} class={iconClass(a)} />} />
      </ul>

      <p class="mt-5 mb-1.5 px-3.5 text-[11px] font-semibold uppercase tracking-[.05em] text-[#8a8a8a]">Content</p>
      <ul class="space-y-0.5">
        <For each={collections() ?? []}>
          {(collection) => (
            <Item
              to={`/content/${collection.name}`}
              label={collection.label}
              count={collection.count}
              icon={(a) => <ContentTypeIcon name={collection.icon} size={18} class={iconClass(a)} />}
            />
          )}
        </For>
        <Item to="/types" label="Content types" icon={(a) => <Folder size={18} class={iconClass(a)} />} />
        <Item to="/media" label="Media" icon={(a) => <Images size={18} class={iconClass(a)} />} />
        <Item to="/menus" label="Navigation" icon={(a) => <ListTree size={18} class={iconClass(a)} />} />
      </ul>

      <p class="mt-5 mb-1.5 px-3.5 text-[11px] font-semibold uppercase tracking-[.05em] text-[#8a8a8a]">Site</p>
      <ul class="space-y-0.5">
        <Item to="/editor" label="Customize" icon={(a) => <Layers size={18} class={iconClass(a)} />} />
        <Item to="/publish" label="Publish" count={status()?.count || undefined} icon={(a) => <Upload size={18} class={iconClass(a)} />} />
        <Item to="/settings" label="Settings" icon={(a) => <Settings size={18} class={iconClass(a)} />} />
      </ul>
    </aside>
  );
}
