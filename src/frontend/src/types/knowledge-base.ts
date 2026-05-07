export interface KnowledgeBase {
  id: number
  name: string
  description: string | null
  document_count: number
  created_at: string
  updated_at: string
}

export interface CreateKnowledgeBaseRequest {
  name: string
  description?: string
}

export interface UpdateKnowledgeBaseRequest {
  name?: string
  description?: string
}
