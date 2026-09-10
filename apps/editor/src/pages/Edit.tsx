import { Match, Show, Switch, createSignal, onCleanup, onMount } from 'solid-js';
import TopBar from '../components/TopBar';
import LeftSidebar from '../components/LeftSidebar';
import SiteSettingsPanel from '../components/SiteSettingsPanel';
import ContentPanel from '../components/ContentPanel';
import ContentEditor from '../components/ContentEditor';
import Canvas from '../components/Canvas';
import MediaLibrary from '../components/MediaLibrary';
import Toast, { showToast } from '../components/ui/Toast';
import * as editor from '../store/editor';
import { api, isOffline } from '../api/client';
import { installHost, loadPlugins } from '../plugins/host';
import type { ContentItem } from '../types';

export default function Edit() {
  const [item, setItem] = createSignal<ContentItem | null>(null);

  onMount(async () => {
    // Plugins' dashboard bundles, for the plugins this site enables. The host
    // runtime is published first: a bundle reads it the moment it executes.
    installHost();

    void api
      .editorPlugins()
      .then(loadPlugins)
      .then((failures) =>
        failures.forEach(({ slug, error }) => showToast(`Plugin "${slug}" did not load: ${error}`, 'error'))
      );

    editor.setOfflineFlag(await isOffline());
    await editor.load(location.hash.replace(/^#\/?/, '') || 'index');
  });

  // Clicking a section in the canvas selects it here, and vice versa.
  onMount(() => onCleanup(editor.listenToPreview()));

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (!meta) return;

      // Inside a text field, ⌘Z means the words being typed — not the section
      // edited before them. Let the field keep its own undo.
      const target = event.target as HTMLElement | null;

      if (event.key.toLowerCase() === 'z') {
        if (target?.closest('input, textarea, [contenteditable="true"]')) return;

        event.preventDefault();
        event.shiftKey ? editor.redo() : editor.undo();

        return;
      }

      if (event.key === '1') editor.setTab('sections');
      if (event.key === '2') editor.setTab('settings');
      if (event.key === '3') editor.setTab('content');
      if (event.key === '4') editor.setTab('media');
    };

    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  return (
    <div class="h-screen w-full bg-[#f1f2f4] flex flex-col font-sans antialiased overflow-hidden select-none">
      <Toast />
      <TopBar />

      <Show
        when={!editor.loading()}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="text-gray-500 text-sm font-medium">Loading the site…</div>
          </div>
        }
      >
        <Show when={editor.tab() === 'media'} fallback={
        <div class="flex-1 grid grid-cols-[300px_1fr] overflow-hidden min-h-0">
          <Switch>
            <Match when={editor.tab() === 'sections'}>
              <LeftSidebar />
            </Match>
            <Match when={editor.tab() === 'settings'}>
              <SiteSettingsPanel />
            </Match>
            <Match when={editor.tab() === 'content'}>
              <ContentPanel selected={item()} onSelect={setItem} />
            </Match>
          </Switch>

          <main class="flex flex-col overflow-hidden bg-[#f1f2f4] min-h-0">
            <Show when={editor.tab() === 'content' && item()} fallback={<Canvas />}>
              {(selected) => <ContentEditor item={selected()} />}
            </Show>
          </main>
        </div>
        }>
          <MediaLibrary />
        </Show>
      </Show>
    </div>
  );
}
