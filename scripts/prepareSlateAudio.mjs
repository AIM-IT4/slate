import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  await readFile(path.join(root, 'src/backend/services/voice/videoAudio/modelAssets.json'), 'utf8'),
);
const destination = path.join(root, 'android/app/src/main/assets/slate-whisper');
await mkdir(destination, { recursive: true });
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
for (const file of manifest.files) {
  const target = path.join(destination, file.name);
  if (
    await stat(target)
      .then((s) => s.size === file.bytes)
      .catch(() => false)
  ) {
    if ((await digest(target)) === file.sha256) continue;
  }
  const temporary = target + '.part';
  try {
    const url = `https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny/resolve/${manifest.revision}/${file.name}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!response.ok || !response.body) throw new Error(`Model download failed: ${file.name}`);
    let received = 0;
    const bounded = new Transform({
      transform(chunk, _encoding, done) {
        received += chunk.length;
        done(
          received > file.bytes ? new Error('Model download exceeds its verified size') : null,
          chunk,
        );
      },
    });
    await pipeline(Readable.fromWeb(response.body), bounded, createWriteStream(temporary));
    if ((await stat(temporary)).size !== file.bytes || (await digest(temporary)) !== file.sha256)
      throw new Error(`Model verification failed: ${file.name}`);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}
await copyFile(
  path.join(root, 'scripts/slateAudioNOTICE.txt'),
  path.join(destination, 'NOTICE.txt'),
);
console.log('Verified bundled Slate audio models.');
