export interface ApiError {
  detail: string
}

export interface ListResponse<T> {
  items: T[]
  total: number
}

export interface PaginatedResponse<T> extends ListResponse<T> {
  page: number
  page_size: number
}
