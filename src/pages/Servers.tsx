import { useState, useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { FileStack, Plus, TerminalSquare, Edit, Trash2 } from 'lucide-react';
import ServerModal from '../components/ServerModal';
import BatchServerModal from '../components/BatchServerModal';
import { useI18n } from '../i18n';

export default function Servers({ onConnect }: { onConnect: (server: any) => void }) {
    const { invoke } = useIPC();
    const { t, locale } = useI18n();
    const [servers, setServers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [editingServer, setEditingServer] = useState<any>(null);

    const fetchServers = async () => {
        try {
            const data = await invoke('get-servers');
            setServers((data as any[]) || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
    }, []);

    const handleDelete = async (id: number) => {
        if (window.confirm(t('servers.deleteConfirm'))) {
            await invoke('delete-server', id);
            fetchServers();
        }
    };

    const createdAtLabel = locale === 'zh' ? '创建时间' : 'Created';
    const lastUsedAtLabel = locale === 'zh' ? '最近使用' : 'Last Used';
    const emptyTimeLabel = locale === 'zh' ? '暂无' : 'Never';

    const formatDateTime = (value?: string | null) => {
        if (!value) {
            return emptyTimeLabel;
        }

        const date = new Date(value.replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="h-full flex flex-col pt-4">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8 px-2">
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold">{t('servers.title')}</h1>
                    <p className="text-textMuted mt-1">{t('servers.subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        className="btn-primary bg-none bg-surface text-primary border border-primary/30 hover:bg-primary/10"
                        onClick={() => setShowBatchModal(true)}
                    >
                        <FileStack className="w-5 h-5" /> {t('servers.batchAdd')}
                    </button>
                    <button className="btn-primary" onClick={() => { setEditingServer(null); setShowModal(true); }}>
                        <Plus className="w-5 h-5" /> {t('servers.addHost')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-textMuted">{t('common.loading')}</div>
            ) : servers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-textMuted border-2 border-dashed border-border rounded-2xl p-8 bg-surface/20">
                    <TerminalSquare className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg">{t('servers.emptyTitle')}</p>
                    <p className="text-sm mt-2 opacity-70">{t('servers.emptySubtitle')}</p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <button
                            className="btn-primary bg-none bg-surface text-primary border border-primary/30 hover:bg-primary/10"
                            onClick={() => setShowBatchModal(true)}
                        >
                            <FileStack className="w-5 h-5" /> {t('servers.batchAdd')}
                        </button>
                        <button className="btn-primary" onClick={() => { setEditingServer(null); setShowModal(true); }}>
                            <Plus className="w-5 h-5" /> {t('servers.addHost')}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,260px))] gap-4 px-2 overflow-y-auto pb-8 justify-start">
                    {servers.map(server => (
                        <div key={server.id} className="glass-panel min-h-[196px] p-4 rounded-xl transition-colors duration-300 relative group cursor-pointer border border-border hover:border-primary/50 hover:shadow-glow" onClick={() => onConnect(server)}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-primary/20 p-2 rounded-lg border border-primary/30 text-primary">
                                    <TerminalSquare className="w-5 h-5" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 hover:bg-surfaceHover rounded-lg text-textMuted hover:text-secondary transition-colors" onClick={(e) => { e.stopPropagation(); setEditingServer(server); setShowModal(true); }}>
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button className="p-2 hover:bg-red-500/20 rounded-lg text-textMuted hover:text-red-400 transition-colors" onClick={(e) => { e.stopPropagation(); handleDelete(server.id); }}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold truncate">{server.name || server.host}</h3>
                            <p className="text-textMuted font-mono text-xs mt-2 truncate flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                {server.username}@{server.host}:{server.port}
                            </p>
                            {server.remark && <p className="text-textMuted/70 text-xs mt-2 truncate">{server.remark}</p>}
                            <div className="mt-4 space-y-2 rounded-lg border border-border/70 bg-surface/45 px-3 py-2">
                                <div className="flex items-center justify-between gap-3 text-[11px]">
                                    <span className="shrink-0 text-textMuted/80">{createdAtLabel}</span>
                                    <span className="truncate text-right text-textMain/80">{formatDateTime(server.created_at)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-[11px]">
                                    <span className="shrink-0 text-textMuted/80">{lastUsedAtLabel}</span>
                                    <span className="truncate text-right text-textMain/80">{formatDateTime(server.last_used_at)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <ServerModal
                    server={editingServer}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); fetchServers(); }}
                />
            )}

            {showBatchModal && (
                <BatchServerModal
                    onClose={() => setShowBatchModal(false)}
                    onSuccess={() => { setShowBatchModal(false); fetchServers(); }}
                />
            )}
        </div>
    );
}
