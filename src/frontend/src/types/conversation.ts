export interface SearchResult {
  chunk_id: number | null
  document_id: number
  document_filename: string | null
  knowledge_base_id: number
  chunk_index: number
  content: string
  score: number
  search_type: string | null
}

export interface SearchRequest {
  query: string
  kb_ids?: number[]
  top_k?: number
  search_type?: 'hybrid' | 'semantic' | 'fulltext'
  semantic_weight?: number
  fulltext_weight?: number
}

export interface SearchResponse {
  items: SearchResult[]
  total: number
}

export interface Reference {
  document_id: number
  document_filename: string
  chunk_index: number
  content: string
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  references?: Reference[] | null
  created_at: string
}

export interface Conversation {
  id: number
  title: string | null
  knowledge_base_ids: number[] | null
  created_at: string
  updated_at: string
}

export interface ChatRequest {
  message: string
  kb_ids?: number[]
}

export type StreamEventType = 'references' | 'content' | 'error' | 'done'

export interface StreamEvent {
  type: StreamEventType
  data: unknown
}
