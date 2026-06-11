import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Locale = 'zh' | 'en';

type TranslationParams = Record<string, string | number>;
type MessageValue = string | ((params: TranslationParams) => string);

type I18nContextValue = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: TranslationParams) => string;
};

const messages: Record<Locale, Record<string, MessageValue>> = {
    zh: {
        'app.name': 'EasySSH',
        'common.light': '浅色',
        'common.dark': '深色',
        'common.cancel': '取消',
        'common.language': '语言',
        'common.chinese': '中文',
        'common.english': 'English',
        'common.loading': '加载中...',
        'sidebar.servers': '主机管理',
        'sidebar.scripts': '脚本库',
        'sidebar.settings': '公共设置',
        'sidebar.appearance': '外观',
        'servers.title': '主机管理',
        'servers.subtitle': '管理并快速连接到您的远程服务器',
        'servers.batchAdd': '批量添加主机',
        'servers.addHost': '添加主机',
        'servers.emptyTitle': '暂无主机信息',
        'servers.emptySubtitle': '点击上方按钮添加您的第一台远程服务器',
        'servers.deleteConfirm': '确认删除该服务器？',
        'scripts.title': '脚本库',
        'scripts.subtitle': '管理复用的 Shell 脚本并一键投递执行',
        'scripts.newScript': '新建脚本',
        'scripts.writeNew': '编写新脚本',
        'scripts.namePlaceholder': '脚本名称',
        'scripts.saveFailed': '保存失败',
        'scripts.saveSnippet': '保存片段',
        'scripts.targetSessionPlaceholder': '选择目标会话...',
        'scripts.runNow': '一键执行',
        'scripts.emptyState': '选择一个脚本以查看详情',
        'settings.title': '公共设置',
        'settings.subtitle': '全局偏好、代理与自动化配置',
        'settings.appearanceTitle': '外观主题',
        'settings.appearanceDescription': '默认使用浅色主题，选择会保存在本机，下次启动自动恢复。',
        'settings.proxyTitle': '全局 Socks5 代理',
        'settings.proxyLabel': '代理地址 (留空表示不使用)',
        'settings.proxyPlaceholder': '例如: socks5://127.0.0.1:1080',
        'settings.proxyDescription': '配置后所有 SSH 连接将通过该代理服务器中转。请确保格式包含协议头。',
        'settings.saveProxy': '保存代理',
        'settings.autoExecTitle': '登入自动执行',
        'settings.autoExecLabel': '公共指令内容',
        'settings.autoExecPlaceholder': 'cd /var/www\nls -la',
        'settings.autoExecDescription': '新建会话并成功连接后，将会自动静默输入这些指令。常用于清理屏幕或直接进入工作目录。',
        'settings.saveCommand': '保存指令',
        'settings.saveFailed': ({ target, error }) => `保存${target}失败: ${error}`,
        'settings.proxyTarget': '代理设置',
        'settings.autoExecTarget': '自动执行指令',
        'serverModal.addTitle': '添加主机',
        'serverModal.editTitle': '编辑主机',
        'serverModal.saveFailed': ({ error }) => `保存失败: ${error}`,
        'serverModal.smartDetectTitle': '智能识别 (支持 root:pass@ip:port 格式)',
        'serverModal.smartDetectPlaceholder': '粘贴服务器信息...',
        'serverModal.parse': '解析',
        'serverModal.nameLabel': '机器名/别名',
        'serverModal.remarkLabel': '备注',
        'serverModal.hostLabel': '主机地址 (IP/域名)',
        'serverModal.portLabel': '端口',
        'serverModal.usernameLabel': '用户名',
        'serverModal.passwordLabel': '密码 (优先)',
        'serverModal.passwordPlaceholder': '可留空使用密钥',
        'serverModal.privateKeyLabel': '私钥路径 (绝对路径)',
        'serverModal.privateKeyPlaceholder': '例如: C:\\Users\\Administrator\\.ssh\\id_rsa',
        'serverModal.saveHost': '保存主机',
        'batch.title': '批量添加主机',
        'batch.subtitle': '每行一台主机，支持常见 SSH 连接格式。',
        'batch.hostList': '主机列表',
        'batch.preview': '导入预览',
        'batch.importable': '可导入',
        'batch.errorLines': '错误行',
        'batch.supportedFormats': '支持格式',
        'batch.format1': 'root:密码@IP:端口',
        'batch.format2': '名称 root@IP:端口 密码 备注',
        'batch.format3': 'IP 端口 用户名 密码',
        'batch.format4': '名称,IP,端口,用户名,密码,备注',
        'batch.needFix': '需要修正',
        'batch.formatCheckPassed': '格式检查通过',
        'batch.fixUnrecognized': '请先修正无法识别的行。',
        'batch.enterAtLeastOneHost': '请至少输入一台主机。',
        'batch.importFailed': ({ error }) => `导入失败: ${error}`,
        'batch.lineFormatError': '第 {lineNumber} 行格式无法识别',
        'batch.importing': '导入中...',
        'batch.startImport': '开始导入',
        'terminal.disconnected': '[已与服务器断开连接]',
        'terminal.reconnectPrompt': '按回车重新连接',
        'terminal.reconnecting': '[正在重新连接...]',
        'terminal.connectionError': '[连接错误]',
        'terminal.authFailed': '认证失败：请检查用户名、密码/私钥，以及服务器是否允许密码或密钥登录。',
        'terminal.cpu': 'CPU',
        'terminal.mem': '内存',
        'terminal.disk': '磁盘',
        'sessionMenu.reconnect': '重新连接会话',
        'sessionMenu.disconnect': '断开当前会话',
        'sessionMenu.clone': '克隆当前会话',
        'sessionMenu.close': '关闭当前会话',
    },
    en: {
        'app.name': 'EasySSH',
        'common.light': 'Light',
        'common.dark': 'Dark',
        'common.cancel': 'Cancel',
        'common.language': 'Language',
        'common.chinese': '中文',
        'common.english': 'English',
        'common.loading': 'Loading...',
        'sidebar.servers': 'Hosts',
        'sidebar.scripts': 'Scripts',
        'sidebar.settings': 'Settings',
        'sidebar.appearance': 'Appearance',
        'servers.title': 'Host Manager',
        'servers.subtitle': 'Manage and quickly connect to your remote servers',
        'servers.batchAdd': 'Batch Add Hosts',
        'servers.addHost': 'Add Host',
        'servers.emptyTitle': 'No hosts yet',
        'servers.emptySubtitle': 'Use the buttons above to add your first remote server',
        'servers.deleteConfirm': 'Delete this server?',
        'scripts.title': 'Script Library',
        'scripts.subtitle': 'Manage reusable shell scripts and deploy them in one click',
        'scripts.newScript': 'New Script',
        'scripts.writeNew': 'Create Script',
        'scripts.namePlaceholder': 'Script name',
        'scripts.saveFailed': 'Failed to save',
        'scripts.saveSnippet': 'Save Snippet',
        'scripts.targetSessionPlaceholder': 'Select target session...',
        'scripts.runNow': 'Run Now',
        'scripts.emptyState': 'Select a script to view details',
        'settings.title': 'Settings',
        'settings.subtitle': 'Global preferences, proxy, and automation',
        'settings.appearanceTitle': 'Theme',
        'settings.appearanceDescription': 'Light theme is the default. Your selection is stored locally and restored on the next launch.',
        'settings.proxyTitle': 'Global Socks5 Proxy',
        'settings.proxyLabel': 'Proxy address (leave empty to disable)',
        'settings.proxyPlaceholder': 'Example: socks5://127.0.0.1:1080',
        'settings.proxyDescription': 'All SSH connections will be routed through this proxy. Make sure the protocol prefix is included.',
        'settings.saveProxy': 'Save Proxy',
        'settings.autoExecTitle': 'Auto Run After Login',
        'settings.autoExecLabel': 'Shared commands',
        'settings.autoExecPlaceholder': 'cd /var/www\nls -la',
        'settings.autoExecDescription': 'These commands will be silently sent after a new session connects. Useful for clearing the screen or switching to a working directory.',
        'settings.saveCommand': 'Save Commands',
        'settings.saveFailed': ({ target, error }) => `Failed to save ${target}: ${error}`,
        'settings.proxyTarget': 'proxy settings',
        'settings.autoExecTarget': 'auto-run commands',
        'serverModal.addTitle': 'Add Host',
        'serverModal.editTitle': 'Edit Host',
        'serverModal.saveFailed': ({ error }) => `Failed to save: ${error}`,
        'serverModal.smartDetectTitle': 'Smart Parse (supports root:pass@ip:port)',
        'serverModal.smartDetectPlaceholder': 'Paste server info...',
        'serverModal.parse': 'Parse',
        'serverModal.nameLabel': 'Name / Alias',
        'serverModal.remarkLabel': 'Remark',
        'serverModal.hostLabel': 'Host (IP / domain)',
        'serverModal.portLabel': 'Port',
        'serverModal.usernameLabel': 'Username',
        'serverModal.passwordLabel': 'Password (preferred)',
        'serverModal.passwordPlaceholder': 'Leave empty to use a private key',
        'serverModal.privateKeyLabel': 'Private key path (absolute)',
        'serverModal.privateKeyPlaceholder': 'Example: C:\\Users\\Administrator\\.ssh\\id_rsa',
        'serverModal.saveHost': 'Save Host',
        'batch.title': 'Batch Add Hosts',
        'batch.subtitle': 'One host per line. Common SSH formats are supported.',
        'batch.hostList': 'Host list',
        'batch.preview': 'Import Preview',
        'batch.importable': 'Ready',
        'batch.errorLines': 'Errors',
        'batch.supportedFormats': 'Supported Formats',
        'batch.format1': 'root:password@IP:port',
        'batch.format2': 'name root@IP:port password remark',
        'batch.format3': 'IP port username password',
        'batch.format4': 'name,IP,port,username,password,remark',
        'batch.needFix': 'Needs attention',
        'batch.formatCheckPassed': 'Format check passed',
        'batch.fixUnrecognized': 'Please fix the unrecognized lines first.',
        'batch.enterAtLeastOneHost': 'Enter at least one host.',
        'batch.importFailed': ({ error }) => `Import failed: ${error}`,
        'batch.lineFormatError': 'Line {lineNumber} could not be recognized',
        'batch.importing': 'Importing...',
        'batch.startImport': 'Start Import',
        'terminal.disconnected': '[Disconnected from server]',
        'terminal.reconnectPrompt': 'Press Enter to reconnect',
        'terminal.reconnecting': '[Reconnecting...]',
        'terminal.connectionError': '[Connection Error]',
        'terminal.authFailed': 'Authentication failed. Check the username, password/private key, and whether the server allows this login method.',
        'terminal.cpu': 'CPU',
        'terminal.mem': 'MEM',
        'terminal.disk': 'DISK',
        'sessionMenu.reconnect': 'Reconnect Session',
        'sessionMenu.disconnect': 'Disconnect Session',
        'sessionMenu.clone': 'Clone Session',
        'sessionMenu.close': 'Close Session',
    },
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
    return 'en';
}

function formatMessage(message: MessageValue, params: TranslationParams): string {
    if (typeof message === 'function') {
        return message(params);
    }

    return message.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocale] = useState<Locale>(getInitialLocale);

    useEffect(() => {
        document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    }, [locale]);

    useEffect(() => {
        const detectLocale = async () => {
            try {
                const systemLocale = await window.ipcRenderer?.getSystemLocale?.();
                setLocale(systemLocale?.toLowerCase().startsWith('zh') ? 'zh' : 'en');
            } catch {
                const browserLocale = typeof navigator !== 'undefined'
                    ? (Array.isArray(navigator.languages) && navigator.languages.length > 0 ? navigator.languages[0] : navigator.language)
                    : 'en';
                setLocale(browserLocale?.toLowerCase().startsWith('zh') ? 'zh' : 'en');
            }
        };

        detectLocale();
    }, []);

    const t = (key: string, params: TranslationParams = {}) => {
        const value = messages[locale][key] ?? messages.zh[key] ?? key;
        return formatMessage(value, params);
    };

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);

    if (!context) {
        throw new Error('useI18n must be used within I18nProvider');
    }

    return context;
}
