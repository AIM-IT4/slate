import type { SQLiteDatabase } from 'expo-sqlite';

/** Both exported and imported snapshots require a fresh grant of device credentials. */
export async function stripBackupSecrets(db: Pick<SQLiteDatabase, 'runAsync'>): Promise<void> {
  await db.runAsync("UPDATE user_provider SET api_keys = '[]', auth_config = NULL");
  await db.runAsync(
    "UPDATE user_provider SET provider_settings = json_remove(provider_settings, '$.extraHeaders') WHERE json_valid(provider_settings)",
  );
  await db.runAsync("UPDATE mcp_server SET headers = NULL, is_active = 0 WHERE origin = 'remote'");
  await db.runAsync("DELETE FROM preference WHERE key = 'chat.web_search.provider_overrides'");
}
