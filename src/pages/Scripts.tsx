import { useState, useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { Plus, Code2, Play, TerminalSquare } from 'lucide-react';
import { useI18n } from '../i18n';

export default function Scripts({ activeSessions, onDeploy }: { activeSessions: any[], onDeploy: (script: any, sessionId: number) => void }) {
    const { invoke } = useIPC();
    const { t } = useI18n();
    const [scripts, setScripts] = useState<any[]>([]);
    const [selectedScript, setSelectedScript] = useState<any>(null);
    const [form, setForm] = useState({ name: '', content: '' });
    const [targetSession, setTargetSession] = useState<number | ''>('');

    const fetchScripts = async () => {
        try {
            const data = await invoke('get-scripts');
            setScripts((data as any[]) || []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchScripts();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await invoke('add-script', form);
            setForm({ name: '', content: '' });
            setSelectedScript(null);
            fetchScripts();
        } catch {
            alert(t('scripts.saveFailed'));
        }
    };

    return (
        <div className="h-full flex flex-col pt-4">
            <div className="flex justify-between items-center mb-8 px-2">
                <div>
                    <h1 className="text-3xl font-bold">{t('scripts.title')}</h1>
                    <p className="text-textMuted mt-1">{t('scripts.subtitle')}</p>
                </div>
                <button className="btn-primary" onClick={() => setSelectedScript('new')}>
                    <Plus className="w-5 h-5" /> {t('scripts.newScript')}
                </button>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden pb-4">
                <div className="w-1/3 overflow-y-auto space-y-3">
                    {scripts.map(s => (
                        <div
                            key={s.id}
                            onClick={() => setSelectedScript(s)}
                            className={`glass-panel p-4 rounded-xl cursor-pointer transition-colors border ${selectedScript?.id === s.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-surfaceHover rounded-lg text-primary">
                                    <Code2 className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold truncate">{s.name}</h3>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="w-2/3 glass-panel rounded-2xl flex flex-col overflow-hidden">
                    {selectedScript === 'new' ? (
                        <form onSubmit={handleSave} className="p-6 flex flex-col h-full bg-surface/50">
                            <h2 className="text-xl font-bold mb-4">{t('scripts.writeNew')}</h2>
                            <input required placeholder={t('scripts.namePlaceholder')} className="glass-input w-full mb-4" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            <textarea required placeholder="#!/bin/bash\n\necho 'Hello World'" className="glass-input w-full flex-1 font-mono text-sm leading-relaxed p-4" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                            <div className="mt-4 flex justify-end gap-3">
                                <button type="button" className="px-4 py-2 hover:bg-surfaceHover rounded-lg" onClick={() => setSelectedScript(null)}>{t('common.cancel')}</button>
                                <button type="submit" className="btn-primary">{t('scripts.saveSnippet')}</button>
                            </div>
                        </form>
                    ) : selectedScript ? (
                        <div className="p-6 flex flex-col h-full bg-surface/50">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold">{selectedScript.name}</h2>
                                <div className="flex gap-2">
                                    <select className="glass-input py-1" value={targetSession} onChange={e => setTargetSession(e.target.value ? Number(e.target.value) : '')}>
                                        <option value="">{t('scripts.targetSessionPlaceholder')}</option>
                                        {activeSessions.map(s => <option key={s.id} value={s.id}>{s.displayName || s.name}</option>)}
                                    </select>
                                    <button
                                        className="btn-primary py-1"
                                        disabled={!targetSession}
                                        onClick={() => onDeploy(selectedScript, targetSession as number)}
                                    >
                                        <Play className="w-4 h-4" /> {t('scripts.runNow')}
                                    </button>
                                </div>
                            </div>
                            <pre className="flex-1 glass-input bg-background/80 overflow-auto p-4 font-mono text-sm text-green-400">
                                {selectedScript.content}
                            </pre>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-textMuted opacity-50">
                            <TerminalSquare className="w-16 h-16 mb-4" />
                            <p>{t('scripts.emptyState')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
