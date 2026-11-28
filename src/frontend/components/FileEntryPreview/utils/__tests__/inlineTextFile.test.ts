import { inlineTextFileContent } from '../inlineTextFile';

const jpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/';
const input = (text: string, isTruncated = false) => ({ text, isTruncated });

it('recovers old MCP JPEG wrappers as inline images without changing ordinary JSON files', () => {
  const text = JSON.stringify({ content: jpeg });
  expect(inlineTextFileContent('mcp-result.txt', input(text))).toEqual({
    kind: 'image',
    uri: `data:image/jpeg;base64,${jpeg}`,
  });
  expect(inlineTextFileContent('example.json', input(text))).toEqual({ kind: 'text', text });
});

it('never prints truncated encoded payloads, while leaving the file card available', () => {
  expect(inlineTextFileContent('mcp-result.txt', input('{"content":"/9j/AAAA', true))).toEqual({
    kind: 'file',
  });
  expect(inlineTextFileContent('mcp-result.txt', input('{"content":"/9j/AAAA'))).toEqual({
    kind: 'file',
  });
  expect(inlineTextFileContent('mcp-result.txt', input('{"blob":"JVBERi0xLjQK"}'))).toEqual({
    kind: 'file',
  });
});

it('recovers encoded audio and text but treats encoded HTML as plain text', () => {
  expect(
    inlineTextFileContent(
      'mcp-result.txt',
      input('{"content":"data:audio/wav;base64,UklGRgAAAABXQVZF"}'),
    ),
  ).toEqual({ kind: 'audio', data: 'UklGRgAAAABXQVZF', mediaType: 'audio/wav' });
  expect(
    inlineTextFileContent(
      'mcp-result.txt',
      input('{"content":"data:text/html;base64,PGgxPmhpPC9oMT4="}'),
    ),
  ).toEqual({ kind: 'text', text: '<h1>hi</h1>' });
});

it('keeps normal TXT and code readable within the compact preview budget', () => {
  const code = 'const content = "hello";\n'.repeat(100);
  expect(inlineTextFileContent('script.txt', input(code))).toEqual({
    kind: 'text',
    text: code.slice(0, 1600),
  });
  expect(inlineTextFileContent('mcp-result.txt', input('useful tool output'))).toEqual({
    kind: 'text',
    text: 'useful tool output',
  });
});
