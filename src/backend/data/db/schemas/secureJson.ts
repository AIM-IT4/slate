import { customType } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { profileScopedName } from '@/shared/data/activeProfile';

const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const STORAGE = 'slate-secure-json-v1';

/** SQLite holds an opaque reference; native device-bound storage holds the credential. */
export function secureJson<T>(empty: T) {
  return customType<{ data: T; driverData: string }>({
    dataType: () => 'text',
    toDriver(value) {
      if (Array.isArray(value) && value.length === 0) return '[]';
      const id = randomUUID();
      SecureStore.setItem(profileScopedName(`slate-secret.${id}`), JSON.stringify(value), OPTIONS);
      return JSON.stringify({ storage: STORAGE, id });
    },
    fromDriver(value) {
      const reference: unknown = JSON.parse(value);
      if (Array.isArray(reference) && reference.length === 0) return empty;
      if (
        typeof reference !== 'object' ||
        reference === null ||
        !('storage' in reference) ||
        reference.storage !== STORAGE ||
        !('id' in reference) ||
        typeof reference.id !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(reference.id)
      ) {
        return empty;
      }
      const stored = SecureStore.getItem(
        profileScopedName(`slate-secret.${reference.id}`),
        OPTIONS,
      );
      return stored === null ? empty : (JSON.parse(stored) as T);
    },
  });
}
