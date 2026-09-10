/* @refresh reload */
import { onMount, type JSX } from 'solid-js';
import { render } from 'solid-js/web';
import { Route, Router } from '@solidjs/router';
import Layout from './cms/Layout';
import Overview from './cms/pages/Overview';
import Collection from './cms/pages/Collection';
import Entry from './cms/pages/Entry';
import Types from './cms/pages/Types';
import Media from './cms/pages/Media';
import Settings from './cms/pages/Settings';
import Publish from './cms/pages/Publish';
import Menus from './cms/pages/Menus';
import NotFound from './cms/pages/NotFound';
import EditorScreen from './editor/EditorScreen';
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
        failures.forEach(({ slug, error }) => showToast(`Plugin "${slug}" did not load: ${error}`, 'error'))
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

const root = document.getElementById('pillar-root');

if (!root) throw new Error('#pillar-root is missing from the page');

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
