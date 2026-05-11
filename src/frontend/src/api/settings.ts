import { apiClient } from './client'
import type {
  AppSettings,
  AppSettingsUpdate,
  ConnectionTestRequest,
  ConnectionTestResponse,
  ListModelsResponse,
  RebuildIndexStatusResponse,
} from '@/types'

export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const response = await apiClient.get<AppSettings>('/settings')
    return response.data
  },

  update: async (data: AppSettingsUpdate, triggerRebuild = false): Promise<AppSettings> => {
    const response = await apiClient.put<AppSettings>(`/settings?trigger_rebuild=${triggerRebuild}`, data)
    return response.data
  },

  reset: async (): Promise<AppSettings> => {
    const response = await apiClient.post<AppSettings>('/settings/reset')
    return response.data
  },

  listModels: async (
    provider: string,
    baseUrl: string,
    apiKey?: string
  ): Promise<ListModelsResponse> => {
    const params = new URLSearchParams({
      provider,
      base_url: baseUrl,
    })
    if (apiKey) {
      params.append('api_key', apiKey)
    }
    const response = await apiClient.get<ListModelsResponse>(`/settings/models?${params.toString()}`)
    return response.data
  },

  testConnection: async (data: ConnectionTestRequest): Promise<ConnectionTestResponse> => {
    const response = await apiClient.post<ConnectionTestResponse>('/settings/test-connection', data)
    return response.data
  },

  triggerRebuild: async (): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/settings/rebuild-index')
    return response.data
  },

  getRebuildStatus: async (): Promise<RebuildIndexStatusResponse> => {
    const response = await apiClient.get<RebuildIndexStatusResponse>('/settings/rebuild-status')
    return response.data
  },
}
