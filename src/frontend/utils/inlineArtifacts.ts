export type InlineArtifactKind = 'html' | 'video' | 'audio' | 'image';

const extensions: Record<string, InlineArtifactKind> = {
  html: 'html',
  htm: 'html',
  mp4: 'video',
  m4v: 'video',
  webm: 'video',
  mov: 'video',
  mp3: 'audio',
  m4a: 'audio',
  wav: 'audio',
  ogg: 'audio',
  oga: 'audio',
  flac: 'audio',
  aac: 'audio',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  svg: 'image',
};

/** Only explicit HTTPS artifact links load automatically; ordinary websites stay links. */
export function inlineArtifactKind(
  uri: string,
  mediaType?: string,
): InlineArtifactKind | undefined {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'https:' || url.username || url.password) return;
    const mime = mediaType?.split(';')[0]?.trim().toLowerCase();
    if (mime === 'text/html' || mime === 'application/xhtml+xml') return 'html';
    if (mime?.startsWith('video/')) return 'video';
    if (mime?.startsWith('audio/')) return 'audio';
    if (mime?.startsWith('image/')) return 'image';
    const extension = url.pathname.split('.').pop()?.toLowerCase();
    return extension ? extensions[extension] : undefined;
  } catch {
    return;
  }
}

export function escapeArtifactAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Opaque sandbox origin: chart scripts have no access to the app, cookies, or local files. */
export function inlineHtmlDocument(source: { html: string } | { uri: string }): string {
  const attribute =
    'html' in source
      ? `srcdoc="${escapeArtifactAttribute(source.html)}"`
      : `src="${escapeArtifactAttribute(source.uri)}"`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;width:100%;height:100%;border:0}</style></head><body><iframe sandbox="allow-scripts" referrerpolicy="no-referrer" ${attribute}></iframe></body></html>`;
}

export function allowInlineHtmlNavigation(url: string, isTopFrame = true): boolean {
  if (
    url === 'about:blank' ||
    url === 'about:srcdoc' ||
    url.startsWith('about:blank#') ||
    url.startsWith('about:srcdoc#')
  )
    return true;
  if (isTopFrame) return false;
  try {
    const value = new URL(url);
    return value.protocol === 'https:' && !value.username && !value.password;
  } catch {
    return false;
  }
}
