import { Client, type ConnectConfig } from 'ssh2';
import { app, ipcMain } from 'electron';
import { SocksClient } from 'socks';
import fs from 'fs';
import path from 'path';
import type { SFTPWrapper } from 'ssh2';

type ActiveSession = {
    conn: Client;
    manualClose: boolean;
    disconnectPromise?: Promise<boolean>;
    resolveDisconnect?: (value: boolean) => void;
};

const sshSessions: Record<string, ActiveSession> = {};

type SingBoxArch = 'amd64' | 'arm64';

type GithubReleaseAsset = {
    name: string;
    browser_download_url: string;
};

type GithubReleaseResponse = {
    tag_name: string;
    assets: GithubReleaseAsset[];
};

function getBundledSingBoxResourcePath(fileName: string) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'singbox', fileName);
    }

    return path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'resources', 'singbox', fileName);
}

function findBundledSingBoxResourcePath(...fileNames: string[]) {
    for (const fileName of fileNames) {
        const targetPath = getBundledSingBoxResourcePath(fileName);
        if (fs.existsSync(targetPath)) {
            return targetPath;
        }
    }

    return null;
}

function getCachedSingBoxAssetPath(fileName: string) {
    return path.join(app.getPath('userData'), 'singbox-cache', fileName);
}

const REMOTE_INSTALL_WRAPPER = `#!/usr/bin/env bash
set -e

ROOT_DIR="$1"
if [[ -z "$ROOT_DIR" ]]; then
    echo "Missing install root dir" >&2
    exit 1
fi

cd "$ROOT_DIR"

printf '\\n[1/3] Update mirrors...\\n'
bash ./main.sh --source mirrors.aliyun.com --protocol http --use-intranet-source false --install-epel false --upgrade-software false --ignore-backup-tips

printf '\\n[2/3] Check wget...\\n'
if ! command -v wget >/dev/null 2>&1; then
    if command -v yum >/dev/null 2>&1; then
        yum install wget -y
    elif command -v dnf >/dev/null 2>&1; then
        dnf install wget -y
    elif command -v apt-get >/dev/null 2>&1; then
        apt-get update
        apt-get install -y wget
    elif command -v zypper >/dev/null 2>&1; then
        zypper --non-interactive install wget
    elif command -v apk >/dev/null 2>&1; then
        apk add wget
    else
        echo "Unsupported package manager: cannot install wget" >&2
        exit 1
    fi
else
    echo "wget already installed"
fi

printf '\\n[3/3] Install sing-box locally...\\n'
tar zxf code.tar.gz
install -m 755 "./jq-bin" /usr/bin/jq
chmod +x ./install.sh
./install.sh -l -f "$ROOT_DIR/$CORE_TAR_NAME"
`;

type ServerConfig = {
    host?: string;
    port?: number | string;
    username?: string;
    password?: string;
    privateKeyPath?: string;
};

function cleanText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizeServer(server: ServerConfig) {
    const host = cleanText(server.host);
    const username = cleanText(server.username) || 'root';
    const port = Number(server.port || 22);
    const password = typeof server.password === 'string' ? server.password : '';
    const privateKeyPath = cleanText(server.privateKeyPath);

    if (!host) {
        throw new Error('SSH host is required');
    }

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error('SSH port is invalid');
    }

    return { host, username, port, password, privateKeyPath };
}

function normalizeConnectError(err: Error): Error {
    if (err.message.includes('All configured authentication methods failed')) {
        return new Error('Authentication failed. Check the username, password/private key, and whether the server allows this login method.');
    }

    return err;
}

function mapArchitecture(rawArch: string): SingBoxArch {
    const normalized = cleanText(rawArch).toLowerCase();

    if (normalized === 'x86_64' || normalized === 'amd64') {
        return 'amd64';
    }

    if (normalized === 'aarch64' || normalized === 'arm64') {
        return 'arm64';
    }

    throw new Error(`Unsupported server architecture: ${rawArch || 'unknown'}`);
}

