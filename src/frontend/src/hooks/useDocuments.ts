import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api'
import type { Document, DocumentStatusResponse, ListResponse } from '@/types'

export const useDocuments = (kbId: number | undefined) => {
  return useQuery({
    queryKey: ['documents', kbId],
    queryFn: () =>
      kbId
        ? documentsApi.getByKnowledgeBase(kbId)
        : ({ items: [], total: 0 } as ListResponse<Document>),
    enabled: !!kbId,
    refetchInterval: (query) => {
      const data = query.state.data as ListResponse<Document> | undefined
      const hasProcessing = data?.items.some(
        (doc) => doc.status === 'pending' || doc.status === 'processing'
      )
      return hasProcessing ? 2000 : false
    },
  })
}

export const useDocumentStatus = (kbId: number | undefined, docId: number | undefined) => {
  return useQuery({
    queryKey: ['document-status', kbId, docId],
    queryFn: () =>
      kbId && docId
        ? documentsApi.getStatus(kbId, docId)
        : (null as DocumentStatusResponse | null),
    enabled: !!kbId && !!docId,
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
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
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
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
    },
  })
}
