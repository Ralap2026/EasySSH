import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, X } from 'lucide-react';
import { useIPC } from '../hooks/useIPC';
import { useI18n } from '../i18n';

type ServerDraft = {
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    privateKeyPath: string;
    remark: string;
};

type ParsedServer = {
    lineNumber: number;
    server: ServerDraft;
};

type ParseResult = {
    servers: ParsedServer[];
    errors: string[];
};

function parseConnectionToken(token: string, name = '', remark = ''): ServerDraft | null {
    const match = token.match(/^(?:(?<username>[^:@\s]+)(?::(?<password>[^@\s]*))?@)?(?<host>\[[^\]]+\]|[^:\s]+)(?::(?<port>\d+))?$/);
    if (!match?.groups?.host) return null;

    const host = match.groups.host.replace(/^\[|\]$/g, '');
    const username = match.groups.username || 'root';
    const port = Number(match.groups.port || 22);

    if (!host || !username || !Number.isInteger(port) || port <= 0 || port > 65535) return null;

    return {
        name: name || host,
        host,
        port,
        username,
        password: match.groups.password || '',
        privateKeyPath: '',
        remark,
    };
}

function parseDelimited(parts: string[]): ServerDraft | null {
    const values = parts.map((item) => item.trim()).filter(Boolean);
    if (values.length < 3) return null;

    let name = '';
    let host = '';
    let port = 22;
    let username = 'root';
    let password = '';
    let remark = '';

    if (/^\d+$/.test(values[1])) {
        [host] = values;
        port = Number(values[1]);
        username = values[2] || 'root';
        password = values[3] || '';
        remark = values.slice(4).join(' ');
        name = host;
    } else if (/^\d+$/.test(values[2])) {
        [name, host] = values;
        port = Number(values[2]);
        username = values[3] || 'root';
        password = values[4] || '';
        remark = values.slice(5).join(' ');
    } else {
        return null;
    }

    if (!host || !username || !Number.isInteger(port) || port <= 0 || port > 65535) return null;

    return { name: name || host, host, port, username, password, privateKeyPath: '', remark };
}

function parseServerLine(rawLine: string): ServerDraft | null {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return null;

    if (/[,\t|]/.test(line)) {
        const parsed = parseDelimited(line.split(/[,\t|]/));
        if (parsed) return parsed;
    }

    const tokens = line.split(/\s+/);
    if (tokens.length >= 2 && tokens[1].includes('@')) {
        const parsed = parseConnectionToken(tokens[1], tokens[0]);
        if (!parsed) return null;

        if (!parsed.password && tokens.length >= 3) {
            parsed.password = tokens[2];
            parsed.remark = tokens.slice(3).join(' ');
        } else {
            parsed.remark = tokens.slice(2).join(' ');
        }

        return parsed;
    }

    const parsedToken = parseConnectionToken(tokens[0], '', tokens.slice(1).join(' '));
    if (parsedToken) return parsedToken;

    if (tokens.length >= 3 && /^\d+$/.test(tokens[1])) {
        return parseDelimited(tokens);
    }

    return null;
}

function parseServers(text: string, lineErrorText: (lineNumber: number) => string): ParseResult {
    const servers: ParsedServer[] = [];
    const errors: string[] = [];

    text.split(/\r?\n/).forEach((line, index) => {
        if (!line.trim() || line.trim().startsWith('#')) return;

        const server = parseServerLine(line);
        if (server) {
            servers.push({ lineNumber: index + 1, server });
        } else {
            errors.push(lineErrorText(index + 1));
        }
    });

    return { servers, errors };
}

export default function BatchServerModal({
    onClose,
    onSuccess,
}: {
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { invoke } = useIPC();
    const { t } = useI18n();
    const [text, setText] = useState('');
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState('');
    const parsed = useMemo(() => parseServers(text, (lineNumber) => t('batch.lineFormatError', { lineNumber })), [text, t]);

    const handleImport = async () => {
        setMessage('');

        if (parsed.errors.length > 0) {
            setMessage(t('batch.fixUnrecognized'));
            return;
        }

        if (parsed.servers.length === 0) {
            setMessage(t('batch.enterAtLeastOneHost'));
            return;
        }

        setImporting(true);
        try {
            for (const item of parsed.servers) {
                await invoke('add-server', item.server);
            }
            onSuccess();
        } catch (err) {
            setMessage(t('batch.importFailed', { error: String(err) }));
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-4xl rounded-2xl relative overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">{t('batch.title')}</h2>
                        <p className="text-sm text-textMuted mt-1">{t('batch.subtitle')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="group inline-flex h-9 w-9 items-center justify-center rounded-lg text-textMuted transition-all duration-200 hover:bg-surfaceHover hover:text-textMain"
                    >
                        <X className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
                    <div className="flex flex-col min-h-[420px]">
                        <label className="text-sm font-medium text-textMuted mb-2">{t('batch.hostList')}</label>
                        <textarea
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            className="glass-input flex-1 w-full resize-none font-mono text-sm leading-relaxed"
                            placeholder={[
                                'root:password@192.168.1.10:22',
                                'web01 root@192.168.1.11:22 password production-server',
                                '192.168.1.12 22 root password',
                                'web02,192.168.1.13,22,root,password,remark',
                            ].join('\n')}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-xl border border-border bg-surface/60 p-4">
                            <div className="flex items-center gap-2 font-medium">
                                <ClipboardList className="w-4 h-4 text-primary" />
                                {t('batch.preview')}
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-background/70 p-3">
                                    <p className="text-textMuted">{t('batch.importable')}</p>
                                    <p className="text-2xl font-bold text-primary">{parsed.servers.length}</p>
                                </div>
                                <div className="rounded-lg bg-background/70 p-3">
                                    <p className="text-textMuted">{t('batch.errorLines')}</p>
                                    <p className={`text-2xl font-bold ${parsed.errors.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {parsed.errors.length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-textMuted space-y-2">
                            <p className="font-medium text-textMain">{t('batch.supportedFormats')}</p>
                            <p>{t('batch.format1')}</p>
                            <p>{t('batch.format2')}</p>
                            <p>{t('batch.format3')}</p>
                            <p>{t('batch.format4')}</p>
                        </div>

                        {parsed.errors.length > 0 && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
                                <div className="flex items-center gap-2 font-medium mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {t('batch.needFix')}
                                </div>
                                <div className="space-y-1 max-h-28 overflow-y-auto">
                                    {parsed.errors.map((error) => (
                                        <p key={error}>{error}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {message && (
                            <div className="rounded-xl border border-border bg-background/70 p-4 text-sm text-textMuted">
                                {message}
                            </div>
                        )}

                        {parsed.servers.length > 0 && parsed.errors.length === 0 && (
                            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-600">
                                <div className="flex items-center gap-2 font-medium">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {t('batch.formatCheckPassed')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface/50">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-textMuted hover:bg-surfaceHover">
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={importing || parsed.servers.length === 0}
                        className="btn-primary"
                    >
                        {importing ? t('batch.importing') : t('batch.startImport')}
                    </button>
                </div>
            </div>
        </div>
    );
}
