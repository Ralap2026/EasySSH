import { ipcMain } from 'electron';
import db from './db';

export function setupIPC() {
    // --- 服务器相关 ---
    ipcMain.handle('get-servers', () => {
        const stmt = db.prepare('SELECT * FROM servers ORDER BY created_at DESC');
        return stmt.all();
    });

    ipcMain.handle('add-server', (_, serverData) => {
        const { name, host, port, username, password, privateKeyPath, remark } = serverData;
        const stmt = db.prepare(`
      INSERT INTO servers (name, host, port, username, password, privateKeyPath, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const info = stmt.run(name, host, port, username, password, privateKeyPath, remark);
        return info.lastInsertRowid;
    });

    ipcMain.handle('delete-server', (_, id) => {
        const stmt = db.prepare('DELETE FROM servers WHERE id = ?');
        stmt.run(id);
        return true;
    });

    ipcMain.handle('update-server', (_, { id, ...data }) => {
        const { name, host, port, username, password, privateKeyPath, remark } = data;
        const stmt = db.prepare(`
      UPDATE servers SET name = ?, host = ?, port = ?, username = ?, password = ?, privateKeyPath = ?, remark = ?
      WHERE id = ?
    `);
        stmt.run(name, host, port, username, password, privateKeyPath, remark, id);
        return true;
    });

    ipcMain.handle('touch-server-last-used', (_, id) => {
        const stmt = db.prepare('UPDATE servers SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?');
        stmt.run(id);
        return true;
    });

    // --- 脚本相关 ---
    ipcMain.handle('get-scripts', () => {
        const stmt = db.prepare('SELECT * FROM scripts ORDER BY created_at DESC');
        return stmt.all();
    });

    ipcMain.handle('add-script', (_, data) => {
        const stmt = db.prepare('INSERT INTO scripts (name, content) VALUES (?, ?)');
        const info = stmt.run(data.name, data.content);
        return info.lastInsertRowid;
    });

    // --- 设置相关 ---
    ipcMain.handle('get-settings', () => {
        const stmt = db.prepare('SELECT key, value FROM settings');
        return stmt.all();
    });

    ipcMain.handle('save-setting', (_, { key, value }) => {
        const stmt = db.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        stmt.run(key, value);
        return true;
    });

    ipcMain.handle('save-latest-singbox-url', (_, { url }) => {
        const normalizedUrl = typeof url === 'string' ? url.trim() : '';
        if (!normalizedUrl) {
            throw new Error('URL is required.');
        }

        const stmt = db.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
        stmt.run('latest_singbox_url', normalizedUrl);
        stmt.run('latest_singbox_url_saved_at', new Date().toISOString());
        return true;
    });

    ipcMain.handle('get-latest-singbox-url', () => {
        const urlStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const savedAtStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
        const urlRow = urlStmt.get('latest_singbox_url') as { value?: string } | undefined;
        const savedAtRow = savedAtStmt.get('latest_singbox_url_saved_at') as { value?: string } | undefined;

        return {
            url: urlRow?.value?.trim() || '',
            savedAt: savedAtRow?.value?.trim() || ''
        };
    });

}
