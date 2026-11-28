import { encodedFileExtension, readEncodedFile } from '../encodedFile';

const jpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/';

it('recognizes the JPEG JSON returned by file APIs without a declared MIME type', () => {
  expect(readEncodedFile(JSON.stringify({ content: jpeg }))).toMatchObject({
    data: jpeg,
    mediaType: 'image/jpeg',
    metadata: {},
    bytes: 21,
  });
  expect(
    readEncodedFile({ content: jpeg, mimeType: 'text/plain', filename: 'photo.jpg' }),
  ).toMatchObject({ mediaType: 'image/jpeg', name: 'photo.jpg' });
  expect(encodedFileExtension('image/jpeg')).toBe('jpg');
});

it('accepts explicit text and audio envelopes and uses magic bytes ahead of labels', () => {
  expect(readEncodedFile('data:text/plain;base64,aGVsbG8=')).toMatchObject({
    mediaType: 'text/plain',
    bytes: 5,
    data: 'aGVsbG8=',
  });
  expect(
    readEncodedFile({ data: 'UklGRgAAAABXQVZF', encoding: 'base64', mediaType: 'audio/wav' }),
  ).toMatchObject({ mediaType: 'audio/wav' });
  expect(readEncodedFile({ blob: 'JVBERi0xLjQK', mediaType: 'text/plain' })).toMatchObject({
    mediaType: 'application/pdf',
  });
});

it.each([
  'hello',
  'aGVsbG8=',
  'Example: {"content":"/9j/"}',
  '```json\n{"content":"/9j/"}\n```',
  '{"content":"ordinary text"}',
  { content: 'aGVsbG8=' },
  { content: jpeg, encoding: 'utf8' },
  { data: 'A', encoding: 'base64', mimeType: 'image/png' },
  { data: '%%%invalid%%%', encoding: 'base64', mimeType: 'image/png' },
  null,
])('preserves prose, code examples, ambiguous strings and malformed input: %p', (value) => {
  expect(readEncodedFile(value)).toBeUndefined();
});

it('bounds payloads and avoids using a path as a display name', () => {
  expect(readEncodedFile({ content: jpeg, data: `${jpeg}\n`, status: 'ok' })?.metadata).toEqual({
    status: 'ok',
  });
  expect(readEncodedFile({ content: jpeg, name: '../../photo.jpg' })?.name).toBeUndefined();
  expect(readEncodedFile({ content: jpeg + 'A'.repeat(12 * 1024 * 1024) })).toBeUndefined();
  expect(
    readEncodedFile({ content: jpeg, _meta: { secret: true }, status: 'ok' })?.metadata,
  ).toEqual({ status: 'ok' });
});
