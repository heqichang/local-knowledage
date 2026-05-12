import axios from 'axios'

const DEFAULT_API_URL = 'http://localhost:8000'

function getDefaultBaseUrl(): string {
  return import.meta.env.VITE_API_URL || DEFAULT_API_URL
}

export const apiClient = axios.create({
  baseURL: getDefaultBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
})

export function setApiBaseUrl(baseUrl: string): void {
  apiClient.defaults.baseURL = baseUrl
}

export function getApiBaseUrl(): string {
  return apiClient.defaults.baseURL as string
}

export async function initializeApiBaseUrl(): Promise<void> {
  if (window.electronAPI) {
    try {
      const port = await window.electronAPI.getApiPort()
      if (port) {
        setApiBaseUrl(`http://localhost:${port}`)
      }
    } catch (error) {
      console.error('Failed to get API port from Electron:', error)
    }
  }
}
