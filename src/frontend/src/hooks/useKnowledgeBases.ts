import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { knowledgeBasesApi } from '@/api'
import type { CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest } from '@/types'

export const useKnowledgeBases = () => {
  return useQuery({
    queryKey: ['knowledgeBases'],
    queryFn: knowledgeBasesApi.getAll,
  })
}

export const useKnowledgeBase = (id: number | undefined) => {
  return useQuery({
    queryKey: ['knowledgeBase', id],
    queryFn: () => (id ? knowledgeBasesApi.getById(id) : null),
    enabled: !!id,
  })
}

export const useCreateKnowledgeBase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateKnowledgeBaseRequest) => knowledgeBasesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
    },
  })
}

export const useUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateKnowledgeBaseRequest }) =>
      knowledgeBasesApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
      queryClient.invalidateQueries({ queryKey: ['knowledgeBase', data.id] })
    },
  })
}

export const useDeleteKnowledgeBase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => knowledgeBasesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
    },
  })
}
