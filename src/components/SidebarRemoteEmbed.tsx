import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useIPC } from '../hooks/useIPC';
import { useI18n } from '../i18n';

const REMOTE_EMBED_URL = 'https://wishflow.dpdns.org/in/inset.html';

export default function SidebarRemoteEmbed() {
    const { invoke, isElectron } = useIPC();
    const { locale } = useI18n();
    const [status, setStatus] = useState<'checking' | 'ready' | 'hidden'>('checking');
    const [resolvedUrl, setResolvedUrl] = useState(REMOTE_EMBED_URL);

    const labels = useMemo(() => ({
        checking: locale === 'zh' ? '正在检测远程页面...' : 'Checking remote page...',
    }), [locale]);

    useEffect(() => {
        let cancelled = false;

        const runCheck = async () => {
            if (!isElectron) {
                setStatus('hidden');
                return;
            }

            try {
                const result = await invoke<{ ok: boolean; url?: string }>('check-remote-embed-page', REMOTE_EMBED_URL);
                if (cancelled) return;

                if (result?.ok && result.url) {
                    setResolvedUrl(result.url);
                    setStatus('ready');
                    return;
                }
            } catch {
            }

            if (!cancelled) {
                setStatus('hidden');
            }
        };

        runCheck();

        return () => {
            cancelled = true;
        };
    }, [invoke, isElectron]);

    if (status === 'hidden') {
        return null;
    }

    return (
        <div className="mt-6 border-t border-border pt-6">
            <div className="h-[420px] overflow-hidden rounded-xl border border-border bg-background/55">
                {status === 'checking' ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-textMuted">
                        <div className="flex flex-col items-center gap-3">
                            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                            <span>{labels.checking}</span>
                        </div>
                    </div>
                ) : (
                    <webview
                        src={resolvedUrl}
                        className="h-full w-full"
                        allowpopups={false}
                    />
                )}
            </div>
        </div>
    );
}
