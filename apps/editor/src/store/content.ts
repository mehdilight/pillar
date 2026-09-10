import { createSignal } from 'solid-js';
import { api } from '../api/client';
import type { ContentCollection } from '../types';

/**
 * The site's collections, shared by the CMS rail and its pages.
 *
 * A signal rather than a per-component resource: creating an entry on one page
 * has to move the count in the rail, and two resources would each only know
 * about their own fetch.
 */
const [collections, setCollections] = createSignal<ContentCollection[] | null>(null);

export { collections };

export async function loadCollections(): Promise<ContentCollection[]> {
  const next = await api.collections();

  setCollections(next);

  return next;
}

export const collectionNamed = (name: string) => collections()?.find((collection) => collection.name === name) ?? null;

/** Where an entry is served — `pages` owns the root, as it does in the build. */
export const entryUrl = (collection: string, slug: string) =>
  `/${collection === 'pages' ? '' : `${collection}/`}${slug}/`;
