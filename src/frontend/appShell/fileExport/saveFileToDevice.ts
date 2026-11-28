import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import type { ResolvedFile } from '@/shared/contracts/file';

/** Copy original bytes through the native filesystem into a user-selected folder. */
export async function saveFileToDevice(file: ResolvedFile, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  const source = new File(file.uri);
  if (!source.exists) throw new Error('Save source is unavailable');
  const directory = await Directory.pickDirectoryAsync();
  signal?.throwIfAborted();
  const existing = new Set(directory.info().files ?? []);
  const name = file.entry.filename;
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot) : '';
  const stem = dot > 0 ? name.slice(0, dot) : name;
  for (let index = 0; index < 100; index++) {
    const suffix = index ? ` (${index})${extension}` : extension;
    const filename = index ? `${stem.slice(0, Math.max(1, 255 - suffix.length))}${suffix}` : name;
    if (existing.has(filename)) continue;
    // Content-provider document IDs are opaque: copy a correctly named local file into
    // the picked Directory, letting native SAF create the document rather than guessing a URI.
    const staging = new Directory(Paths.cache, 'DeviceFileExports', randomUUID());
    try {
      staging.create({ intermediates: true });
      const named = new File(staging, filename);
      await source.copy(named, { overwrite: false });
      signal?.throwIfAborted();
      // Native copy streams complete files without loading videos into JS or altering audio.
      // A concurrent destination creation must fail instead of replacing another file.
      await named.copy(directory, { overwrite: false });
      return filename;
    } finally {
      try {
        if (staging.exists) staging.delete();
      } catch {
        /* OS cache cleanup can be retried later. */
      }
    }
  }
  throw new Error('No unused destination filename');
}
