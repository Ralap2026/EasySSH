import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const dataPath = app.getPath('userData');
const dbDir = path.join(dataPath, 'webssh_data');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite3');
const db = new Database(dbPath, { verbose: isDev ? console.log : undefined });

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    password TEXT,
    privateKeyPath TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER,
    command TEXT,
    log_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(server_id) REFERENCES servers(id)
  );

  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

ensureColumn('servers', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
ensureColumn('servers', 'last_used_at', 'DATETIME');

export default db;
