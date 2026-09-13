export interface DiffLine { text: string; number: number }
export interface DiffRow { before?: DiffLine; after?: DiffLine; changed: boolean }
export interface DiffHunk { header: string; rows: DiffRow[] }
export interface DiffFile { path: string; hunks: DiffHunk[]; metadata: string[] }

/** Parse unified patches without treating file headers or missing-newline notes as content. */
export function parseDiff(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let file: DiffFile | undefined;
  let hunk: DiffHunk | undefined;
  let oldLine = 0, newLine = 0;
  let removed: DiffLine[] = [], added: DiffLine[] = [];
  const flush = () => {
    if (hunk) for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      hunk.rows.push({ before: removed[i], after: added[i], changed: true });
    }
    removed = []; added = [];
  };
  const startFile = (path: string) => {
    flush();
    file = { path, hunks: [], metadata: [] }; files.push(file); hunk = undefined;
  };
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      startFile(line.replace(/^diff --git .* b\//, ''));
    } else if (!hunk && line.startsWith('--- ')) {
      if (!file || file.hunks.length) startFile(line.slice(4).replace(/^a\//, ''));
      if (file && line.slice(4) !== '/dev/null') file.path = line.slice(4).replace(/^a\//, '');
    } else if (!hunk && line.startsWith('+++ ')) {
      if (!file) startFile(line.slice(4));
      if (line.slice(4) !== '/dev/null') file!.path = line.slice(4).replace(/^b\//, '');
    } else if (/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)) {
      flush();
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)!;
      if (!file) startFile('');
      oldLine = Number(match[1]); newLine = Number(match[2]);
      hunk = { header: line, rows: [] }; file!.hunks.push(hunk);
    } else if (hunk && line.startsWith('-')) {
      removed.push({ text: line.slice(1), number: oldLine++ });
    } else if (hunk && line.startsWith('+')) {
      added.push({ text: line.slice(1), number: newLine++ });
    } else if (hunk && line.startsWith(' ')) {
      flush();
      hunk.rows.push({ before: { text: line.slice(1), number: oldLine++ }, after: { text: line.slice(1), number: newLine++ }, changed: false });
    } else if (line.startsWith('\\ No newline')) {
      file?.metadata.push(line);
    } else if (line === '') {
      flush(); hunk = undefined;
    } else if (file) {
      file.metadata.push(line);
    }
  }
  flush();
  return files;
}
