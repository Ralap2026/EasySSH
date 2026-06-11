import { Check, Copy, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useIPC } from '../hooks/useIPC';
import { useI18n } from '../i18n';

export default function LatestUrlModal({
    url,
    onClose
}: {
    url: string;
    onClose: () => void;
}) {
    const { locale } = useI18n();
    const { writeClipboardText } = useIPC();
    const [copied, setCopied] = useState(false);

    const labels = useMemo(() => ({
        title: locale === 'zh' ? '最新 URL' : 'Latest URL',
        prompt: locale === 'zh'
            ? '请将此段信息粘帖到v2ray-windows64软件中(直接paste粘帖即可)。'
            : 'Paste this URL into v2ray-windows64 directly.',
        empty: locale === 'zh' ? '本地还没有保存的URL。' : 'No saved URL yet.',
        close: locale === 'zh' ? '关闭' : 'Close',
        copy: locale === 'zh' ? '复制' : 'Copy',
        copied: locale === 'zh' ? '已复制' : 'Copied'
    }), [locale]);

    useEffect(() => {
        if (!copied) return;

        const timer = window.setTimeout(() => setCopied(false), 1600);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const handleCopy = async () => {
        if (!url) return;
        await writeClipboardText(url);
        setCopied(true);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-3xl overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-textMain">{labels.title}</h2>
                        <p className="mt-1 text-sm text-textMuted">{labels.prompt}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="group inline-flex h-9 w-9 items-center justify-center rounded-lg text-textMuted transition-all duration-200 hover:bg-surfaceHover hover:text-textMain"
                        title={labels.close}
                    >
                        <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                </div>

                <div className="px-6 py-5">
                    <div className="rounded-xl border border-border bg-background/70 p-4">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={handleCopy}
                                disabled={!url}
                                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface/85 text-textMuted transition-colors hover:border-primary/40 hover:text-textMain disabled:cursor-not-allowed disabled:opacity-40"
                                title={copied ? labels.copied : labels.copy}
                            >
                                {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </button>
                            <textarea
                                readOnly
                                value={url || labels.empty}
                                className="h-48 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 pr-16 font-mono text-sm text-textMain outline-none"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end border-t border-border bg-surface/50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-textMuted transition-colors hover:bg-surfaceHover"
                    >
                        {labels.close}
                    </button>
                </div>
            </div>
        </div>
    );
}
