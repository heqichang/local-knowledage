import { apiClient } from './client'
import type {
  ChatRequest,
  Conversation,
  ListResponse,
  Message,
  SearchRequest,
  SearchResponse,
} from '@/types'

export const searchApi = {
  search: (request: SearchRequest) =>
    apiClient.post<SearchResponse>('/search', request).then(res => res.data),
}

export const conversationsApi = {
  list: () =>
    apiClient.get<ListResponse<Conversation>>('/conversations').then(res => res.data),

  create: (request?: ChatRequest) =>
    apiClient.post<Conversation>('/conversations', request).then(res => res.data),

  get: (id: number) =>
    apiClient.get<Conversation>(`/conversations/${id}`).then(res => res.data),

  getMessages: (id: number) =>
    apiClient.get<ListResponse<Message>>(`/conversations/${id}/messages`).then(res => res.data),

  delete: (id: number) =>
    apiClient.delete(`/conversations/${id}`),

  chat: (id: number, request: ChatRequest) => {
    const baseUrl = import.meta.env.VITE_API_URL || ''
    return new EventSourceStream(`${baseUrl}/conversations/${id}/chat`, request)
  },
}

export class EventSourceStream {
  private controller: AbortController
  private reader: ReadableStreamDefaultReader | null = null
  private decoder: TextDecoder
  private url: string
  private request: ChatRequest

  constructor(url: string, request: ChatRequest) {
    this.url = url
    this.request = request
    this.controller = new AbortController()
    this.decoder = new TextDecoder('utf-8')
  }

  async *[Symbol.asyncIterator]() {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.request),
      signal: this.controller.signal,
    })

    if (!response.ok || !response.body) {
      throw new Error(`请求失败: ${response.status}`)
    }

    this.reader = response.body.getReader()
    let buffer = ''

    while (true) {
      const { done, value } = await this.reader.read()
      if (done) break

      buffer += this.decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            yield data
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }

  cancel() {
    this.controller.abort()
    this.reader?.cancel().catch(() => {})
  }
}