async function downloadToFileWithProgress(
    url: string,
    destination: string,
    headers?: Record<string, string>,
    onProgress?: (receivedBytes: number, totalBytes?: number | null) => void
) {
    const tempDestination = `${destination}.download`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
        const response = await fetch(url, {
            headers: headers ?? {
                'User-Agent': 'WebSSHClient'
            },
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${url} (${response.status})`);
        }

        const totalHeader = response.headers.get('content-length');
        const totalBytes = totalHeader ? Number(totalHeader) : null;
        const body = response.body;

        if (!body) {
            const data = Buffer.from(await response.arrayBuffer());
            await fs.promises.writeFile(tempDestination, data);
            onProgress?.(data.length, totalBytes ?? data.length);
            await fs.promises.rename(tempDestination, destination);
            return;
        }

        let receivedBytes = 0;
        const fileStream = fs.createWriteStream(tempDestination);

        await new Promise<void>(async (resolve, reject) => {
            fileStream.on('error', reject);

            try {
                for await (const chunk of body as AsyncIterable<Uint8Array>) {
                    const buffer = Buffer.from(chunk);
                    receivedBytes += buffer.length;
                    onProgress?.(receivedBytes, totalBytes);

                    if (!fileStream.write(buffer)) {
                        await new Promise<void>((resume) => fileStream.once('drain', resume));
                    }
                }

                fileStream.end(() => resolve());
            } catch (error) {
                reject(error);
            }
        });

        onProgress?.(receivedBytes, totalBytes ?? receivedBytes);
        await fs.promises.rename(tempDestination, destination);
    } catch (error) {
        await fs.promises.rm(tempDestination, { force: true }).catch(() => { });

        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Download timed out: ${url}`);
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function readLatestSingBoxRelease(): Promise<GithubReleaseResponse> {
    const response = await fetch('https://api.github.com/repos/SagerNet/sing-box/releases/latest', {
        headers: {
            'User-Agent': 'WebSSHClient',
            'Accept': 'application/vnd.github+json'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to query sing-box release metadata (${response.status})`);
    }

    return response.json() as Promise<GithubReleaseResponse>;
}

function createInstallProgressReporter(
    event: Electron.IpcMainInvokeEvent,
    sessionId: string,
    label: string
) {
    let lastPercent = -1;
    let lastReportedMb = -1;

    return (receivedBytes: number, totalBytes?: number | null) => {
        if (totalBytes && totalBytes > 0) {
            const percent = Math.max(0, Math.min(100, Math.floor((receivedBytes / totalBytes) * 100)));
            if (percent === lastPercent || (percent < 100 && percent - lastPercent < 10)) {
                return;
            }

            lastPercent = percent;
            sendSessionOutput(event, sessionId, `[0/3] Downloading ${label}... ${percent}%\r\n`);
            return;
        }

        const currentMb = Math.floor(receivedBytes / (1024 * 1024));
        if (currentMb <= 0 || currentMb === lastReportedMb) {
            return;
        }

        lastReportedMb = currentMb;
        sendSessionOutput(event, sessionId, `[0/3] Downloading ${label}... ${currentMb} MB\r\n`);
    };
}

async function ensureCachedDownloadWithProgress(
    url: string,
    fileName: string,
    onProgress?: (receivedBytes: number, totalBytes?: number | null) => void,
    headers?: Record<string, string>
) {
    const cacheDir = path.dirname(getCachedSingBoxAssetPath(fileName));
    const destination = getCachedSingBoxAssetPath(fileName);

    await fs.promises.mkdir(cacheDir, { recursive: true });

    const stat = await fs.promises.stat(destination).catch(() => null);
    if (stat && stat.isFile() && stat.size > 0) {
        onProgress?.(stat.size, stat.size);
        return destination;
    }

    await downloadToFileWithProgress(url, destination, headers, onProgress);
    return destination;
}

async function execOnConnection(conn: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        conn.exec(command, (err, stream) => {
            if (err) {
                reject(err);
                return;
            }

            let output = '';
            let errorOutput = '';

            stream.on('data', (data: Buffer) => {
                output += data.toString();
            });

            stream.stderr.on('data', (data: Buffer) => {
                errorOutput += data.toString();
            });

            stream.on('close', (code?: number) => {
                if (code && code !== 0) {
                    reject(new Error((errorOutput || output || `Remote command failed with exit code ${code}`).trim()));
                    return;
                }

                resolve((output || errorOutput).trim());
            });
        });
    });
}

async function execOnConnectionWithStream(
    conn: Client,
    command: string,
    onData: (chunk: string) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        conn.exec(command, (err, stream) => {
            if (err) {
                reject(err);
                return;
            }

            let errorOutput = '';

            stream.on('data', (data: Buffer) => {
                onData(data.toString());
            });

            stream.stderr.on('data', (data: Buffer) => {
                const chunk = data.toString();
                errorOutput += chunk;
                onData(chunk);
            });

            stream.on('close', (code?: number) => {
                if (code && code !== 0) {
                    reject(new Error((errorOutput || `Remote command failed with exit code ${code}`).trim()));
                    return;
                }

                resolve();
            });
        });
    });
}

async function getSftp(conn: Client): Promise<SFTPWrapper> {
    return new Promise((resolve, reject) => {
        conn.sftp((err, sftp) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(sftp);
        });
    });
}

async function sftpFastPut(sftp: SFTPWrapper, localPath: string, remotePath: string) {
    await new Promise<void>((resolve, reject) => {
        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) {
                reject(err);
                return;
            }

            resolve();
        });
    });
}

async function sftpFastPutWithProgress(
    sftp: SFTPWrapper,
    localPath: string,
    remotePath: string,
    onProgress?: (transferred: number, total: number) => void
) {
    const stats = await fs.promises.stat(localPath);
    const total = stats.size;

    await new Promise<void>((resolve, reject) => {
        sftp.fastPut(localPath, remotePath, {
            step: (transferred, _chunk, fileTotal) => {
                onProgress?.(transferred, fileTotal || total);
            }
        }, (err) => {
            if (err) {
                reject(err);
                return;
            }

            onProgress?.(total, total);
            resolve();
        });
    });
}

async function sftpWriteTextFile(sftp: SFTPWrapper, remotePath: string, content: string) {
    await new Promise<void>((resolve, reject) => {
        const stream = sftp.createWriteStream(remotePath, {
            encoding: 'utf8',
            mode: 0o755
        });

        stream.on('error', reject);
        stream.on('close', () => resolve());
        stream.end(content);
    });
}

function sendSessionOutput(event: Electron.IpcMainInvokeEvent, sessionId: string, message: string) {
    if (!event.sender.isDestroyed()) {
        event.sender.send(`ssh-data-${sessionId}`, message);
    }
}

function sendUploadProgress(
    event: Electron.IpcMainInvokeEvent,
    sessionId: string,
    payload: {
        transferred: number;
        total: number;
        fileName: string;
        remotePath: string;
    }
) {
    if (!event.sender.isDestroyed()) {
        event.sender.send(`ssh-upload-progress-${sessionId}`, payload);
    }
}

export function setupSSHHandler() {
    ipcMain.handle('connect-ssh', async (event, { sessionId, server, options }) => {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            let normalizedServer: ReturnType<typeof normalizeServer>;

            try {
                normalizedServer = normalizeServer(server || {});
            } catch (err) {
                reject(err);
                return;
            }

            conn.on('ready', () => {
                conn.shell({ term: 'xterm-color' }, (err, stream) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    sshSessions[sessionId] = {
                        conn,
                        manualClose: false
                    };

                    stream.on('data', (data: Buffer) => {
                        if (!event.sender.isDestroyed()) {
                            event.sender.send(`ssh-data-${sessionId}`, data.toString());
                        }
                    });

                    ipcMain.on(`ssh-write-${sessionId}`, (_, data) => {
                        stream.write(data);
                    });

                    ipcMain.on(`ssh-resize-${sessionId}`, (_, { cols, rows }) => {
                        stream.setWindow(rows, cols, 0, 0);
                    });

                    stream.on('close', () => {
                        const activeSession = sshSessions[sessionId];
                        const wasManualClose = activeSession?.manualClose ?? false;

                        conn.end();
                        ipcMain.removeAllListeners(`ssh-write-${sessionId}`);
                        ipcMain.removeAllListeners(`ssh-resize-${sessionId}`);

                        if (activeSession?.conn === conn) {
                            delete sshSessions[sessionId];
                        }

                        activeSession?.resolveDisconnect?.(true);

                        if (!wasManualClose && !event.sender.isDestroyed()) {
                            event.sender.send(`ssh-closed-${sessionId}`);
                        }
                    });

                    resolve(true);
                });
            }).on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
                finish(prompts.map(() => normalizedServer.password));
            }).on('error', (err) => {
                reject(normalizeConnectError(err));
            });

            const connectConfig: ConnectConfig = {
                host: normalizedServer.host,
                port: normalizedServer.port,
                username: normalizedServer.username,
            };

            if (normalizedServer.password) {
                connectConfig.password = normalizedServer.password;
                connectConfig.tryKeyboard = true;
            } else if (normalizedServer.privateKeyPath) {
                try {
                    connectConfig.privateKey = fs.readFileSync(normalizedServer.privateKeyPath);
                } catch (e) {
                    reject(new Error('Failed to read private key file: ' + String(e)));
                    return;
                }
            }

            if (options?.proxy) {
                SocksClient.createConnection({
                    proxy: {
                        host: options.proxy.host,
                        port: options.proxy.port,
                        type: 5
                    },
                    command: 'connect',
                    destination: {
                        host: normalizedServer.host,
                        port: normalizedServer.port
                    }
                }).then(info => {
                    connectConfig.sock = info.socket;
                    conn.connect(connectConfig);
                }).catch(err => {
                    reject(new Error('Proxy connection failed: ' + err.message));
                });
            } else {
                conn.connect(connectConfig);
            }
        });
    });

    ipcMain.handle('exec-command', async (_, { sessionId, command }) => {
        return new Promise((resolve, reject) => {
            const activeSession = sshSessions[sessionId];
            if (!activeSession) {
                return reject(new Error('SSH session not found.'));
            }

            activeSession.conn.exec(command, (err, stream) => {
                if (err) return reject(err);

                let output = '';
                stream.on('data', (data: any) => {
                    output += data.toString();
                }).on('close', () => {
                    resolve(output);
                });
            });
        });
    });

    ipcMain.handle('disconnect-ssh', (_, sessionId) => {
        const activeSession = sshSessions[sessionId];
        if (activeSession) {
            if (activeSession.disconnectPromise) {
                return activeSession.disconnectPromise;
            }

            activeSession.manualClose = true;
            activeSession.disconnectPromise = new Promise<boolean>((resolve) => {
                activeSession.resolveDisconnect = resolve;
                activeSession.conn.end();
            });

            return activeSession.disconnectPromise;
        }

        return true;
    });

    ipcMain.handle('upload-file-to-session', async (event, { sessionId, localPath, remotePath }) => {
        const activeSession = sshSessions[sessionId];
        if (!activeSession) {
            throw new Error('SSH session not found.');
        }

        const normalizedLocalPath = cleanText(localPath);
        const normalizedRemotePath = cleanText(remotePath);

        if (!normalizedLocalPath) {
            throw new Error('Local file path is required.');
        }

        if (!normalizedRemotePath) {
            throw new Error('Remote path is required.');
        }

        const localStats = await fs.promises.stat(normalizedLocalPath).catch(() => null);
        if (!localStats || !localStats.isFile()) {
            throw new Error('Selected local file does not exist.');
        }

        const remoteDir = path.posix.dirname(normalizedRemotePath);
        await execOnConnection(activeSession.conn, `mkdir -p '${remoteDir.replace(/'/g, `'\\''`)}'`);

        const sftp = await getSftp(activeSession.conn);
        try {
            await sftpFastPutWithProgress(
                sftp,
                normalizedLocalPath,
                normalizedRemotePath,
                (transferred, total) => {
                    sendUploadProgress(event, sessionId, {
                        transferred,
                        total,
                        fileName: path.basename(normalizedLocalPath),
                        remotePath: normalizedRemotePath
                    });
                }
            );
        } finally {
            sftp.end();
        }

        return {
            fileName: path.basename(normalizedLocalPath),
            remotePath: normalizedRemotePath,
            size: localStats.size
        };
    });

    ipcMain.handle('upload-files-to-session', async (event, { sessionId, files, remoteDir }) => {
        const activeSession = sshSessions[sessionId];
        if (!activeSession) {
            throw new Error('SSH session not found.');
        }

        if (!Array.isArray(files) || files.length === 0) {
            throw new Error('No local files selected.');
        }

        const normalizedRemoteDir = cleanText(remoteDir);
        if (!normalizedRemoteDir) {
            throw new Error('Remote directory is required.');
        }

        const escapedRemoteDir = normalizedRemoteDir.replace(/\\/g, '/').replace(/'/g, `'\\''`);
        await execOnConnection(activeSession.conn, `mkdir -p '${escapedRemoteDir}'`);

        const sftp = await getSftp(activeSession.conn);
        const uploadedFiles: Array<{ fileName: string; remotePath: string; size: number }> = [];

        try {
            for (const file of files) {
                const localPath = cleanText(file?.path);
                const localStats = await fs.promises.stat(localPath).catch(() => null);
                if (!localStats || !localStats.isFile()) {
                    throw new Error(`Selected local file does not exist: ${localPath}`);
                }

                const fileName = cleanText(file?.name) || path.basename(localPath);
                const remotePath = `${normalizedRemoteDir.replace(/\/+$/, '')}/${fileName}`;

                await sftpFastPutWithProgress(
                    sftp,
                    localPath,
                    remotePath,
                    (transferred, total) => {
                        sendUploadProgress(event, sessionId, {
                            transferred,
                            total,
                            fileName,
                            remotePath
                        });
                    }
                );

                uploadedFiles.push({
                    fileName,
                    remotePath,
                    size: localStats.size
                });
            }
        } finally {
            sftp.end();
        }

        const listCommand = `printf '\\n[Upload] Files uploaded to ${normalizedRemoteDir}\\n'; ls -lh '${escapedRemoteDir}'`;
        sendSessionOutput(event, sessionId, '\r\n[Upload] Refreshing remote directory listing...\r\n');
        await execOnConnectionWithStream(activeSession.conn, `bash -lc "${listCommand.replace(/"/g, '\\"')}"`, (chunk) => {
            sendSessionOutput(event, sessionId, chunk);
        });

        return {
            remoteDir: normalizedRemoteDir,
            uploadedFiles
        };
    });

    ipcMain.handle('install-singbox-locally', async (event, { sessionId }) => {
        const activeSession = sshSessions[sessionId];
        if (!activeSession) {
            throw new Error('SSH session not found.');
        }

        try {
            sendSessionOutput(event, sessionId, '\r\n[0/3] Detecting server architecture...\r\n');
            const archRaw = await execOnConnection(activeSession.conn, 'uname -m');
            const arch = mapArchitecture(archRaw);
            const bundledCorePath = findBundledSingBoxResourcePath(`sing-box-linux-${arch}.tar.gz`);
            let coreName = bundledCorePath ? path.basename(bundledCorePath) : '';
            let coreDownloadUrl = '';

            if (!bundledCorePath) {
                const release = await readLatestSingBoxRelease();
                const version = release.tag_name;
                coreName = `sing-box-${version.slice(1)}-linux-${arch}.tar.gz`;
                const coreAsset = release.assets.find((asset) => asset.name === coreName);

                if (!coreAsset) {
                    throw new Error(`Unable to find sing-box asset for ${arch}`);
                }

                coreDownloadUrl = coreAsset.browser_download_url;
            }

            const remoteDir = `/root/.webssh-singbox-${Date.now()}`;
            const remoteMainPath = `${remoteDir}/main.sh`;
            const remoteInstallPath = `${remoteDir}/install.sh`;
            const remoteWrapperPath = `${remoteDir}/run-install.sh`;
            const mainScriptPath = getBundledSingBoxResourcePath('main.sh');
            const installScriptPath = getBundledSingBoxResourcePath('install.sh');
            const bundledCodeTarPath = findBundledSingBoxResourcePath('code.tar.gz');
            const bundledJqPath = findBundledSingBoxResourcePath(`jq-linux-${arch}`);
            const codeCachePath = getCachedSingBoxAssetPath('code.tar.gz');
            const coreCachePath = getCachedSingBoxAssetPath(coreName);
            const jqCachePath = getCachedSingBoxAssetPath(`jq-linux-${arch}`);

            let codeTarPath = bundledCodeTarPath;
            if (codeTarPath) {
                sendSessionOutput(event, sessionId, '[0/3] Using bundled code.tar.gz...\r\n');
            } else {
                sendSessionOutput(
                    event,
                    sessionId,
                    `${fs.existsSync(codeCachePath) ? '[0/3] Using cached code.tar.gz...' : '[0/3] Downloading code.tar.gz...'}\r\n`
                );
                codeTarPath = await ensureCachedDownloadWithProgress(
                    'https://github.com/233boy/sing-box/releases/latest/download/code.tar.gz',
                    'code.tar.gz',
                    createInstallProgressReporter(event, sessionId, 'code.tar.gz')
                );
            }

            let coreTarPath = bundledCorePath;
            if (coreTarPath) {
                sendSessionOutput(event, sessionId, `[0/3] Using bundled ${coreName}...\r\n`);
            } else {
                sendSessionOutput(
                    event,
                    sessionId,
                    `${fs.existsSync(coreCachePath) ? `[0/3] Using cached ${coreName}...` : `[0/3] Downloading ${coreName}...`}\r\n`
                );
                coreTarPath = await ensureCachedDownloadWithProgress(
                    coreDownloadUrl,
                    coreName,
                    createInstallProgressReporter(event, sessionId, coreName)
                );
            }

            let jqPath = bundledJqPath;
            if (jqPath) {
                sendSessionOutput(event, sessionId, `[0/3] Using bundled jq-linux-${arch}...\r\n`);
            } else {
                sendSessionOutput(
                    event,
                    sessionId,
                    `${fs.existsSync(jqCachePath) ? `[0/3] Using cached jq-linux-${arch}...` : `[0/3] Downloading jq-linux-${arch}...`}\r\n`
                );
                jqPath = await ensureCachedDownloadWithProgress(
                    `https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-${arch}`,
                    `jq-linux-${arch}`,
                    createInstallProgressReporter(event, sessionId, `jq-linux-${arch}`)
                );
            }

            const sftp = await getSftp(activeSession.conn);

            sendSessionOutput(event, sessionId, '[0/3] Uploading installer resources...\r\n');
            await execOnConnection(activeSession.conn, `mkdir -p '${remoteDir}'`);
            await sftpFastPut(sftp, mainScriptPath, remoteMainPath);
            await sftpFastPut(sftp, installScriptPath, remoteInstallPath);
            await sftpFastPut(sftp, codeTarPath, `${remoteDir}/code.tar.gz`);
            await sftpFastPut(sftp, coreTarPath, `${remoteDir}/${coreName}`);
            await sftpFastPut(sftp, jqPath, `${remoteDir}/jq-bin`);
            await sftpWriteTextFile(
                sftp,
                remoteWrapperPath,
                `#!/usr/bin/env bash
set -e
CORE_TAR_NAME='${coreName}'
${REMOTE_INSTALL_WRAPPER}`
            );
            sftp.end();

            await execOnConnection(
                activeSession.conn,
                `chmod +x ${shellQuote(remoteMainPath)} ${shellQuote(remoteInstallPath)} ${shellQuote(remoteWrapperPath)}`
            );

            const launchCommand = `bash ${shellQuote(remoteWrapperPath)} ${shellQuote(remoteDir)}`;
            sendSessionOutput(event, sessionId, '[0/3] Installer assets ready. Launching in current terminal...\r\n');

            return {
                remoteDir,
                launchCommand
            };
        } finally {
        }
    });
}
