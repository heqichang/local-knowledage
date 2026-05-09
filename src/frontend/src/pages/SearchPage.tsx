import { useState, type FormEvent, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { searchApi, conversationsApi } from '@/api'
import { useKnowledgeBases } from '@/hooks'
import type { SearchRequest, SearchResult } from '@/types'

const searchTypes = [
  { value: 'hybrid', label: '混合检索' },
  { value: 'semantic', label: '语义检索' },
  { value: 'fulltext', label: '全文检索' },
] as const

const SearchPage = () => {
  const navigate = useNavigate()
  const { data: knowledgeBases } = useKnowledgeBases()

  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'hybrid' | 'semantic' | 'fulltext'>('hybrid')
  const [selectedKbIds, setSelectedKbIds] = useState<number[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)

  const searchMutation = useMutation({
    mutationFn: (request: SearchRequest) => searchApi.search(request),
    onSuccess: (data) => {
      setResults(data.items)
      setSearched(true)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    searchMutation.mutate({
      query: query.trim(),
      search_type: searchType,
      kb_ids: selectedKbIds.length > 0 ? selectedKbIds : undefined,
      top_k: 10,
    })
  }

  const toggleKb = (id: number) => {
    setSelectedKbIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const createChat = async () => {
    if (!query.trim() || results.length === 0) return

    const kbIds = results.map((r) => r.knowledge_base_id)
    const uniqueKbIds = [...new Set(kbIds)]

    const conv = await conversationsApi.create({
      message: query.trim(),
      kb_ids: uniqueKbIds,
    })

    navigate(`/chat/${conv.id}`)
  }

  const searchTypeInfo = useMemo(() => {
    switch (searchType) {
      case 'hybrid':
        return '结合语义检索和全文检索，使用 RRF 算法融合排序结果'
      case 'semantic':
        return '基于向量相似度匹配，理解语义关系'
      case 'fulltext':
        return '基于关键词精确匹配，使用 BM25 排序'
    }
  }, [searchType])

  const formatScore = (score: number, type: string | null) => {
    if (type === 'hybrid') {
      return `RRF: ${score.toFixed(4)}`
    }
    if (type === 'semantic') {
      return `距离: ${score.toFixed(4)}`
    }
    return `BM25: ${score.toFixed(2)}`
  }

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">智能检索</h1>
            <p className="mt-1 text-sm text-gray-500">搜索知识库中的内容</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="输入检索内容..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={searchMutation.isPending || !query.trim()}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {searchMutation.isPending ? '检索中...' : '🔍 检索'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    检索方式
                  </label>
                  <div className="flex gap-2">
                    {searchTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setSearchType(type.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          searchType === type.value
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{searchTypeInfo}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    知识库范围
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {knowledgeBases?.items.map((kb) => (
                      <button
                        key={kb.id}
                        type="button"
                        onClick={() => toggleKb(kb.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          selectedKbIds.includes(kb.id)
                            ? 'bg-blue-100 text-blue-700 border border-blue-300'
                            : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {selectedKbIds.includes(kb.id) && '✓ '}
                        {kb.name}
                      </button>
                    ))}
                    {selectedKbIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedKbIds([])}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700"
                      >
                        清除选择
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedKbIds.length === 0
                      ? '默认搜索所有知识库'
                      : `已选择 ${selectedKbIds.length} 个知识库`}
                  </p>
                </div>
              </div>
            </form>
          </div>

          {searched && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  共找到 <span className="font-semibold text-gray-900">{results.length}</span> 个结果
                </p>
                {results.length > 0 && (
                  <button
                    onClick={createChat}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    💬 基于结果创建对话
                  </button>
                )}
              </div>

              {searchMutation.isPending ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  <p className="mt-3 text-sm text-gray-500">正在检索...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                  <p className="text-gray-500">未找到相关内容</p>
                  <p className="mt-1 text-sm text-gray-400">尝试使用不同的关键词或检索方式</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((result, idx) => (
                    <div
                      key={`${result.document_id}-${result.chunk_index}-${idx}`}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          📄 {result.document_filename || '未知文档'}
                        </span>
                        <span className="text-xs text-gray-500">
                          片段 #{result.chunk_index}
                        </span>
                        <span className="ml-auto text-xs font-mono text-gray-500">
                          {formatScore(result.score, result.search_type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {result.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!searched && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <p className="text-gray-500">输入关键词开始检索</p>
              <div className="mt-6 space-y-3 text-left max-w-md mx-auto">
                <div className="text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-700">💡 检索提示：</p>
                  <p>• 语义检索：理解问题的语义，找到相关内容</p>
                  <p>• 全文检索：精确匹配关键词</p>
                  <p>• 混合检索：结合两者优势，提供最佳结果</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SearchPage
