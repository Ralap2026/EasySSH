import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import { useIPC } from '../hooks/useIPC';
import { Activity, Cpu, HardDrive, Server } from 'lucide-react';
import { useI18n } from '../i18n';
import LatestUrlModal from './LatestUrlModal';

function formatConnectError(message: string, authFailedText: string): string {
    const cleanedMessage = message
        .replace(/^Error invoking remote method ['’]connect-ssh['’]: Error:\s*/i, '')
        .replace(/^Error:\s*/i, '');

    if (
        cleanedMessage.includes('All configured authentication methods failed')
        || cleanedMessage.startsWith('Authentication failed.')
    ) {
        return authFailedText;
    }

    return cleanedMessage;
}

function getTerminalTheme(theme: 'light' | 'dark') {
    const background = theme === 'dark' ? '#000000' : '#fcfceb';

    return {
        background,
        foreground: theme === 'dark' ? '#f3f4f6' : '#1e293b',
        cursor: theme === 'dark' ? '#f3f4f6' : '#111827',
        cursorAccent: background,
        selectionBackground: theme === 'dark' ? 'rgba(79, 70, 229, 0.30)' : 'rgba(37, 99, 235, 0.22)',
        black: theme === 'dark' ? '#000000' : '#0f172a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: theme === 'dark' ? '#f3f4f6' : '#f8fafc',
    };
}

function getLastNonEmptyLine(text: string) {
    const lines = text.split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index].trim();
        if (line) {
            return line;
        }
    }
    return '';
}

