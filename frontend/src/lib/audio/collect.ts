/**
 * Helpers pra coletar arquivos de áudio do browser:
 *   - Filtra por MIME / extensão
 *   - Aceita FileList do <input type="file">
 *   - Aceita DataTransferItemList de drag&drop (incluindo pastas via webkitGetAsEntry)
 */

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|flac|ogg|webm|aac|wma)$/i;

export function isAudioFile(file: File): boolean {
  if (file.type && file.type.toLowerCase().startsWith("audio/")) return true;
  return AUDIO_EXT_RE.test(file.name);
}

export function filterAudioFiles(files: File[]): File[] {
  return files.filter(isAudioFile);
}

/**
 * Lê uma DataTransferItemList (de um drop event) recursivamente.
 * Se algum item é uma pasta, desce em todos os subdiretórios.
 * Filtra automaticamente só áudios.
 */
export async function gatherAudioFromDataTransfer(
  items: DataTransferItemList,
): Promise<File[]> {
  const out: File[] = [];

  // Some browsers expose webkitGetAsEntry; if not, fall back to .getAsFile().
  const tasks: Promise<void>[] = [];
  for (const item of Array.from(items)) {
    const entry = (item as DataTransferItem & {
      webkitGetAsEntry?: () => FileSystemEntry | null;
    }).webkitGetAsEntry?.();

    if (entry) {
      tasks.push(traverseEntry(entry, out));
    } else {
      const file = item.getAsFile();
      if (file && isAudioFile(file)) out.push(file);
    }
  }

  await Promise.all(tasks);
  // Ordena por path/nome pra ordem determinística
  out.sort((a, b) => {
    const pa =
      (a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name;
    const pb =
      (b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name;
    return pa.localeCompare(pb);
  });
  return out;
}

type FsFileEntry = FileSystemEntry & { file: (cb: (f: File) => void, err?: (e: unknown) => void) => void };
type FsDirEntry = FileSystemEntry & {
  createReader: () => { readEntries: (cb: (entries: FileSystemEntry[]) => void, err?: (e: unknown) => void) => void };
};

async function traverseEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => {
      (entry as FsFileEntry).file(
        (f) => resolve(f),
        () => resolve(null),
      );
    });
    if (file && isAudioFile(file)) out.push(file);
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FsDirEntry).createReader();
    // readEntries pode retornar em batches — lê em loop até vir vazio
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(
          (entries) => resolve(entries),
          () => resolve([]),
        );
      });
      await Promise.all(batch.map((e) => traverseEntry(e, out)));
    } while (batch.length > 0);
  }
}
