import { useState, useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { Network, TerminalSquare, Save, Sun, Moon } from 'lucide-react';
import type { ThemeMode } from '../App';
import { useI18n } from '../i18n';

export default function Settings({ theme, onThemeChange }: { theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void }) {
    const { invoke } = useIPC();
    const { t } = useI18n();
    const [proxy, setProxy] = useState('');
    const [autoExec, setAutoExec] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await invoke('get-settings');
                const map: Record<string, string> = {};
                (data as any[])?.forEach((s: any) => { map[s.key] = s.value; });

                if (map.socksProxy) setProxy(map.socksProxy);
                if (map.autoExecution) setAutoExec(map.autoExecution);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [invoke]);

    const handleSave = async (key: string, value: string) => {
        try {
            await invoke('save-setting', { key, value });
        } catch (err) {
            const target = key === 'socksProxy' ? t('settings.proxyTarget') : t('settings.autoExecTarget');
            alert(t('settings.saveFailed', { target, error: String(err) }));
        }
    };

    if (loading) return null;

    return (
        <div className="h-full flex flex-col pt-4 overflow-y-auto">
            <div className="mb-8 px-2">
                <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
                <p className="text-textMuted mt-1">{t('settings.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2 max-w-4xl">
                <div className="glass-panel p-6 rounded-2xl flex flex-col relative border-border border">
                    <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                        <div className="p-2 bg-surfaceHover rounded-lg text-primary">
                            {theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </div>
                        <h2 className="text-xl font-bold">{t('settings.appearanceTitle')}</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => onThemeChange('light')}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-colors ${theme === 'light' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-textMuted hover:bg-surfaceHover hover:text-textMain'}`}
                        >
                            <Sun className="w-4 h-4" />
                            {t('common.light')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onThemeChange('dark')}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-colors ${theme === 'dark' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-textMuted hover:bg-surfaceHover hover:text-textMain'}`}
                        >
                            <Moon className="w-4 h-4" />
                            {t('common.dark')}
                        </button>
                    </div>
                    <p className="text-xs text-textMuted mt-4 opacity-80">
                        {t('settings.appearanceDescription')}
                    </p>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex flex-col relative border-border border">
                    <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                        <div className="p-2 bg-surfaceHover rounded-lg text-primary">
                            <Network className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold">{t('settings.proxyTitle')}</h2>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm text-textMuted mb-2">{t('settings.proxyLabel')}</label>
                        <input
                            type="text"
                            className="glass-input w-full"
                            placeholder={t('settings.proxyPlaceholder')}
                            value={proxy}
                            onChange={e => setProxy(e.target.value)}
                        />
                        <p className="text-xs text-textMuted mt-2 opacity-70">
                            {t('settings.proxyDescription')}
                        </p>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button className="btn-primary py-2 px-6" onClick={() => handleSave('socksProxy', proxy)}>
                            <Save className="w-4 h-4" /> {t('settings.saveProxy')}
                        </button>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex flex-col relative border-border border md:col-span-2">
                    <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
                        <div className="p-2 bg-surfaceHover rounded-lg text-secondary">
                            <TerminalSquare className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold">{t('settings.autoExecTitle')}</h2>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm text-textMuted mb-2">{t('settings.autoExecLabel')}</label>
                        <textarea
                            className="glass-input w-full h-32 font-mono text-sm leading-relaxed"
                            placeholder={t('settings.autoExecPlaceholder')}
                            value={autoExec}
                            onChange={e => setAutoExec(e.target.value)}
                        />
                        <p className="text-xs text-textMuted mt-2 opacity-70">
                            {t('settings.autoExecDescription')}
                        </p>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button className="btn-primary py-2 px-6" onClick={() => handleSave('autoExecution', autoExec)}>
                            <Save className="w-4 h-4" /> {t('settings.saveCommand')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
