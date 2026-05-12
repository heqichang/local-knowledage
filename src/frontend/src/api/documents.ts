import { apiClient } from './client'
import type {
  Document,
  DocumentContentResponse,
  DocumentStatusResponse,
  DocumentUploadResponse,
  ListResponse,
  NoteCreateRequest,
  NoteUpdateRequest,
} from '@/types'

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

  createNote: async (kbId: number, data: NoteCreateRequest): Promise<Document> => {
    const response = await apiClient.post<Document>(`/knowledge-bases/${kbId}/notes`, data)
    return response.data
  },

  getDocumentContent: async (kbId: number, docId: number): Promise<DocumentContentResponse> => {
    const response = await apiClient.get<DocumentContentResponse>(`/knowledge-bases/${kbId}/documents/${docId}/content`)
    return response.data
  },

  updateDocumentContent: async (kbId: number, docId: number, data: NoteUpdateRequest): Promise<Document> => {
    const response = await apiClient.put<Document>(`/knowledge-bases/${kbId}/documents/${docId}/content`, data)
    return response.data
  },
}
