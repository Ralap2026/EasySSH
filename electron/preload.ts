import { contextBridge, ipcRenderer } from 'electron'

// 暴露 API给渲染进程
contextBridge.exposeInMainWorld('ipcRenderer', {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
        const subscription = (_event: any, ...args: any[]) => func(...args)
        ipcRenderer.on(channel, subscription)
        return () => ipcRenderer.removeListener(channel, subscription)
    },
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    getSystemLocale: () => ipcRenderer.invoke('get-system-locale'),
    writeClipboardText: (text: string) => ipcRenderer.invoke('clipboard-write-text', text),
    readClipboardText: () => ipcRenderer.invoke('clipboard-read-text')
})
