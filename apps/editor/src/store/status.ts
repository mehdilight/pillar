import { createSignal } from 'solid-js';
import { api } from '../api/client';
import type { DraftStatus } from '../types';

/**
 * The working tree's state: what is uncommitted, on which branch.
 *
 * One signal for the whole dashboard. The CMS header and the visual editor's
 * top bar both show "N uncommitted", and two copies of that number would
 * disagree the moment one side saved.
 */
const [status, setStatus] = createSignal<DraftStatus | null>(null);

export { status, setStatus };

export async function refreshStatus(): Promise<DraftStatus> {
  const next = await api.draftStatus();

  setStatus(next);

  return next;
}
