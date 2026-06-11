import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import Servers from './pages/Servers';
import Scripts from './pages/Scripts';
import Settings from './pages/Settings';
import TerminalView from './components/TerminalView';
import UploadFileModal from './components/UploadFileModal';
import { I18nProvider, useI18n } from './i18n';
import { useIPC } from './hooks/useIPC';

export type ThemeMode = 'light' | 'dark';

type SessionInstance = {
  id: number;
  uniqueTabId: number;
  displayName: string;
  reconnectSignal: number;
  disconnectSignal: number;
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  privateKeyPath?: string;
  remark?: string;
  name?: string;
};

type SessionMenuState = {
  x: number;
  y: number;
  sessionId: number;
} | null;

type UploadDialogState = {
  sessionId: number;
} | null;

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem('webssh-theme') === 'dark' ? 'dark' : 'light';
}

function createSessionInstance(server: any, displayName?: string): SessionInstance {
  const uniqueTabId = Date.now() + Math.floor(Math.random() * 100000);
  const baseName = (server.name || server.host || 'Session').trim();

  return {
    ...server,
    id: uniqueTabId,
    uniqueTabId,
    displayName: displayName || baseName,
    reconnectSignal: 0,
    disconnectSignal: 0
  };
}

function getClonedSessionName(sourceSession: SessionInstance, sessions: SessionInstance[]) {
  const currentName = (sourceSession.displayName || sourceSession.name || sourceSession.host || 'Session').trim();
  const baseName = currentName.replace(/\(\d+\)$/, '').trim() || currentName;
  const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const clonePattern = new RegExp(`^${escapedBaseName}\\((\\d+)\\)$`);
  const usedIndexes = new Set<number>();

  for (const session of sessions) {
    if (session.displayName === baseName) {
      usedIndexes.add(0);
      continue;
    }

    const match = session.displayName.match(clonePattern);
    if (match) {
      usedIndexes.add(Number(match[1]));
    }
  }

  let nextIndex = 1;
  while (usedIndexes.has(nextIndex)) {
    nextIndex += 1;
  }

  return `${baseName}(${nextIndex})`;
}

function getSessionMenuPosition(x: number, y: number) {
  if (typeof window === 'undefined') {
    return { x, y };
  }

  const menuWidth = 224;
  const menuHeight = 164;
  const viewportPadding = 8;

  return {
    x: Math.max(viewportPadding, Math.min(x, window.innerWidth - menuWidth - viewportPadding)),
    y: Math.max(viewportPadding, Math.min(y, window.innerHeight - menuHeight - viewportPadding))
  };
}

