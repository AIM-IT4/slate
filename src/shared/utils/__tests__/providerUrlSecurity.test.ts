import { getProviderBaseUrlIssue } from '@cherrystudio/universal/utils/url';

jest.mock('@cherrystudio/provider-registry', () => ({
  ENDPOINT_TYPE: {},
}));

test.each(['http://api.example.com', 'http://127.0.0.1:11434', 'http://192.168.1.10:8080'])(
  'rejects cleartext provider endpoint %s',
  (url) => expect(getProviderBaseUrlIssue(url)).toEqual({ code: 'invalid-url' }),
);

test('accepts an HTTPS provider root without embedded credentials', () => {
  expect(getProviderBaseUrlIssue('https://api.example.com')).toBeNull();
  expect(getProviderBaseUrlIssue('https://user:password@api.example.com')).toEqual({
    code: 'invalid-url',
  });
});
