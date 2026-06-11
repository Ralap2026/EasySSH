import { app, BrowserWindow, clipboard, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ ├── dist-renderer
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist-renderer');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

let win: BrowserWindow | null;
const appIconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'webssh.ico')
    : path.join(process.env.APP_ROOT || '', 'webssh.ico');

if (process.platform === 'win32') {
    app.setAppUserModelId('com.webssh.client');
}

function createWindow() {
    win = new BrowserWindow({
        icon: appIconPath,
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
        },
        // 暗色主题玻璃风格可以结合 frame: false 或 titleBarStyle 后续补充
    });

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString());
    });

    const emitWindowLayoutChanged = (state: string) => {
        if (!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
        win.webContents.send('window-layout-changed', {
            state,
            timestamp: Date.now()
        });
    };

    win.on('resize', () => emitWindowLayoutChanged('resize'));
    win.on('maximize', () => emitWindowLayoutChanged('maximize'));
    win.on('unmaximize', () => emitWindowLayoutChanged('unmaximize'));
    win.on('restore', () => emitWindowLayoutChanged('restore'));
    win.on('enter-full-screen', () => emitWindowLayoutChanged('enter-full-screen'));
    win.on('leave-full-screen', () => emitWindowLayoutChanged('leave-full-screen'));

    win.removeMenu();

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(RENDERER_DIST, 'index.html'));
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.whenReady().then(createWindow);

ipcMain.handle('get-system-locale', () => app.getLocale());
ipcMain.handle('clipboard-write-text', (_, text) => {
    clipboard.writeText(String(text ?? ''));
    return true;
});
ipcMain.handle('clipboard-read-text', () => clipboard.readText());
ipcMain.handle('check-remote-embed-page', async (_, targetUrl: string) => {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(String(targetUrl ?? ''));
    } catch {
        return { ok: false };
    }

    const check = async (method: 'HEAD' | 'GET') => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);

        try {
            const response = await fetch(parsedUrl, {
                method,
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'WebSSHClient'
                }
            });
            const contentType = response.headers.get('content-type') || '';
            const isHtmlLike = !contentType
                || contentType.includes('text/html')
                || contentType.includes('application/xhtml+xml');

            return {
                ok: response.ok && isHtmlLike,
                url: response.url
            };
        } catch {
            return {
                ok: false,
                url: parsedUrl.toString()
            };
        } finally {
            clearTimeout(timer);
        }
    };

    let result = await check('HEAD');
    if (!result.ok) {
        result = await check('GET');
    }

    return result.ok ? result : { ok: false };
});
ipcMain.handle('pick-upload-file', async () => {
    const targetWindow = BrowserWindow.getFocusedWindow() ?? win;
    const result = targetWindow
        ? await dialog.showOpenDialog(targetWindow, {
            properties: ['openFile'],
            title: 'Select File'
        })
        : await dialog.showOpenDialog({
        properties: ['openFile'],
        title: 'Select File'
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return result.filePaths[0];
});
ipcMain.handle('pick-upload-files', async () => {
    const targetWindow = BrowserWindow.getFocusedWindow() ?? win;
    const result = targetWindow
        ? await dialog.showOpenDialog(targetWindow, {
            properties: ['openFile', 'multiSelections'],
            title: 'Select Files'
        })
        : await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            title: 'Select Files'
        });

    if (result.canceled || result.filePaths.length === 0) {
        return [];
    }

    return Promise.all(result.filePaths.map(async (filePath) => {
        const stats = await import('fs/promises').then((fs) => fs.stat(filePath));
        return {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size
        };
    }));
});

import { setupIPC } from './ipc';
import { setupSSHHandler } from './sshHandler';

setupIPC();
setupSSHHandler();

