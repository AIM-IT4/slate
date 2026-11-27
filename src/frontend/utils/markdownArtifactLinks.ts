import MarkdownIt from 'markdown-it';

import { inlineArtifactKind } from './inlineArtifacts';

const parser = new MarkdownIt({ html: false, linkify: false });

/** Parse links, never fenced examples, inline code, images, or ordinary web pages. */
export function markdownArtifactLinks(markdown: string): { uri: string; name: string }[] {
  const links = new Map<string, string>();
  for (const block of parser.parse(markdown, {})) {
    if (block.type !== 'inline') continue;
    const children = block.children ?? [];
    for (let index = 0; index < children.length; index++) {
      const token = children[index];
      if (token?.type !== 'link_open') continue;
      const uri = token.attrGet('href');
      if (typeof uri !== 'string' || !inlineArtifactKind(uri)) continue;
      // Markdown images already render in the text renderer.
      if (inlineArtifactKind(uri) === 'image') continue;
      let name = '';
      for (
        let next = index + 1;
        next < children.length && children[next]?.type !== 'link_close';
        next++
      ) {
        name += children[next]?.content ?? '';
      }
      if (!links.has(uri)) links.set(uri, name || uri.split('?')[0]?.split('/').pop() || uri);
      if (links.size >= 4) return Array.from(links, ([uri, name]) => ({ uri, name }));
    }
  }
  return Array.from(links, ([uri, name]) => ({ uri, name }));
}
