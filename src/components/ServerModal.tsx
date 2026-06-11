import { useState, useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { X, Wand2 } from 'lucide-react';
import { useI18n } from '../i18n';

export default function ServerModal({
    onClose,
    onSuccess,
    server = null
}: {
    onClose: () => void,
    onSuccess: () => void,
    server?: any
}) {
    const { invoke } = useIPC();
    const { t } = useI18n();
    const [formData, setFormData] = useState({
        name: '', host: '', port: 22, username: 'root', password: '', privateKeyPath: '', remark: ''
    });
    const [smartText, setSmartText] = useState('');

    useEffect(() => {
        if (server) {
            setFormData(server);
        }
    }, [server]);

    const handleSmartPaste = () => {
        let newFormData = { ...formData };
        const regex1 = /(?:([^:@]+)(?::([^@]+))?@)?([^:\s]+)(?::(\d+))?/;
        const match = smartText.trim().match(regex1);

        if (match) {
            if (match[1]) newFormData.username = match[1];
            if (match[2]) newFormData.password = match[2];
            if (match[3]) newFormData.host = match[3];
            if (match[4]) newFormData.port = Number(match[4]);

            if (!newFormData.name) newFormData.name = newFormData.host;
            setFormData(newFormData);
            setSmartText('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (server) {
                await invoke('update-server', { id: server.id, ...formData });
            } else {
                await invoke('add-server', formData);
            }
            onSuccess();
        } catch (err) {
            alert(t('serverModal.saveFailed', { error: String(err) }));
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-2xl rounded-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <h2 className="text-xl font-bold">{server ? t('serverModal.editTitle') : t('serverModal.addTitle')}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="group inline-flex h-9 w-9 items-center justify-center rounded-lg text-textMuted transition-all duration-200 hover:bg-surfaceHover hover:text-textMain"
                    >
                        <X className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {!server && (
                        <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                            <label className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                                <Wand2 className="w-4 h-4" /> {t('serverModal.smartDetectTitle')}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={smartText}
                                    onChange={e => setSmartText(e.target.value)}
                                    placeholder={t('serverModal.smartDetectPlaceholder')}
                                    className="glass-input flex-1 bg-background"
                                />
                                <button type="button" onClick={handleSmartPaste} className="btn-primary py-1 px-4">
                                    {t('serverModal.parse')}
                                </button>
                            </div>
                        </div>
                    )}

                    <form id="server-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm text-textMuted mb-1">{t('serverModal.nameLabel')}</label>
                            <input required type="text" className="glass-input w-full" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm text-textMuted mb-1">{t('serverModal.remarkLabel')}</label>
                            <input type="text" className="glass-input w-full" value={formData.remark} onChange={e => setFormData({ ...formData, remark: e.target.value })} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm text-textMuted mb-1">{t('serverModal.hostLabel')}</label>
                            <input required type="text" className="glass-input w-full" value={formData.host} onChange={e => setFormData({ ...formData, host: e.target.value })} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm text-textMuted mb-1">{t('serverModal.portLabel')}</label>
                            <input required type="number" className="glass-input w-full" value={formData.port} onChange={e => setFormData({ ...formData, port: Number(e.target.value) })} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm text-textMuted mb-1">{t('serverModal.usernameLabel')}</label>
                            <input required type="text" className="glass-input w-full" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-sm text-textMuted mb-1">{t('serverModal.passwordLabel')}</label>
                            <input type="password" placeholder={t('serverModal.passwordPlaceholder')} className="glass-input w-full" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm text-textMuted mb-1">{t('serverModal.privateKeyLabel')}</label>
                            <input type="text" placeholder={t('serverModal.privateKeyPlaceholder')} className="glass-input w-full" value={formData.privateKeyPath} onChange={e => setFormData({ ...formData, privateKeyPath: e.target.value })} />
                        </div>
                    </form>
                </div>

                <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface/50">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-textMuted hover:bg-surfaceHover">{t('common.cancel')}</button>
                    <button type="submit" form="server-form" className="btn-primary">{t('serverModal.saveHost')}</button>
                </div>
            </div>
        </div>
    );
}
