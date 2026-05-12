export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Document {
  id: number
  knowledge_base_id: number
  filename: string
  file_type: string
  file_size: number
  file_hash: string
  chunk_count: number
  status: DocumentStatus
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface DocumentStatusResponse {
  id: number
  status: DocumentStatus
  error_message: string | null
}

export interface DocumentUploadResponse {
  uploaded: Document[]
  skipped: string[]
}

export interface DocumentContentResponse {
  id: number
  filename: string
  content: string
}

export interface NoteCreateRequest {
  filename: string
  content: string
}

export interface NoteUpdateRequest {
  content: string
  filename?: string
}
