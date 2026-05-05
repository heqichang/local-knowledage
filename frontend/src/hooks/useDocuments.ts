import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api'
import type { ListResponse, Document } from '@/types'

export const useDocuments = (kbId: number | undefined) => {
  return useQuery({
    queryKey: ['documents', kbId],
    queryFn: () =>
      kbId
        ? documentsApi.getByKnowledgeBase(kbId)
        : ({ items: [], total: 0 } as ListResponse<Document>),
    enabled: !!kbId,
  })
}

export const useUploadDocuments = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, files }: { kbId: number; files: File[] }) =>
      documentsApi.upload(kbId, files),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.kbId] })
      queryClient.invalidateQueries({ queryKey: ['knowledgeBase', variables.kbId] })
    },
  })
}

export const useDeleteDocument = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, docId }: { kbId: number; docId: number }) =>
      documentsApi.delete(kbId, docId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.kbId] })
      queryClient.invalidateQueries({ queryKey: ['knowledgeBase', variables.kbId] })
    },
  })
}
