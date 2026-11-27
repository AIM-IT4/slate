import {
  allowInlineHtmlNavigation,
  escapeArtifactAttribute,
  inlineArtifactKind,
  inlineHtmlDocument,
} from '../inlineArtifacts';
import { markdownArtifactLinks } from '../markdownArtifactLinks';

describe('inline artifact delivery', () => {
  test.each([
    ['https://files.example/plot.HTML?signature=abc', undefined, 'html'],
    ['https://files.example/stream?id=123', 'video/mp4', 'video'],
    ['https://files.example/voice.mp3', undefined, 'audio'],
    ['https://files.example/file', 'text/html; charset=utf-8', 'html'],
    ['https://files.example/picture.png', undefined, 'image'],
    ['https://example.com/', undefined, undefined],
    ['http://files.example/plot.html', 'text/html', undefined],
    ['file:///private/plot.html', 'text/html', undefined],
    ['javascript:alert(1)', 'text/html', undefined],
    ['https://user:secret@example.com/plot.html', undefined, undefined],
    ['mcp://workspace/plot.html', 'text/html', undefined],
  ])('classifies %s without widening supported URL schemes', (uri, mime, kind) => {
    expect(inlineArtifactKind(uri, mime)).toBe(kind);
  });
  test('keeps artifact scripts inside an opaque sandbox without app or local file access', () => {
    const untrusted =
      '<script>window.top.location="file:///private"</script><div title="quoted">&</div>';
    const html = inlineHtmlDocument({ html: untrusted });
    expect(html).toContain('sandbox="allow-scripts"');
    expect(html).not.toContain('allow-same-origin');
    expect(html).not.toContain('<script>');
    expect(html).toContain(escapeArtifactAttribute(untrusted));
    expect(html).toContain('referrerpolicy="no-referrer"');
  });
  test('blocks native schemes and top navigation while permitting HTTPS chart dependencies', () => {
    expect(allowInlineHtmlNavigation('about:srcdoc')).toBe(true);
    expect(allowInlineHtmlNavigation('https://files.example/plot.html', false)).toBe(true);
    expect(allowInlineHtmlNavigation('https://example.com/', true)).toBe(false);
    for (const uri of [
      'file:///private',
      'data:text/html,hello',
      'intent://app',
      'javascript:alert(1)',
      'https://user:secret@example.com/',
    ]) {
      expect(allowInlineHtmlNavigation(uri, false)).toBe(false);
    }
  });
  test('finds delivered file links, preserves signed query parameters and excludes code examples', () => {
    const markdown =
      '[Chart](https://files.example/chart.html?token=abc&v=1)\n[Same chart](https://files.example/chart.html?token=abc&v=1)\n[Voice](https://files.example/voice.mp3)\n[Website](https://example.com)\n`[Example](https://files.example/no.html)`\n```html\n[Example](https://files.example/no2.html)\n```\n![Image](https://files.example/image.png)';
    expect(markdownArtifactLinks(markdown)).toEqual([
      { uri: 'https://files.example/chart.html?token=abc&v=1', name: 'Chart' },
      { uri: 'https://files.example/voice.mp3', name: 'Voice' },
    ]);
  });
  test('bounds the number of simultaneously instantiated file previews', () => {
    expect(
      markdownArtifactLinks(
        Array.from({ length: 20 }, (_, i) => `[Video ${i}](https://files.example/${i}.mp4)`).join(
          '\n',
        ),
      ),
    ).toHaveLength(4);
  });
});
