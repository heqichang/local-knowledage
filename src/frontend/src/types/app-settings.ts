export type LLMProvider = 'ollama' | 'openai_compatible'
export type EmbeddingProvider = 'local' | 'openai_compatible'
export type SearchMode = 'hybrid' | 'semantic' | 'fulltext'
export type RebuildIndexStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface AppSettings {
  llm_provider: LLMProvider
  ollama_base_url: string
  ollama_model: string
  llm_api_base_url: string
  llm_api_key: string
  llm_model_name: string
  embedding_provider: EmbeddingProvider
  embedding_model: string
  embedding_api_base_url: string
  embedding_api_key: string
  embedding_model_name: string
  search_top_k: number
  chunk_size: number
  chunk_overlap: number
  search_mode: SearchMode
  semantic_weight: number
  fulltext_weight: number
  chat_history_rounds: number
  hf_endpoint: string
  llm_api_key_masked: string
  embedding_api_key_masked: string
  needs_rebuild_index: boolean
}

export interface AppSettingsUpdate {
  llm_provider: LLMProvider
  ollama_base_url: string
  ollama_model: string
  llm_api_base_url: string
  llm_api_key: string
  llm_model_name: string
  embedding_provider: EmbeddingProvider
  embedding_model: string
  embedding_api_base_url: string
  embedding_api_key: string
  embedding_model_name: string
  search_top_k: number
  chunk_size: number
  chunk_overlap: number
  search_mode: SearchMode
  semantic_weight: number
  fulltext_weight: number
  chat_history_rounds: number
  hf_endpoint: string
}

export interface ConnectionTestRequest {
  provider: LLMProvider | EmbeddingProvider
  base_url: string
  api_key: string
  model_name: string
}

export interface ConnectionTestResponse {
  success: boolean
  message: string
  latency_ms: number | null
}

export interface RebuildIndexStatusResponse {
  status: RebuildIndexStatus
  progress: number
  message: string
}

export interface ListModelsResponse {
  models: string[]
}
