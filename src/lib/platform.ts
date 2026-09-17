/**
 * גישה ליכולות הריצה של claude.ai כשהאפליקציה מתפרסמת כ-Artifact.
 * כשהאפליקציה רצה מקומית (npm run dev) אין `window.claude`, וכל הפונקציות
 * כאן נסוגות בחן להתנהגות של דפדפן רגיל.
 */

interface ClaudeRuntime {
  use?: (name: string) => Promise<unknown>;
}

function runtime(): ClaudeRuntime | undefined {
  return (window as unknown as { claude?: ClaudeRuntime }).claude;
}

export async function capability<T>(name: string): Promise<T | null> {
  const claude = runtime();
  if (!claude?.use) return null;
  try {
    return ((await claude.use(name)) as T) ?? null;
  } catch {
    return null;
  }
}

/* ------------------------- שמירת קבצים ------------------------- */

export type SaveResult = 'saved' | 'declined' | 'fallback';

interface DownloadsApi {
  save(req: { filename: string; data: string | Blob }): Promise<unknown>;
}

/**
 * מוריד קובץ למשתמש. בתוך Artifact הורדות רגילות חסומות, ולכן משתמשים
 * ביכולת `downloads`; בדפדפן רגיל נופלים חזרה לקישור הורדה.
 */
export async function saveFile(filename: string, content: string, mime: string): Promise<SaveResult> {
  const downloads = await capability<DownloadsApi>('downloads');
  if (downloads?.save) {
    try {
      await downloads.save({ filename, data: content });
      return 'saved';
    } catch {
      return 'declined';
    }
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'fallback';
}

/* ------------------------- אחסון משותף ------------------------- */

export interface DocSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

export interface DocRef {
  get(): Promise<DocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  onSnapshot(next: (snap: DocSnapshot) => void, error?: (e: unknown) => void): () => void;
}

export interface DbApi {
  doc(path: string): DocRef;
}

export const SHARED_DOC_PATH = 'data/household';

export function getSharedDoc(): Promise<DocRef | null> {
  return capability<DbApi>('db').then((db) => {
    if (!db?.doc) return null;
    try {
      return db.doc(SHARED_DOC_PATH);
    } catch {
      return null;
    }
  });
}
