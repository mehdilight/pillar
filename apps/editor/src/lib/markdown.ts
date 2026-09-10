/**
 * Tidy what the rich editor serialises, without changing what it means.
 *
 * `@tiptap/markdown` writes an extra blank line around some blocks — a table
 * gets two above and two below where the file had one. It renders the same,
 * but every save would add it to the file's diff. Runs of blank lines are
 * collapsed to one, **except inside fenced code**, where blank lines are the
 * code's own and are left exactly as they are.
 */
export function tidyMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];

    if (marker && (fence === null || (marker[0] === fence[0] && marker.length >= fence.length))) {
      fence = fence === null ? marker : null;
      out.push(line);

      continue;
    }

    const blank = line.trim() === '';

    if (fence === null && blank && out.length > 0 && out[out.length - 1].trim() === '') {
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

interface JsonNode {
  type?: string;
  text?: string;
  content?: JsonNode[];
  [key: string]: unknown;
}

/**
 * Soft line breaks become spaces — in the editor's document, not the file.
 *
 * A hard-wrapped paragraph parses into text that contains "\n". ProseMirror
 * shows it (its content is `white-space: pre-wrap`) but does not model it:
 * typing next to one turned it into a hard break, and the saved file gained a
 * trailing-double-space `<br>` the author never asked for. So wrapped lines are
 * joined, as any visual editor does, and the paragraph reflows. Code blocks
 * keep their newlines — there they are the content.
 *
 * Only the visual editor sees this, and nothing is written until an edit: a
 * file merely opened keeps its wrapping, and the Markdown view edits the text
 * exactly as it is.
 */
export function joinSoftBreaks<T extends JsonNode>(node: T): T {
  if (node.type === 'codeBlock') return node;

  const next: JsonNode = { ...node };

  if (typeof next.text === 'string') next.text = next.text.replace(/[ \t]*\n[ \t]*/g, ' ');
  if (Array.isArray(next.content)) next.content = next.content.map((child) => joinSoftBreaks(child));

  return next as T;
}
