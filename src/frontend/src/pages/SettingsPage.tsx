import { type FC, useEffect, useState } from 'react'
import {
  useSettings,
  useUpdateSettings,
  useResetSettings,
  useListModels,
  useTestConnection,
  useTriggerRebuild,
  useRebuildStatus,
} from '@/hooks'
import type {
  AppSettings,
  AppSettingsUpdate,
  ConnectionTestResponse,
  LLMProvider,
  EmbeddingProvider,
  SearchMode,
} from '@/types'

const EMBEDDING_RELATED_FIELDS: (keyof AppSettings)[] = [
  'embedding_provider',
  'embedding_model',
  'embedding_model_name',
  'embedding_api_base_url',
  'chunk_size',
  'chunk_overlap',
]

const SettingsPage: FC = () => {
  const { data: settings, isLoading, refetch } = useSettings()
  const updateMutation = useUpdateSettings()
  const resetMutation = useResetSettings()
  const listModelsMutation = useListModels()
  const testConnectionMutation = useTestConnection()
  const triggerRebuildMutation = useTriggerRebuild()

  const [formData, setFormData] = useState<AppSettingsUpdate | null>(null)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<ConnectionTestResponse | null>(null)
  const [embeddingTestResult, setEmbeddingTestResult] = useState<ConnectionTestResponse | null>(null)
  const [showRebuildWarning, setShowRebuildWarning] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showRebuildProgress, setShowRebuildProgress] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const rebuildStatus = useRebuildStatus(showRebuildProgress)

  useEffect(() => {
    if (settings) {
      setFormData({
        llm_provider: settings.llm_provider,
        ollama_base_url: settings.ollama_base_url,
        ollama_model: settings.ollama_model,
        llm_api_base_url: settings.llm_api_base_url,
        llm_api_key: settings.llm_api_key,
        llm_model_name: settings.llm_model_name,
        embedding_provider: settings.embedding_provider,
        embedding_model: settings.embedding_model,
        embedding_api_base_url: settings.embedding_api_base_url,
        embedding_api_key: settings.embedding_api_key,
        embedding_model_name: settings.embedding_model_name,
        search_top_k: settings.search_top_k,
        chunk_size: settings.chunk_size,
        chunk_overlap: settings.chunk_overlap,
        search_mode: settings.search_mode,
        semantic_weight: settings.semantic_weight,
        fulltext_weight: settings.fulltext_weight,
        chat_history_rounds: settings.chat_history_rounds,
        hf_endpoint: settings.hf_endpoint,
      })
    }
  }, [settings])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    if (
      rebuildStatus.data?.status === 'completed' ||
      rebuildStatus.data?.status === 'failed'
    ) {
      const timer = setTimeout(() => {
        setShowRebuildProgress(false)
        refetch()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [rebuildStatus.data?.status, refetch])

  const handleFieldChange = <K extends keyof AppSettingsUpdate>(
    field: K,
    value: AppSettingsUpdate[K]
  ) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev))
    setLlmTestResult(null)
    setEmbeddingTestResult(null)
  }

  const loadOllamaModels = async () => {
    if (!formData?.ollama_base_url) return
    setIsLoadingModels(true)
    try {
      const result = await listModelsMutation.mutateAsync({
        provider: 'ollama',
        baseUrl: formData.ollama_base_url,
      })
      setOllamaModels(result.models)
    } catch {
      setOllamaModels([])
    } finally {
      setIsLoadingModels(false)
    }
  }

  const testLLMConnection = async () => {
    if (!formData) return
    setLlmTestResult(null)
    const provider = formData.llm_provider
    const baseUrl =
      provider === 'ollama' ? formData.ollama_base_url : formData.llm_api_base_url
    const apiKey = provider === 'openai_compatible' ? formData.llm_api_key : ''
    const modelName =
      provider === 'ollama' ? formData.ollama_model : formData.llm_model_name

    try {
      const result = await testConnectionMutation.mutateAsync({
        provider,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
      })
      setLlmTestResult(result)
    } catch {
      setLlmTestResult({ success: false, message: '测试失败', latency_ms: null })
    }
  }

  const testEmbeddingConnection = async () => {
    if (!formData) return
    setEmbeddingTestResult(null)
    const provider = formData.embedding_provider
    const baseUrl =
      provider === 'openai_compatible' ? formData.embedding_api_base_url : ''
    const apiKey = provider === 'openai_compatible' ? formData.embedding_api_key : ''
    const modelName =
      provider === 'openai_compatible' ? formData.embedding_model_name : formData.embedding_model

    try {
      const result = await testConnectionMutation.mutateAsync({
        provider,
        base_url: baseUrl,
        api_key: apiKey,
        model_name: modelName,
      })
      setEmbeddingTestResult(result)
    } catch {
      setEmbeddingTestResult({ success: false, message: '测试失败', latency_ms: null })
    }
  }

  const hasEmbeddingChanges = (): boolean => {
    if (!settings || !formData) return false
    return EMBEDDING_RELATED_FIELDS.some(
      (field) => settings[field] !== (formData as AppSettings)[field]
    )
  }

  const handleSave = () => {
    if (!formData) return
    if (hasEmbeddingChanges()) {
      setShowRebuildWarning(true)
    } else {
      saveSettings(false)
    }
  }

  const saveSettings = async (triggerRebuild: boolean) => {
    if (!formData) return
    try {
      await updateMutation.mutateAsync({
        data: formData,
        triggerRebuild,
      })
      setShowRebuildWarning(false)
      setToast({ message: '配置已保存', type: 'success' })
      if (triggerRebuild) {
        setShowRebuildProgress(true)
      }
    } catch {
      setToast({ message: '保存失败', type: 'error' })
    }
  }

  const handleReset = async () => {
    try {
      await resetMutation.mutateAsync()
      setShowResetConfirm(false)
      setToast({ message: '已恢复默认值', type: 'success' })
      setLlmTestResult(null)
      setEmbeddingTestResult(null)
    } catch {
      setToast({ message: '恢复失败', type: 'error' })
    }
  }

  const handleTriggerRebuild = async () => {
    try {
      await triggerRebuildMutation.mutateAsync()
      setShowRebuildProgress(true)
      setToast({ message: '索引重建已启动', type: 'success' })
    } catch {
      setToast({ message: '启动失败', type: 'error' })
    }
  }

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
            toast.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">系统设置</h2>
        <p className="mt-2 text-gray-500">配置模型、检索参数等</p>
      </div>

      {settings?.needs_rebuild_index && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">⚠️</span>
            <span className="text-yellow-800">
              Embedding/分段配置已变更，索引需要重建，检索结果可能不准确。
            </span>
          </div>
          <button
            onClick={handleTriggerRebuild}
            disabled={triggerRebuildMutation.isPending}
            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50 transition-colors"
          >
            立即重建
          </button>
        </div>
      )}

      {showRebuildProgress && rebuildStatus.data && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-800 font-medium">{rebuildStatus.data.message}</span>
            <span className="text-blue-600 text-sm">
              {Math.round(rebuildStatus.data.progress * 100)}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${rebuildStatus.data.progress * 100}%` }}
            />
          </div>
          {rebuildStatus.data.status === 'completed' && (
            <p className="mt-2 text-sm text-green-600">✅ 重建完成</p>
          )}
          {rebuildStatus.data.status === 'failed' && (
            <p className="mt-2 text-sm text-red-600">❌ 重建失败</p>
          )}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">LLM 模型配置</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">推理模式</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="llm_provider"
                  value="ollama"
                  checked={formData.llm_provider === 'ollama'}
                  onChange={(e) =>
                    handleFieldChange('llm_provider', e.target.value as LLMProvider)
                  }
                  className="text-blue-600"
                />
                <span className="text-gray-700">Ollama</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="llm_provider"
                  value="openai_compatible"
                  checked={formData.llm_provider === 'openai_compatible'}
                  onChange={(e) =>
                    handleFieldChange('llm_provider', e.target.value as LLMProvider)
                  }
                  className="text-blue-600"
                />
                <span className="text-gray-700">OpenAI 兼容 API</span>
              </label>
            </div>
          </div>

          {formData.llm_provider === 'ollama' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  服务地址
                </label>
                <input
                  type="text"
                  value={formData.ollama_base_url}
                  onChange={(e) => handleFieldChange('ollama_base_url', e.target.value)}
                  onBlur={loadOllamaModels}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                <div className="flex gap-2">
                  <select
                    value={formData.ollama_model}
                    onChange={(e) => handleFieldChange('ollama_model', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {ollamaModels.length > 0 ? (
                      ollamaModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))
                    ) : (
                      <option value={formData.ollama_model}>
                        {formData.ollama_model}
                      </option>
                    )}
                  </select>
                  <button
                    onClick={loadOllamaModels}
                    disabled={isLoadingModels || !formData.ollama_base_url}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoadingModels ? '加载中...' : '刷新'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API 地址
                </label>
                <input
                  type="text"
                  value={formData.llm_api_base_url}
                  onChange={(e) => handleFieldChange('llm_api_base_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.llm_api_key}
                  onChange={(e) => handleFieldChange('llm_api_key', e.target.value)}
                  placeholder={settings?.llm_api_key_masked || '请输入 API Key'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型名称
                </label>
                <input
                  type="text"
                  value={formData.llm_model_name}
                  onChange={(e) => handleFieldChange('llm_model_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="gpt-4o, deepseek-chat 等"
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={testLLMConnection}
              disabled={testConnectionMutation.isPending}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testConnectionMutation.isPending ? '测试中...' : '测试连接'}
            </button>
            {llmTestResult && (
              <span
                className={`text-sm ${
                  llmTestResult.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {llmTestResult.success ? '✅ ' : '❌ '}
                {llmTestResult.message}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Embedding 模型配置</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Embedding 模式
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="embedding_provider"
                  value="local"
                  checked={formData.embedding_provider === 'local'}
                  onChange={(e) =>
                    handleFieldChange('embedding_provider', e.target.value as EmbeddingProvider)
                  }
                  className="text-blue-600"
                />
                <span className="text-gray-700">本地模型</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="embedding_provider"
                  value="openai_compatible"
                  checked={formData.embedding_provider === 'openai_compatible'}
                  onChange={(e) =>
                    handleFieldChange('embedding_provider', e.target.value as EmbeddingProvider)
                  }
                  className="text-blue-600"
                />
                <span className="text-gray-700">远程 API</span>
              </label>
            </div>
          </div>

          {formData.embedding_provider === 'local' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                <input
                  type="text"
                  value={formData.embedding_model}
                  onChange={(e) => handleFieldChange('embedding_model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="组织名/模型名，如 BAAI/bge-small-zh-v1.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HF 镜像
                </label>
                <input
                  type="text"
                  value={formData.hf_endpoint}
                  onChange={(e) => handleFieldChange('hf_endpoint', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="https://hf-mirror.com"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API 地址
                </label>
                <input
                  type="text"
                  value={formData.embedding_api_base_url}
                  onChange={(e) =>
                    handleFieldChange('embedding_api_base_url', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.embedding_api_key}
                  onChange={(e) => handleFieldChange('embedding_api_key', e.target.value)}
                  placeholder={settings?.embedding_api_key_masked || '请输入 API Key'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型名称
                </label>
                <input
                  type="text"
                  value={formData.embedding_model_name}
                  onChange={(e) => handleFieldChange('embedding_model_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="text-embedding-3-small 等"
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={testEmbeddingConnection}
              disabled={testConnectionMutation.isPending}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testConnectionMutation.isPending ? '测试中...' : '测试连接'}
            </button>
            {embeddingTestResult && (
              <span
                className={`text-sm ${
                  embeddingTestResult.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {embeddingTestResult.success ? '✅ ' : '❌ '}
                {embeddingTestResult.message}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">检索参数</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                检索返回条数 (top_k)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={formData.search_top_k}
                onChange={(e) =>
                  handleFieldChange('search_top_k', parseInt(e.target.value) || 5)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                默认检索模式
              </label>
              <select
                value={formData.search_mode}
                onChange={(e) =>
                  handleFieldChange('search_mode', e.target.value as SearchMode)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="hybrid">混合检索</option>
                <option value="semantic">语义检索</option>
                <option value="fulltext">全文检索</option>
              </select>
            </div>

            {formData.search_mode === 'hybrid' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    语义权重: {formData.semantic_weight.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={formData.semantic_weight}
                    onChange={(e) =>
                      handleFieldChange('semantic_weight', parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    全文权重: {formData.fulltext_weight.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={formData.fulltext_weight}
                    onChange={(e) =>
                      handleFieldChange('fulltext_weight', parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分段大小 (字符)
              </label>
              <input
                type="number"
                min={100}
                max={2000}
                value={formData.chunk_size}
                onChange={(e) =>
                  handleFieldChange('chunk_size', parseInt(e.target.value) || 500)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分段重叠 (字符)
              </label>
              <input
                type="number"
                min={0}
                max={500}
                value={formData.chunk_overlap}
                onChange={(e) =>
                  handleFieldChange('chunk_overlap', parseInt(e.target.value) || 50)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <p className="mt-4 text-sm text-yellow-600">
            ⚠️ 修改分段参数或 Embedding 模型需要重建所有文档索引
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">对话参数</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              对话历史轮数
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={formData.chat_history_rounds}
              onChange={(e) =>
                handleFieldChange(
                  'chat_history_rounds',
                  parseInt(e.target.value) || 5
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="mt-1 text-sm text-gray-500">
              携带最近 N 轮对话作为上下文
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={resetMutation.isPending}
            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resetMutation.isPending ? '恢复中...' : '恢复默认值'}
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateMutation.isPending ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {showRebuildWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ⚠️ 索引重建警告
            </h3>
            <p className="text-gray-600 mb-4">
              修改 Embedding 模型或分段参数后，已有文档的向量索引将失效。
            </p>
            <p className="text-gray-600 mb-4">
              需要对所有知识库重新分段并重建索引才能正常检索。
              重建耗时取决于文档数量，期间检索功能不可用。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRebuildWarning(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => saveSettings(false)}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存配置并稍后重建
              </button>
              <button
                onClick={() => saveSettings(true)}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存配置并立即重建
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认恢复默认值</h3>
            <p className="text-gray-600 mb-4">
              确定要将所有设置恢复为默认值吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resetMutation.isPending ? '恢复中...' : '确认恢复'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
