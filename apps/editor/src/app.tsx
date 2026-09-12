/* @refresh reload */
import { t } from './i18n';
import { lazy, onMount, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { Route, Router } from '@solidjs/router';
import Layout from './cms/Layout';
import Toast, { showToast } from './components/ui/Toast';
import { api } from './api/client';
import { installHost, loadPlugins } from './plugins/host';
import './css/app.css';

/**
 * Two applications behind one router.
 *
 * The CMS — content, media, settings, publishing — lives under a shared shell.
 * The visual editor at `/editor/:template` is a separate full-screen tool with
 * its own chrome, and deliberately outside that shell: it is where the site's
 * look is edited, not its content.
 *
 * Plugins load once, here, for both: their panels can appear in either.
 */
function Root(props: { children?: JSX.Element }) {
  onMount(() => {
    // The host runtime is published before any bundle loads — a bundle reads
    // it the moment it executes.
    installHost();

    void api
      .editorPlugins()
      .then(loadPlugins)
      .then((failures) =>
        failures.forEach(({ slug, error }) => showToast(t("Plugin \"{{v0}}\" did not load: {{v1}}", { v0: slug, v1: error }), 'error'))
      )
      .catch(() => undefined);
  });

  return (
    <>
      <Toast />
      {props.children}
    </>
  );
}

// Each screen is its own chunk, fetched on first visit: the visual editor's
// drag and drop and menus, the field builder, the media library — none of it
// is needed to show the overview.
const Overview = lazy(() => import('./cms/pages/Overview'));
const Collection = lazy(() => import('./cms/pages/Collection'));
const Entry = lazy(() => import('./cms/pages/Entry'));
const Types = lazy(() => import('./cms/pages/Types'));
const Media = lazy(() => import('./cms/pages/Media'));
const Settings = lazy(() => import('./cms/pages/Settings'));
const Publish = lazy(() => import('./cms/pages/Publish'));
const Menus = lazy(() => import('./cms/pages/Menus'));
const NotFound = lazy(() => import('./cms/pages/NotFound'));
const EditorScreen = lazy(() => import('./editor/EditorScreen'));

const root = document.getElementById('pillar-root');

if (!root) throw new Error(t("#pillar-root is missing from the page"));

render(
  () => (
    <Router root={Root}>
      <Route path="/editor/:template?" component={EditorScreen} />
      <Route path="/" component={Layout}>
        <Route path="/" component={Overview} />
        <Route path="/content/:collection" component={Collection} />
        <Route path="/content/:collection/new" component={Entry} />
        <Route path="/content/:collection/:slug" component={Entry} />
        <Route path="/types" component={Types} />
        <Route path="/media" component={Media} />
        <Route path="/menus" component={Menus} />
        <Route path="/menus/:handle" component={Menus} />
        <Route path="/settings" component={Settings} />
        <Route path="/publish" component={Publish} />
        <Route path="*" component={NotFound} />
      </Route>
    </Router>
  ),
  root
);
