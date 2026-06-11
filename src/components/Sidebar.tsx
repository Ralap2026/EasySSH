import { Server, Settings, FileCode2, Moon, Sun, TerminalSquare } from 'lucide-react';
import type { ThemeMode } from '../App';
import { useI18n } from '../i18n';
import rocketIcon from '../../rocket.png';
import SidebarRemoteEmbed from './SidebarRemoteEmbed';

interface SidebarProps {
    currentTab: string;
    onChangeTab: (tab: string) => void;
    theme: ThemeMode;
    onThemeChange: (theme: ThemeMode) => void;
}

export default function Sidebar({ currentTab, onChangeTab, theme, onThemeChange }: SidebarProps) {
    const { locale, setLocale, t } = useI18n();

    const menus = [
        { id: 'servers', name: t('sidebar.servers'), icon: <Server className="w-5 h-5" /> },
        { id: 'terminals', name: locale === 'zh' ? '会话终端' : 'Session Terminal', icon: <TerminalSquare className="w-5 h-5" /> },
        { id: 'scripts', name: t('sidebar.scripts'), icon: <FileCode2 className="w-5 h-5" /> },
        { id: 'settings', name: t('sidebar.settings'), icon: <Settings className="w-5 h-5" /> },
    ];

    return (
        <div className="glass-panel w-64 border-r border-border p-4 flex flex-col h-full bg-surface/50">
            <div className="mb-8 px-2 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden shadow-glow bg-surface">
                    <img src={rocketIcon} alt={t('app.name')} className="w-full h-full object-cover" />
                </div>
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">{t('app.name')}</h2>
            </div>

            <div className="flex-1 space-y-2">
                {menus.map((menu) => (
                    <button
                        key={menu.id}
                        onClick={() => onChangeTab(menu.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${currentTab === menu.id
                            ? 'bg-primary/20 text-primary shadow-glow border border-primary/30'
                            : 'text-textMuted hover:bg-surfaceHover hover:text-textMain'
                            }`}
                    >
                        {menu.icon}
                        <span className="font-medium">{menu.name}</span>
                    </button>
                ))}

                <SidebarRemoteEmbed />
            </div>

            <div className="mt-auto border-t border-border pt-4">
                <p className="px-2 mb-2 text-xs font-medium text-textMuted">{t('sidebar.appearance')}</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/60 p-1">
                    <button
                        type="button"
                        onClick={() => onThemeChange('light')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors ${theme === 'light' ? 'bg-surface text-primary shadow-sm' : 'text-textMuted hover:text-textMain hover:bg-surfaceHover'}`}
                    >
                        <Sun className="w-4 h-4" />
                        {t('common.light')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onThemeChange('dark')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors ${theme === 'dark' ? 'bg-surface text-primary shadow-sm' : 'text-textMuted hover:text-textMain hover:bg-surfaceHover'}`}
                    >
                        <Moon className="w-4 h-4" />
                        {t('common.dark')}
                    </button>
                </div>

                <p className="px-2 mt-4 mb-2 text-xs font-medium text-textMuted">{t('common.language')}</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-background/60 p-1">
                    <button
                        type="button"
                        onClick={() => setLocale('zh')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors ${locale === 'zh' ? 'bg-surface text-primary shadow-sm' : 'text-textMuted hover:text-textMain hover:bg-surfaceHover'}`}
                    >
                        {t('common.chinese')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setLocale('en')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm transition-colors ${locale === 'en' ? 'bg-surface text-primary shadow-sm' : 'text-textMuted hover:text-textMain hover:bg-surfaceHover'}`}
                    >
                        {t('common.english')}
                    </button>
                </div>
            </div>
        </div>
    );
}
