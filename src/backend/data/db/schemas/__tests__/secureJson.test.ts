import { randomUUID as mockRandomUUID } from 'node:crypto';

import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as SecureStore from 'expo-secure-store';

import { secureJson } from '../secureJson';

const mockSecrets = new Map<string, string>();
jest.mock('expo-crypto', () => ({ randomUUID: mockRandomUUID }));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  setItem: jest.fn((key: string, value: string) => mockSecrets.set(key, value)),
  getItem: jest.fn((key: string) => mockSecrets.get(key) ?? null),
}));
jest.mock('@/shared/data/activeProfile', () => ({
  profileScopedName: (name: string) => `test.${name}`,
}));

const table = sqliteTable('secret_test', { keys: secureJson<string[]>([])() });

beforeEach(() => {
  mockSecrets.clear();
  jest.clearAllMocks();
});

test('SQLite contains only a reference while the device vault retains the secret', () => {
  const stored = table.keys.mapToDriverValue(['dummy-api-key']);
  expect(stored).not.toContain('dummy-api-key');
  expect(JSON.parse(String(stored))).toMatchObject({ storage: 'slate-secure-json-v1' });
  expect(table.keys.mapFromDriverValue(stored)).toEqual(['dummy-api-key']);
});

test('a missing vault entry requires reconnection instead of treating a reference as a key', () => {
  const stored = table.keys.mapToDriverValue(['dummy-api-key']);
  mockSecrets.clear();
  expect(table.keys.mapFromDriverValue(stored)).toEqual([]);
});

test('legacy exported plaintext credentials are not accepted as live credentials', () => {
  expect(table.keys.mapFromDriverValue('["untrusted-imported-key"]')).toEqual([]);
  expect(SecureStore.getItem).not.toHaveBeenCalled();
});

test('vault write failures abort serialization without falling back to plaintext', () => {
  jest.mocked(SecureStore.setItem).mockImplementationOnce(() => {
    throw new Error('vault locked');
  });
  expect(() => table.keys.mapToDriverValue(['dummy-api-key'])).toThrow('vault locked');
});
