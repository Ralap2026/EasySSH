export function useIPC() {
    const isElectron = Boolean(window.ipcRenderer);

    // 通用调用方法
    const invoke = async <T>(channel: string, ...args: any[]): Promise<T> => {
        if (!isElectron) {
            console.warn(`[Mock IPC] invoke: ${channel}`, args);
            return undefined as any;
        }
        return window.ipcRenderer.invoke(channel, ...args);
    };

    const on = (channel: string, callback: (...args: any[]) => void) => {
        if (!isElectron) return () => { };
        return window.ipcRenderer.on(channel, callback);
    };

    const send = (channel: string, ...args: any[]) => {
        if (isElectron) {
            window.ipcRenderer.send(channel, ...args);
        }
    };

    const writeClipboardText = async (text: string) => {
        if (isElectron) {
            await window.ipcRenderer.writeClipboardText(text);
        } else {
            await navigator.clipboard?.writeText(text);
        }
    };

    const readClipboardText = async () => {
        if (isElectron) {
            return window.ipcRenderer.readClipboardText();
        }
        return navigator.clipboard?.readText() ?? '';
    };

    return { invoke, on, send, writeClipboardText, readClipboardText, isElectron };
}

// 补充类型
declare global {
    interface Window {
        ipcRenderer: {
            send: (channel: string, ...args: any[]) => void;
            on: (channel: string, listener: (...args: any[]) => void) => () => void;
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            getSystemLocale: () => Promise<string>;
            writeClipboardText: (text: string) => Promise<boolean>;
            readClipboardText: () => Promise<string>;
            pickUploadFile?: () => Promise<string | null>;
            pickUploadFiles?: () => Promise<Array<{ path: string; name: string; size: number }>>;
        };
    }

    namespace JSX {
        interface IntrinsicElements {
            webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                src?: string;
                allowpopups?: boolean | string;
            };
        }
    }
}
