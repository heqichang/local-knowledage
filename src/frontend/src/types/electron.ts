export type BackendStatus = 'starting' | 'ready' | 'error'

export interface ElectronAPI {
  getApiPort: () => Promise<number | null>
  getBackendStatus: () => Promise<BackendStatus>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
