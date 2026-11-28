import type { FileText } from '@/frontend/utils/readFileText';
import { decodeEncodedText, readEncodedFile } from '@/shared/utils/encodedFile';

export type InlineTextFileContent =
  | { kind: 'text'; text: string }
  | { kind: 'image'; uri: string }
  | { kind: 'audio'; data: string; mediaType: string }
  | { kind: 'file' };

export function isLegacyMcpTextFile(name: string): boolean {
  return name.toLowerCase() === 'mcp-result.txt';
}

/** Repair old display projections without rewriting their stored TXT files or executing their contents. */
export function inlineTextFileContent(name: string, value: FileText): InlineTextFileContent {
  if (isLegacyMcpTextFile(name)) {
    const file = !value.isTruncated ? readEncodedFile(value.text) : undefined;
    if (file?.mediaType.startsWith('image/'))
      return { kind: 'image', uri: `data:${file.mediaType};base64,${file.data}` };
    if (file?.mediaType.startsWith('audio/'))
      return { kind: 'audio', data: file.data, mediaType: file.mediaType };
    if (file?.mediaType.startsWith('text/') || file?.mediaType === 'application/json') {
      return { kind: 'text', text: decodeEncodedText(file)?.slice(0, 1600) ?? '' };
    }
    if (
      file ||
      /"(?:content|data|base64|blob)"\s*:\s*"(?:\/9j\/|iVBORw0KGgo|R0lGOD|data:[^" ]+;base64,)/.test(
        value.text.slice(0, 1024),
      )
    )
      return { kind: 'file' };
  }
  return { kind: 'text', text: value.text.slice(0, 1600) };
}
