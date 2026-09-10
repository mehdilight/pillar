import { Match, Show, Switch, createEffect, on, onCleanup, onMount } from 'solid-js';
import { useParams } from '@solidjs/router';
import TopBar from './TopBar';
import LeftSidebar from './LeftSidebar';
import ThemeSettingsPanel from './ThemeSettingsPanel';
import Canvas from './Canvas';
import * as editor from '../store/editor';
import { isOffline } from '../api/client';

/**
 * The visual editor: a page's sections beside a live preview, and the theme's
 * settings.
 *
 * Deliberately only that. Content, media, plugin settings and publishing
 * history are the CMS's; this is the tool for how the site *looks*, full
 * screen, with its own chrome, reached from "Customize" and left by its exit
 * button. The page being edited is the route — `/editor/about` — so it can be
 * linked, reloaded and navigated back to.
 */
export default function EditorScreen() {
  const params = useParams<{ template?: string }>();

  onMount(async () => editor.setOfflineFlag(await isOffline()));

  createEffect(on(() => params.template, (template) => void editor.load(template || 'index')));

  // Clicking a section in the canvas selects it here, and vice versa.
  onMount(() => onCleanup(editor.listenToPreview()));

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;

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
    };

    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  return (
    <div class="pillar-editor-root h-screen w-full bg-[#f1f2f4] flex flex-col font-sans antialiased overflow-hidden select-none">
      <TopBar />

      <Show
        when={!editor.loading()}
        fallback={
          <div class="flex-1 flex items-center justify-center">
            <div class="text-gray-500 text-sm font-medium">Loading the page…</div>
          </div>
        }
      >
        <div class="flex-1 grid grid-cols-[300px_1fr] overflow-hidden min-h-0">
          <Switch>
            <Match when={editor.tab() === 'sections'}>
              <LeftSidebar />
            </Match>
            <Match when={editor.tab() === 'settings'}>
              <ThemeSettingsPanel />
            </Match>
          </Switch>

          <main class="flex flex-col overflow-hidden bg-[#f1f2f4] min-h-0">
            <Canvas />
          </main>
        </div>
      </Show>
    </div>
  );
}
