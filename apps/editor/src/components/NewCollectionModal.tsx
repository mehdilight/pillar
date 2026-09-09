import { For, createSignal } from 'solid-js';
import Modal from './ui/Modal';
import TextInput from './ui/TextInput';
import Checkbox from './ui/Checkbox';
import { showToast } from './ui/Toast';
import { api } from '../api/client';

/**
 * Creating a content type.
 *
 * Writes the same three files a person would write by hand — `schemas/<name>.json`,
 * `content/<name>/`, `templates/<singular>.json` — so a type made here and one
 * typed into an editor are the same thing, and either can be edited the other way.
 */

const FIELDS: Array<{ key: string; label: string; hint: string; on: boolean }> = [
  { key: 'title', label: 'Title', hint: 'text', on: true },
  { key: 'date', label: 'Date', hint: 'date', on: true },
  { key: 'summary', label: 'Summary', hint: 'textarea', on: false },
  { key: 'tags', label: 'Tags', hint: 'list', on: true },
  { key: 'image', label: 'Cover image', hint: 'image', on: false },
  { key: 'order', label: 'Position', hint: 'number — orders the list', on: false },
  { key: 'draft', label: 'Draft', hint: 'checkbox — hides it from a build', on: true },
];

export default function NewCollectionModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => void | Promise<void>;
}) {
  const [name, setName] = createSignal('');
  const [label, setLabel] = createSignal('');
  const [chosen, setChosen] = createSignal<string[]>(FIELDS.filter((f) => f.on).map((f) => f.key));
  const [pending, setPending] = createSignal(false);

  // `guides` → entries render through `templates/guide.json`, at `/guides/…`.
  const singular = () => {
    const value = name().trim();

    return value.endsWith('s') ? value.slice(0, -1) : value;
  };

  const toggle = (key: string) =>
    setChosen((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  const create = async () => {
    setPending(true);

    try {
      const result = await api.createCollection({
        name: name().trim(),
        label: label().trim(),
        // Sent in the order they are listed, not the order they were clicked.
        fields: FIELDS.filter((field) => chosen().includes(field.key)).map((field) => field.key),
      });

      showToast(`Created ${result.name}`, 'success');
      await props.onCreated(result.name);
      props.onOpenChange(false);
      setName('');
      setLabel('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the collection', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="New content type"
      footer={
        <>
          <button type="button" class="sam-btn" onClick={() => props.onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            class="sam-btn primary"
            disabled={pending() || name().trim().length < 2}
            onClick={create}
          >
            {pending() ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <TextInput
        label="Name"
        value={name()}
        placeholder="guides"
        info="Plural and lowercase — it becomes the folder and the URL."
        onValue={setName}
      />

      <TextInput
        label="Label"
        value={label()}
        placeholder={name() ? name()[0].toUpperCase() + name().slice(1) : 'Guides'}
        info="What this panel calls it."
        onValue={setLabel}
      />

      <div class="ed-field">
        <span class="ed-group-head">Fields</span>
        <p class="ed-hint" style={{ 'margin-top': '2px' }}>
          The frontmatter form for each entry. Edit them later in{' '}
          <code class="sam-mono">schemas/{name().trim() || 'name'}.json</code>.
        </p>

        <div class="mt-2">
          <For each={FIELDS}>
            {(field) => (
              <Checkbox checked={chosen().includes(field.key)} onValue={() => toggle(field.key)}>
                <span>
                  {field.label} <span class="text-gray-400">— {field.hint}</span>
                </span>
              </Checkbox>
            )}
          </For>
        </div>
      </div>

      <p class="ed-hint">
        Creates <code class="sam-mono">content/{name().trim() || 'name'}/</code>,{' '}
        <code class="sam-mono">schemas/{name().trim() || 'name'}.json</code> and{' '}
        <code class="sam-mono">templates/{singular() || 'name'}.json</code>.
      </p>
    </Modal>
  );
}
