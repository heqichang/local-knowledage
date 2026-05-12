const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getApiPort: async (): Promise<number | null> => {
    return ipcRenderer.invoke('get-api-port')
  },
  getBackendStatus: async (): Promise<'starting' | 'ready' | 'error'> => {
    return ipcRenderer.invoke('get-backend-status')
  },
})
