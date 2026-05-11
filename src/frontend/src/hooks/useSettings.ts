import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/api'
import type {
  AppSettingsUpdate,
  ConnectionTestRequest,
} from '@/types'

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60 * 1000,
  })
}

export const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      data,
      triggerRebuild = false,
    }: {
      data: AppSettingsUpdate
      triggerRebuild?: boolean
    }) => settingsApi.update(data, triggerRebuild),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export const useResetSettings = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.reset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export const useListModels = () => {
  return useMutation({
    mutationFn: ({
      provider,
      baseUrl,
      apiKey,
    }: {
      provider: string
      baseUrl: string
      apiKey?: string
    }) => settingsApi.listModels(provider, baseUrl, apiKey),
  })
}

export const useTestConnection = () => {
  return useMutation({
    mutationFn: (data: ConnectionTestRequest) => settingsApi.testConnection(data),
  })
}

export const useTriggerRebuild = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: settingsApi.triggerRebuild,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

export const useRebuildStatus = (enabled = false) => {
  return useQuery({
    queryKey: ['rebuildStatus'],
    queryFn: settingsApi.getRebuildStatus,
    enabled,
    refetchInterval: 2000,
  })
}
