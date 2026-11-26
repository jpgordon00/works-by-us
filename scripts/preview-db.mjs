// D1-compatible SQLite calls used by the watch API in the local preview.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function openPreviewDatabase(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS preview_migrations (filename TEXT PRIMARY KEY)');
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT 1 FROM preview_migrations WHERE filename = ?').get(name)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(new URL(name, migrations), 'utf8'));
      db.prepare('INSERT INTO preview_migrations VALUES (?)').run(name);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function prepare(sql, args = []) {
    const statement = db.prepare(sql);
    return {
      bind(...values) { return prepare(sql, values); },
      first() { return statement.get(...args) ?? null; },
      all() { return { results: statement.all(...args), success: true }; },
      run() { return { meta: statement.run(...args), success: true }; }
    };
  }
  return {
    prepare,
    batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