function isShellPromptLine(line: string) {
    return (
        /^\[[^\]]+@[^ ]+ [^\]]*\][#$]$/.test(line)
        || /^[\w.-]+@[\w.-]+(?::[~\/\w.-]+)?[#$]$/.test(line)
        || /^[#$]$/.test(line)
    );
}

function stripAnsiSequences(text: string) {
    return text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
}

function extractLatestSingBoxUrl(text: string) {
    const normalizedText = stripAnsiSequences(text).replace(/\r/g, '');
    const blockPattern = /-+\s*[^\n]*\(URL\)[^\n]*-+\s*([\s\S]*?)-+\s*END\s*-+/gi;
    let matchedBlock = '';
    let match: RegExpExecArray | null;

    while ((match = blockPattern.exec(normalizedText)) !== null) {
        matchedBlock = match[1] ?? '';
    }

    if (matchedBlock) {
        const normalizedBlock = matchedBlock
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('');
        const blockUrlMatch = normalizedBlock.match(/([a-z][a-z0-9+.-]*:\/\/\S+)/i);
        if (blockUrlMatch?.[1]) {
            return blockUrlMatch[1].trim();
        }
    }

    return '';
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
type QuickActionKey = 'installSingbox' | 'uninstallSingbox';

type AutomationTask = {
    key: QuickActionKey;
    startedAt: number;
    minRunMs: number;
};

const QUICK_ACTIONS: Array<{
    key: QuickActionKey;
    labels: {
        zh: string;
        en: string;
    };
    minRunMs: number;
}> = [
    {
        key: 'installSingbox',
        labels: {
            zh: '安装sing-box服务',
            en: 'Install sing-box'
        },
        minRunMs: 2000
    },
    {
        key: 'uninstallSingbox',
        labels: {
            zh: '卸载服务',
            en: 'Uninstall Service'
        },
        minRunMs: 1000
    }
];

export default function TerminalView({
    session,
    theme,
    onDisconnected,
    onSessionChannelReady,
    reconnectSignal = 0,
    disconnectSignal = 0
}: {
    session: any,
    theme: 'light' | 'dark',
    onDisconnected: () => void,
    onSessionChannelReady?: (sessionChannelId: string | null) => void,
    reconnectSignal?: number,
    disconnectSignal?: number
}) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const { invoke, on, send, writeClipboardText, readClipboardText } = useIPC();
    const { t, locale } = useI18n();
    const [stats, setStats] = useState({ cpu: '...', mem: '...', disk: '...' });
    const [connectionStatusState, setConnectionStatusState] = useState<ConnectionStatus>('disconnected');
    const [runningAction, setRunningAction] = useState<QuickActionKey | null>(null);
    const [latestUrlModalOpen, setLatestUrlModalOpen] = useState(false);
    const [latestUrlValue, setLatestUrlValue] = useState('');
    const termInstance = useRef<Terminal | null>(null);
    const connectRequestRef = useRef<((isReconnect?: boolean) => void) | null>(null);
    const disconnectRequestRef = useRef<((reconnectAfter?: boolean) => void) | null>(null);
    const reconnectAfterDisconnectRef = useRef(false);
    const sessionChannelRef = useRef<string | null>(null);
    const connectionStatusRef = useRef<ConnectionStatus>('disconnected');
    const automationTaskRef = useRef<AutomationTask | null>(null);
    const outputTailRef = useRef('');
    const latestDetectedUrlRef = useRef('');
    const disconnectLabelRef = useRef(t('terminal.disconnected'));
    const connectionErrorLabelRef = useRef(t('terminal.connectionError'));
    const authFailedLabelRef = useRef(t('terminal.authFailed'));
    const reconnectPromptLabelRef = useRef(t('terminal.reconnectPrompt'));
    const reconnectingLabelRef = useRef(t('terminal.reconnecting'));
    const connectionAddress = `${session.host}:${session.port || 22}`;
    const latestUrlButtonLabel = locale === 'zh' ? '取出最新URL' : 'Show Latest URL';
    const latestUrlLoadErrorLabel = locale === 'zh' ? '读取本地最新URL失败。' : 'Failed to load the latest saved URL.';

    const showLatestUrlModal = (url: string) => {
        setLatestUrlValue(url.trim());
        setLatestUrlModalOpen(true);
    };

    const loadLatestUrlFromLocal = async () => {
        try {
            const result = await invoke<{
                url: string;
                savedAt: string;
            }>('get-latest-singbox-url');
            showLatestUrlModal(result?.url || '');
        } catch (error) {
            termInstance.current?.write(`\r\n\x1b[31m[Local URL Error] ${latestUrlLoadErrorLabel} ${String(error)}\x1b[0m\r\n`);
            showLatestUrlModal('');
        }
    };

    const stopAutomation = () => {
        automationTaskRef.current = null;
        outputTailRef.current = '';
        setRunningAction(null);
    };

    const setConnectionStatusValue = (status: ConnectionStatus) => {
        connectionStatusRef.current = status;
        setConnectionStatusState(status);
        if (status !== 'connected') {
            stopAutomation();
        }
    };

    const runQuickAction = async (actionKey: QuickActionKey) => {
        const action = QUICK_ACTIONS.find((item) => item.key === actionKey);
        if (!action || connectionStatusRef.current !== 'connected') return;
        if (action.key === 'installSingbox' && runningAction) return;

        termInstance.current?.focus();
        outputTailRef.current = '';

        if (action.key === 'uninstallSingbox') {
            send(`ssh-write-${sessionChannelRef.current}`, 'sing-box uninstall\r');
            return;
        }

        setRunningAction(action.key);

        try {
            automationTaskRef.current = {
                key: action.key,
                startedAt: Date.now(),
                minRunMs: action.minRunMs
            };

            const result = await invoke<{
                remoteDir: string;
                launchCommand: string;
            }>('install-singbox-locally', { sessionId: sessionChannelRef.current });

            outputTailRef.current = '';
            if (result.launchCommand) {
                send(`ssh-write-${sessionChannelRef.current}`, `${result.launchCommand}\r`);
            } else {
                throw new Error('Missing launch command');
            }
        } catch (error) {
            termInstance.current?.write(`\r\n\x1b[31m[Local Install Error] ${String(error)}\x1b[0m\r\n`);
            stopAutomation();
        }
    };

    useEffect(() => {
        disconnectLabelRef.current = t('terminal.disconnected');
        connectionErrorLabelRef.current = t('terminal.connectionError');
        authFailedLabelRef.current = t('terminal.authFailed');
        reconnectPromptLabelRef.current = t('terminal.reconnectPrompt');
        reconnectingLabelRef.current = t('terminal.reconnecting');
    }, [t]);

    useEffect(() => {
        if (!terminalRef.current) return;

        outputTailRef.current = '';
        latestDetectedUrlRef.current = '';

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'underline',
            cursorWidth: 4,
            fontFamily: '"Courier New", SimSun, monospace',
            fontSize: 14,
            theme: getTerminalTheme(theme)
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        termInstance.current = term;

        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        sessionChannelRef.current = sessionId;
        onSessionChannelReady?.(sessionId);
        let disposed = false;
        let lastCopiedSelection = '';
        let fitFrameId: number | null = null;
        const delayedFitIds: number[] = [];

        const clearScheduledFits = () => {
            while (delayedFitIds.length > 0) {
                const timeoutId = delayedFitIds.pop();
                if (timeoutId !== undefined) {
                    window.clearTimeout(timeoutId);
                }
            }
        };

        const fitTerminal = () => {
            if (disposed || !terminalRef.current) return;
            if (terminalRef.current.clientWidth <= 0 || terminalRef.current.clientHeight <= 0) return;

            const buffer = term.buffer.active;
            const wasNearBottom = buffer.viewportY + term.rows >= buffer.baseY + buffer.cursorY - 1;

            try {
                fitAddon.fit();
                term.refresh(0, Math.max(0, term.rows - 1));
                if (wasNearBottom) {
                    term.scrollToBottom();
                }
            } catch (error) {
                console.warn('Terminal fit failed', error);
            }
        };

        const scheduleFit = (withSettlingPass = true) => {
            if (fitFrameId !== null) {
                window.cancelAnimationFrame(fitFrameId);
            }
            clearScheduledFits();

            fitFrameId = window.requestAnimationFrame(() => {
                fitFrameId = null;
                fitTerminal();

                if (!withSettlingPass) return;

                [80, 180, 360, 720].forEach((delayMs) => {
                    const timeoutId = window.setTimeout(() => {
                        fitTerminal();
                    }, delayMs);
                    delayedFitIds.push(timeoutId);
                });
            });
        };

        const copySelection = () => {
            const selectedText = term.getSelection();
            if (!selectedText) {
                lastCopiedSelection = '';
                return;
            }

            if (selectedText === lastCopiedSelection) return;

            lastCopiedSelection = selectedText;
            writeClipboardText(selectedText).catch((error) => {
                console.warn('Failed to copy terminal selection', error);
            });
        };

        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            if (connectionStatusRef.current !== 'connected') return;

            readClipboardText()
                .then((text) => {
                    if (!text) return;
                    term.focus();
                    term.paste(text);
                })
                .catch((error) => {
                    console.warn('Failed to paste terminal clipboard', error);
                });
        };

        terminalRef.current.addEventListener('contextmenu', handleContextMenu);

        const writeReconnectPrompt = () => {
            term.write(` \x1b[90m${reconnectPromptLabelRef.current}\x1b[0m\r\n`);
        };

        const writeDisconnectedMessage = () => {
            term.write(`\r\n\x1b[31m${disconnectLabelRef.current}\x1b[0m`);
            writeReconnectPrompt();
        };

        const offData = on(`ssh-data-${sessionId}`, (data: string) => {
            term.write(data);

            outputTailRef.current = (outputTailRef.current + data).slice(-16000);
            const detectedUrl = extractLatestSingBoxUrl(outputTailRef.current);
            if (detectedUrl && detectedUrl !== latestDetectedUrlRef.current) {
                latestDetectedUrlRef.current = detectedUrl;
                void invoke('save-latest-singbox-url', { url: detectedUrl })
                    .catch((error) => {
                        console.warn('Failed to save latest sing-box URL', error);
                    })
                    .finally(() => {
                        showLatestUrlModal(detectedUrl);
                    });
            }

            const activeTask = automationTaskRef.current;
            if (!activeTask) return;

            if (Date.now() - activeTask.startedAt < activeTask.minRunMs) return;

            const lastLine = getLastNonEmptyLine(outputTailRef.current);
            if (isShellPromptLine(lastLine)) {
                stopAutomation();
            }
        });

        const offClose = on(`ssh-closed-${sessionId}`, () => {
            if (disposed || connectionStatusRef.current === 'disconnected') return;

            setConnectionStatusValue('disconnected');
            writeDisconnectedMessage();
            onDisconnected();
        });

        const connectSsh = (isReconnect = false) => {
            if (disposed || connectionStatusRef.current === 'connecting' || connectionStatusRef.current === 'disconnecting') return;

            setConnectionStatusValue('connecting');
            if (isReconnect) {
                setStats({ cpu: '...', mem: '...', disk: '...' });
                term.write(`\r\n\x1b[36m${reconnectingLabelRef.current}\x1b[0m\r\n`);
            }

            invoke('connect-ssh', { sessionId, server: session, options: {} })
                .then(() => {
                    if (disposed) return;

                    setConnectionStatusValue('connected');
                    term.focus();
                    send(`ssh-resize-${sessionId}`, { cols: term.cols, rows: term.rows });
                    fetchStats(sessionId);
                })
                .catch((err: Error) => {
                    if (disposed) return;

                    setConnectionStatusValue('disconnected');
                    term.write(`\r\n\x1b[31m${connectionErrorLabelRef.current} ${formatConnectError(err.message, authFailedLabelRef.current)}\x1b[0m`);
                    writeReconnectPrompt();
                });
        };

        const disconnectSsh = (reconnectAfter = false) => {
            if (disposed) return;

            reconnectAfterDisconnectRef.current = reconnectAfter;

            if (connectionStatusRef.current === 'disconnected') {
                if (reconnectAfter) {
                    reconnectAfterDisconnectRef.current = false;
                    connectSsh(true);
                }
                return;
            }

            if (connectionStatusRef.current === 'disconnecting') {
                return;
            }

            setConnectionStatusValue('disconnecting');
            setStats({ cpu: '...', mem: '...', disk: '...' });
            invoke('disconnect-ssh', sessionId)
                .catch(() => { })
                .finally(() => {
                    if (disposed) return;

                    setConnectionStatusValue('disconnected');

                    if (reconnectAfterDisconnectRef.current) {
                        reconnectAfterDisconnectRef.current = false;
                        connectSsh(true);
                        return;
                    }

                    writeDisconnectedMessage();
                    onDisconnected();
                });
        };

        connectRequestRef.current = connectSsh;
        disconnectRequestRef.current = disconnectSsh;

        term.onData((data) => {
            if (connectionStatusRef.current === 'disconnected') {
                if (data === '\r' || data === '\n' || data === '\r\n') {
                    connectSsh(true);
                }
                return;
            }

            if (connectionStatusRef.current !== 'connected') return;

            send(`ssh-write-${sessionId}`, data);
        });

        term.onSelectionChange(() => {
            copySelection();
        });

        term.onResize(({ cols, rows }) => {
            send(`ssh-resize-${sessionId}`, { cols, rows });
        });

        const handleWindowResize = () => {
            scheduleFit();
        };

        const offWindowLayoutChange = on('window-layout-changed', () => {
            scheduleFit();
        });

        const resizeObserver = new ResizeObserver(() => {
            scheduleFit(false);
        });
        resizeObserver.observe(terminalRef.current);
        if (terminalRef.current.parentElement) {
            resizeObserver.observe(terminalRef.current.parentElement);
        }
        window.addEventListener('resize', handleWindowResize);
        window.addEventListener('focus', handleWindowResize);

        scheduleFit();
        connectSsh();

        return () => {
            disposed = true;
            connectRequestRef.current = null;
            disconnectRequestRef.current = null;
            sessionChannelRef.current = null;
            onSessionChannelReady?.(null);
            stopAutomation();
            offData();
            offClose();
            offWindowLayoutChange();
            terminalRef.current?.removeEventListener('contextmenu', handleContextMenu);
            if (fitFrameId !== null) {
                window.cancelAnimationFrame(fitFrameId);
            }
            clearScheduledFits();
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleWindowResize);
            window.removeEventListener('focus', handleWindowResize);
            term.dispose();
            invoke('disconnect-ssh', sessionId).catch(() => { });
        };
    }, [session]);

    useEffect(() => {
        if (!termInstance.current) return;

        termInstance.current.options.theme = getTerminalTheme(theme);
        termInstance.current.refresh(0, termInstance.current.rows - 1);
    }, [theme]);

    useEffect(() => {
        if (!reconnectSignal) return;
        disconnectRequestRef.current?.(true);
    }, [reconnectSignal]);

    useEffect(() => {
        if (!disconnectSignal) return;
        disconnectRequestRef.current?.(false);
    }, [disconnectSignal]);

    const fetchStats = async (sid: string) => {
        try {
            const cpuRaw = await invoke('exec-command', { sessionId: sid, command: "top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'" });
            const memRaw = await invoke('exec-command', { sessionId: sid, command: "free -m | awk 'NR==2{printf \"%.2f%%\", $3*100/$2 }'" });
            const diskRaw = await invoke('exec-command', { sessionId: sid, command: "df -h / | awk 'NR==2{print $5}'" });

            setStats({
                cpu: `${String(cpuRaw).trim()}%`,
                mem: String(memRaw).trim(),
                disk: String(diskRaw).trim()
            });
        } catch (error) {
            console.log('Stats fetch failed', error);
            setStats({ cpu: 'N/A', mem: 'N/A', disk: 'N/A' });
        }
    };

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
            <div className="absolute left-0 right-0 top-0 z-10 flex h-10 items-center justify-between gap-4 border-b border-border bg-surface/80 px-4 backdrop-blur">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0 shrink-0 items-center gap-2 text-sm text-textMuted sm:flex">
                        <Server className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{connectionAddress}</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                        {QUICK_ACTIONS.map((action) => {
                            const isRunning = runningAction === action.key;
                            const isDisabled = connectionStatusState !== 'connected'
                                || (action.key === 'installSingbox' && !!runningAction && !isRunning);
                            const label = locale === 'zh' ? action.labels.zh : action.labels.en;

                            return (
                                <button
                                    key={action.key}
                                    type="button"
                                    onClick={() => runQuickAction(action.key)}
                                    disabled={isDisabled}
                                    className={`shrink-0 whitespace-nowrap rounded-md border px-3 py-1 text-xs font-medium transition-colors ${isRunning ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background/70 text-textMuted hover:border-primary/40 hover:text-textMain'} disabled:cursor-not-allowed disabled:opacity-50`}
                                    title={label}
                                >
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => {
                                void loadLatestUrlFromLocal();
                            }}
                            className="shrink-0 whitespace-nowrap rounded-md border border-border bg-background/70 px-3 py-1 text-xs font-medium text-textMuted transition-colors hover:border-primary/40 hover:text-textMain"
                            title={latestUrlButtonLabel}
                        >
                            <span>{latestUrlButtonLabel}</span>
                        </button>
                    </div>
                </div>
                <div className="hidden shrink-0 items-center justify-end gap-6 md:flex">
                    <div className="flex items-center gap-2 text-sm text-textMuted">
                        <Cpu className="h-4 w-4 text-primary" />
                        <span>{t('terminal.cpu')}: {stats.cpu}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-textMuted">
                        <Activity className="h-4 w-4 text-secondary" />
                        <span>{t('terminal.mem')}: {stats.mem}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-textMuted">
                        <HardDrive className="h-4 w-4 text-accent" />
                        <span>{t('terminal.disk')}: {stats.disk}</span>
                    </div>
                </div>
            </div>

            <div className="absolute inset-x-2 bottom-2 top-10 min-h-0 overflow-hidden">
                <div ref={terminalRef} className="h-full min-h-0 w-full" />
            </div>

            {latestUrlModalOpen && (
                <LatestUrlModal
                    url={latestUrlValue}
                    onClose={() => setLatestUrlModalOpen(false)}
                />
            )}
        </div>
    );
}
