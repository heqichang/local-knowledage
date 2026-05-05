import { apiClient } from './client'
import type {
  KnowledgeBase,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  ListResponse,
} from '@/types'

export const knowledgeBasesApi = {
  getAll: async (): Promise<ListResponse<KnowledgeBase>> => {
    const response = await apiClient.get<ListResponse<KnowledgeBase>>('/knowledge-bases')
    return response.data
  },

  getById: async (id: number): Promise<KnowledgeBase> => {
    const response = await apiClient.get<KnowledgeBase>(`/knowledge-bases/${id}`)
    return response.data
  },

  create: async (data: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> => {
    const response = await apiClient.post<KnowledgeBase>('/knowledge-bases', data)
    return response.data
  },

  update: async (id: number, data: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> => {
    const response = await apiClient.put<KnowledgeBase>(`/knowledge-bases/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/knowledge-bases/${id}`)
  },
}
