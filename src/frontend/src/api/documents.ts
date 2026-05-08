import { apiClient } from './client'
import type { Document, DocumentStatusResponse, DocumentUploadResponse, ListResponse } from '@/types'

export const documentsApi = {
  getByKnowledgeBase: async (kbId: number): Promise<ListResponse<Document>> => {
    const response = await apiClient.get<ListResponse<Document>>(`/knowledge-bases/${kbId}/documents`)
    return response.data
  },

  getById: async (kbId: number, docId: number): Promise<Document> => {
    const response = await apiClient.get<Document>(`/knowledge-bases/${kbId}/documents/${docId}`)
    return response.data
  },

  upload: async (kbId: number, files: File[]): Promise<DocumentUploadResponse> => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const response = await apiClient.post<DocumentUploadResponse>(
      `/knowledge-bases/${kbId}/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  delete: async (kbId: number, docId: number): Promise<void> => {
    await apiClient.delete(`/knowledge-bases/${kbId}/documents/${docId}`)
  },

  getStatus: async (kbId: number, docId: number): Promise<DocumentStatusResponse> => {
    const response = await apiClient.get<DocumentStatusResponse>(`/knowledge-bases/${kbId}/documents/${docId}/status`)
    return response.data
  },
}
