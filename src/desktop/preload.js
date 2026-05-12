const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getApiPort: async () => {
    return 8000
  },
  getBackendStatus: async () => {
    return 'ready'
  },
})