function Dashboard({ theme, onThemeChange }: { theme: ThemeMode; onThemeChange: (theme: ThemeMode) => void }) {
  const { t, locale } = useI18n();
  const { invoke } = useIPC();
  const [currentTab, setCurrentTab] = useState('servers');
  const [activeSessions, setActiveSessions] = useState<SessionInstance[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionMenu, setSessionMenu] = useState<SessionMenuState>(null);
  const [uploadDialog, setUploadDialog] = useState<UploadDialogState>(null);
  const [sessionChannelMap, setSessionChannelMap] = useState<Record<number, string | null>>({});
  const contentRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const terminalEmptyStateText = locale === 'zh' ? '暂无会话终端，请先在主机管理中打开一个连接。' : 'No terminal sessions yet. Open a host from Host Manager first.';

  const closeSession = (sessionId: number) => {
    setActiveSessions((prev) => {
      const newSessions = prev.filter((session) => session.id !== sessionId);

      setActiveSessionId((current) => {
        if (current !== sessionId) return current;
        return newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null;
      });

      return newSessions;
    });
    setSessionChannelMap((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  };

  const handleConnect = (server: any) => {
    if (server?.id) {
      invoke('touch-server-last-used', server.id).catch(() => { });
    }
    const session = createSessionInstance(server);
    setActiveSessions((prev) => [...prev, session]);
    setActiveSessionId(session.id);
    setCurrentTab('terminals');
  };

  const triggerReconnect = (sessionId: number) => {
    setActiveSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, reconnectSignal: session.reconnectSignal + 1 }
          : session
      )
    );
    setActiveSessionId(sessionId);
  };

  const triggerDisconnect = (sessionId: number) => {
    setActiveSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, disconnectSignal: session.disconnectSignal + 1 }
          : session
      )
    );
  };

  const cloneSession = (sessionId: number) => {
    setActiveSessions((prev) => {
      const sourceSession = prev.find((session) => session.id === sessionId);
      if (!sourceSession) return prev;

      const clonedSession = createSessionInstance(
        sourceSession,
        getClonedSessionName(sourceSession, prev)
      );

      setActiveSessionId(clonedSession.id);
      return [...prev, clonedSession];
    });
  };

  const runSessionMenuAction = (action: 'reconnect' | 'disconnect' | 'clone' | 'upload' | 'close') => {
    if (!sessionMenu) return;

    const sessionId = sessionMenu.sessionId;
    setSessionMenu(null);

    if (action === 'reconnect') {
      triggerReconnect(sessionId);
      return;
    }

    if (action === 'disconnect') {
      triggerDisconnect(sessionId);
      return;
    }

    if (action === 'clone') {
      cloneSession(sessionId);
      return;
    }

    if (action === 'upload') {
      setUploadDialog({ sessionId });
      return;
    }

    closeSession(sessionId);
  };

  useEffect(() => {
    if (!sessionMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      setSessionMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSessionMenu(null);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [sessionMenu]);

  const uploadTargetSession = uploadDialog
    ? activeSessions.find((session) => session.id === uploadDialog.sessionId) ?? null
    : null;
  const uploadTargetChannelId = uploadTargetSession ? sessionChannelMap[uploadTargetSession.id] ?? null : null;

  return (
    <div className="flex h-screen bg-background text-textMain overflow-hidden">
      <Sidebar
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        theme={theme}
        onThemeChange={onThemeChange}
      />
      <div ref={contentRef} className="flex-1 px-8 py-4 relative overflow-hidden backdrop-blur-xl bg-surface/30 flex flex-col">
        {currentTab === 'terminals' && activeSessions.length > 0 && (
          <div className="flex gap-2 mb-4 border-b border-border pb-2 overflow-x-auto">
            {activeSessions.map((sess) => (
              <button
                key={sess.id}
                onClick={() => setActiveSessionId(sess.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setActiveSessionId(sess.id);
                  const containerRect = contentRef.current?.getBoundingClientRect();
                  const position = containerRect
                    ? getSessionMenuPosition(
                      event.clientX - containerRect.left,
                      event.clientY - containerRect.top
                    )
                    : getSessionMenuPosition(event.clientX, event.clientY);
                  setSessionMenu({ x: position.x, y: position.y, sessionId: sess.id });
                }}
                className={`px-4 py-2 rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${activeSessionId === sess.id ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-textMuted hover:bg-surfaceHover'}`}
              >
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {sess.displayName}
                <div
                  className="ml-2 hover:bg-red-500/20 hover:text-red-500 p-1 rounded-full text-textMuted"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSession(sess.id);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
          {activeSessions.length > 0 && (
            <div
              className={`absolute inset-0 transition-opacity duration-200 ${currentTab === 'terminals' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            >
              {activeSessions.map((sess) => (
                <div key={sess.id} className={`absolute inset-0 transition-opacity duration-300 ${activeSessionId === sess.id ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                  <TerminalView
                    session={sess}
                    theme={theme}
                    onSessionChannelReady={(sessionChannelId) => {
                      setSessionChannelMap((prev) => ({ ...prev, [sess.id]: sessionChannelId }));
                    }}
                    reconnectSignal={sess.reconnectSignal}
                    disconnectSignal={sess.disconnectSignal}
                    onDisconnected={() => { }}
                  />
                </div>
              ))}
            </div>
          )}

          {currentTab === 'terminals' ? (
            activeSessions.length > 0 ? null : (
              <div className="h-full flex items-center justify-center rounded-2xl border border-dashed border-border bg-surface/20 text-textMuted">
                {terminalEmptyStateText}
              </div>
            )
          ) : (
            <div className="absolute inset-0 z-20 h-full">
              {currentTab === 'servers' && <Servers onConnect={handleConnect} />}
              {currentTab === 'scripts' && (
                <Scripts
                  activeSessions={activeSessions}
                  onDeploy={(script, targetSessId) => {
                    const sess = activeSessions.find((s) => s.id === targetSessId);
                    if (sess && window.ipcRenderer) {
                      window.ipcRenderer.send(`ssh-write-${sess.uniqueTabId}`, script.content + '\n');
                      setActiveSessionId(sess.id);
                      setCurrentTab('terminals');
                    }
                  }}
                />
              )}
              {currentTab === 'settings' && <Settings theme={theme} onThemeChange={onThemeChange} />}
            </div>
          )}
        </div>

        {sessionMenu && (
          <div
            ref={menuRef}
            className="absolute z-50 w-56 rounded-xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl py-1"
            style={{ left: sessionMenu.x, top: sessionMenu.y }}
          >
            <button type="button" onClick={() => runSessionMenuAction('reconnect')} className="w-full px-4 py-2 text-left text-sm text-textMain hover:bg-surfaceHover">
              {t('sessionMenu.reconnect')}
            </button>
            <button type="button" onClick={() => runSessionMenuAction('disconnect')} className="w-full px-4 py-2 text-left text-sm text-textMain hover:bg-surfaceHover">
              {t('sessionMenu.disconnect')}
            </button>
            <button type="button" onClick={() => runSessionMenuAction('clone')} className="w-full px-4 py-2 text-left text-sm text-textMain hover:bg-surfaceHover">
              {t('sessionMenu.clone')}
            </button>
            <button type="button" onClick={() => runSessionMenuAction('upload')} className="w-full px-4 py-2 text-left text-sm text-textMain hover:bg-surfaceHover">
              {locale === 'zh' ? '上传文件' : 'Upload File'}
            </button>
            <button type="button" onClick={() => runSessionMenuAction('close')} className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-500/10">
              {t('sessionMenu.close')}
            </button>
          </div>
        )}

        {uploadDialog && uploadTargetSession && (
          uploadTargetChannelId ? (
            <UploadFileModal
              sessionChannelId={uploadTargetChannelId}
              sessionName={uploadTargetSession.displayName}
              onClose={() => setUploadDialog(null)}
            />
          ) : (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
              <div className="glass-panel w-full max-w-md rounded-2xl border border-border px-6 py-5 text-center">
                <p className="text-lg font-semibold text-textMain">{locale === 'zh' ? '正在准备上传通道...' : 'Preparing upload channel...'}</p>
                <p className="mt-2 text-sm text-textMuted">{uploadTargetSession.displayName}</p>
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setUploadDialog(null)}
                    className="rounded-lg px-4 py-2 text-textMuted transition-colors hover:bg-surfaceHover"
                  >
                    {locale === 'zh' ? '关闭' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('webssh-theme', theme);
  }, [theme]);

  return (
    <I18nProvider>
      <div className="App font-sans selection:bg-primary/30">
        <Dashboard theme={theme} onThemeChange={setTheme} />
      </div>
    </I18nProvider>
  );
}

export default App;
