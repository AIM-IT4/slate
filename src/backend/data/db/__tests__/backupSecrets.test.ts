import { DatabaseSync } from 'node:sqlite';

import { stripBackupSecrets } from '../backupSecrets';

test('personal snapshots retain conversations but strip provider, MCP and search credentials', async () => {
  const raw = new DatabaseSync(':memory:');
  try {
    raw.exec(`
      CREATE TABLE user_provider (api_keys TEXT, auth_config TEXT, provider_settings TEXT);
      CREATE TABLE mcp_server (headers TEXT, is_active INTEGER, origin TEXT);
      CREATE TABLE preference (key TEXT, value TEXT);
      CREATE TABLE conversation (text TEXT);
      INSERT INTO user_provider VALUES ('dummy-api-key', 'dummy-auth-secret', '{"extraHeaders":{"Authorization":"dummy-header"},"summaryText":"keep"}');
      INSERT INTO mcp_server VALUES ('dummy-mcp-token', 1, 'remote');
      INSERT INTO preference VALUES ('chat.web_search.provider_overrides', 'dummy-search-key');
      INSERT INTO preference VALUES ('ui.theme_mode', 'light');
      INSERT INTO conversation VALUES ('Keep this conversation');
    `);
    const db = {
      runAsync: async (sql: string) => {
        const r = raw.prepare(sql).run();
        return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
      },
    };
    await stripBackupSecrets(db);
    expect(raw.prepare('SELECT * FROM user_provider').get()).toEqual({
      api_keys: '[]',
      auth_config: null,
      provider_settings: '{"summaryText":"keep"}',
    });
    expect(raw.prepare('SELECT headers, is_active FROM mcp_server').get()).toEqual({
      headers: null,
      is_active: 0,
    });
    expect(raw.prepare('SELECT * FROM preference').all()).toEqual([
      { key: 'ui.theme_mode', value: 'light' },
    ]);
    expect(raw.prepare('SELECT * FROM conversation').get()).toEqual({
      text: 'Keep this conversation',
    });
    await stripBackupSecrets(db);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM conversation').get()).toEqual({ n: 1 });
  } finally {
    raw.close();
  }
});
