import { useEffect, useMemo, useState } from 'react';
import { FolderUp, LoaderCircle, Upload, X } from 'lucide-react';
import { useIPC } from '../hooks/useIPC';
import { useI18n } from '../i18n';

type SelectedFile = {
    path: string;
    name: string;
    size: number;
};

type UploadProgressPayload = {
    transferred: number;
    total: number;
    fileName: string;
    remotePath: string;
};

function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export default function UploadFileModal({
    sessionChannelId,
    sessionName,
    onClose
}: {
    sessionChannelId: string;
    sessionName: string;
    onClose: () => void;
}) {
    const { invoke, on } = useIPC();
    const { locale } = useI18n();
    const [remoteDir, setRemoteDir] = useState('/root');
    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState<UploadProgressPayload | null>(null);

    const labels = useMemo(() => ({
        title: locale === 'zh' ? '上传文件' : 'Upload File',
        subtitle: locale === 'zh' ? `上传文件到会话 ${sessionName}` : `Upload a file to session ${sessionName}`,
        localFile: locale === 'zh' ? '本地文件' : 'Local Files',
        chooseFile: locale === 'zh' ? '选择文件' : 'Choose Files',
        remoteDir: locale === 'zh' ? '远程目录' : 'Remote Directory',
        fileCount: locale === 'zh' ? '文件数' : 'Files',
        remotePath: locale === 'zh' ? '目标目录' : 'Target Directory',
        cancel: locale === 'zh' ? '取消' : 'Cancel',
        startUpload: locale === 'zh' ? '开始上传' : 'Start Upload',
        selectFileFirst: locale === 'zh' ? '请先选择本地文件。' : 'Please choose local files first.',
        remoteDirRequired: locale === 'zh' ? '请填写远程目录。' : 'Please enter the remote directory.',
        completed: locale === 'zh' ? '文件上传完成，终端已刷新目录列表。' : 'Upload completed. The terminal directory listing has been refreshed.',
        uploading: locale === 'zh' ? '正在上传...' : 'Uploading...',
        totalSize: locale === 'zh' ? '总大小' : 'Total Size',
        clearList: locale === 'zh' ? '清空' : 'Clear',
    }), [locale, sessionName]);

    useEffect(() => {
        const offProgress = on(`ssh-upload-progress-${sessionChannelId}`, (payload: UploadProgressPayload) => {
            setProgress(payload);
        });

        return () => {
            offProgress();
        };
    }, [on, sessionChannelId]);

    const normalizedRemoteDir = useMemo(() => {
        const dir = remoteDir.trim().replace(/\\/g, '/').replace(/\/+$/, '');
        return dir || '';
    }, [remoteDir]);

    const progressPercent = progress && progress.total > 0
        ? Math.min(100, Math.round((progress.transferred / progress.total) * 100))
        : 0;
    const totalSelectedSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

    const pickLocalFile = async () => {
        const files = await invoke<SelectedFile[]>('pick-upload-files');
        if (!files || files.length === 0) return;

        setSelectedFiles(files);
        setMessage('');
    };

    const startUpload = async () => {
        if (selectedFiles.length === 0) {
            setMessage(labels.selectFileFirst);
            return;
        }

        if (!remoteDir.trim()) {
            setMessage(labels.remoteDirRequired);
            return;
        }

        setUploading(true);
        setMessage('');
        setProgress({
            transferred: 0,
            total: 0,
            fileName: selectedFiles[0]?.name || '',
            remotePath: normalizedRemoteDir
        });

        try {
            await invoke('upload-files-to-session', {
                sessionId: sessionChannelId,
                files: selectedFiles,
                remoteDir: normalizedRemoteDir
            });
            setMessage(labels.completed);
        } catch (error) {
            setMessage(String(error));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-xl overflow-hidden rounded-2xl border border-border">
                <div className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold">{labels.title}</h2>
                        <p className="mt-1 text-sm text-textMuted">{labels.subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="group inline-flex h-9 w-9 items-center justify-center rounded-lg text-textMuted transition-all duration-200 hover:bg-surfaceHover hover:text-textMain"
                    >
                        <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-5">
                    <div className="rounded-xl border border-border bg-surface/55 p-4">
                        <label className="mb-2 block text-sm font-medium text-textMuted">{labels.localFile}</label>
                        <div className="flex gap-3">
                            <div className="glass-input w-full bg-background/70">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-textMuted">{labels.fileCount}</span>
                                    <span className="text-textMain">{selectedFiles.length}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                    <span className="text-textMuted">{labels.totalSize}</span>
                                    <span className="text-textMain">{formatBytes(totalSelectedSize)}</span>
                                </div>
                            </div>
                            <button type="button" onClick={pickLocalFile} className="btn-primary shrink-0">
                                <FolderUp className="h-4 w-4" />
                                {labels.chooseFile}
                            </button>
                        </div>
                        {selectedFiles.length > 0 && (
                            <div className="mt-3 rounded-lg border border-border/70 bg-background/60 p-3">
                                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-textMuted">
                                    <span>{labels.localFile}</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedFiles([])}
                                        className="rounded-md px-2 py-1 transition-colors hover:bg-surfaceHover hover:text-textMain"
                                    >
                                        {labels.clearList}
                                    </button>
                                </div>
                                <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
                                    {selectedFiles.map((file) => (
                                        <div key={file.path} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-textMain">
                                            <span className="truncate">{file.name}</span>
                                            <span className="shrink-0 text-textMuted">{formatBytes(file.size)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-textMuted">{labels.remoteDir}</label>
                        <input
                            type="text"
                            value={remoteDir}
                            onChange={(event) => setRemoteDir(event.target.value)}
                            className="glass-input w-full"
                        />
                    </div>

                    <div className="rounded-xl border border-border bg-background/65 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-textMuted">{labels.remotePath}</span>
                            <span className="truncate text-right font-mono text-textMain">{normalizedRemoteDir || '-'}</span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-surface/45 px-4 py-4">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <span className="text-textMuted">{uploading ? labels.uploading : labels.title}</span>
                            <span className="text-textMain">
                                {progress ? `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}` : '0 B / 0 B'}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-border/70">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-150"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-textMuted">
                            <span className="truncate">{progress?.fileName || selectedFiles[0]?.name || '-'}</span>
                            <span>{progressPercent}%</span>
                        </div>
                    </div>

                    {message && (
                        <div className={`rounded-xl border px-4 py-3 text-sm ${message === labels.completed ? 'border-green-500/30 bg-green-500/10 text-green-600' : 'border-border bg-background/70 text-textMuted'}`}>
                            {message}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-border bg-surface/50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-textMuted transition-colors hover:bg-surfaceHover"
                    >
                        {labels.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={startUpload}
                        disabled={uploading}
                        className="btn-primary"
                    >
                        {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {labels.startUpload}
                    </button>
                </div>
            </div>
        </div>
    );
}
