import { type ChangeEvent, type DragEvent, type FC, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useKnowledgeBases,
  useCreateKnowledgeBase,
  useUpdateKnowledgeBase,
  useDeleteKnowledgeBase,
  useDocuments,
  useUploadDocuments,
  useDeleteDocument,
} from '@/hooks'
import type { DocumentStatus } from '@/types'

const getStatusColor = (status: DocumentStatus): string => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'processing':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusText = (status: DocumentStatus): string => {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'processing':
      return '处理中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return status
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const allowedFileExtensions = ['txt', 'md', 'pdf', 'docx', 'doc', 'xlsx', 'xls']
const maxFileSize = 50 * 1024 * 1024

const KnowledgeBasesPage: FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const kbId = id ? parseInt(id, 10) : undefined

  const { data: kbList, isLoading: kbLoading } = useKnowledgeBases()
  const { data: docList, isLoading: docsLoading } = useDocuments(kbId)

  const createMutation = useCreateKnowledgeBase()
  const updateMutation = useUpdateKnowledgeBase()
  const deleteMutation = useDeleteKnowledgeBase()
  const uploadMutation = useUploadDocuments()
  const deleteDocMutation = useDeleteDocument()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false)
  const [selectedKb, setSelectedKb] = useState<{ id: number; name: string; description: string | null } | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<{ id: number; kbId: number; name: string } | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    setUploadMessage(null)
    setUploadError(null)
  }, [kbId])

  const knowledgeBases = kbList?.items ?? []
  const documents = docList?.items ?? []
  const docTotal = docList?.total ?? 0

  const currentKb = knowledgeBases.find((kb) => kb.id === kbId)

  const handleCreateKb = () => {
    setFormName('')
    setFormDescription('')
    setShowCreateModal(true)
  }

  const handleEditKb = (kb: { id: number; name: string; description: string | null }) => {
    setSelectedKb(kb)
    setFormName(kb.name)
    setFormDescription(kb.description || '')
    setShowEditModal(true)
  }

  const handleDeleteKb = (kb: { id: number; name: string }) => {
    setSelectedKb({ ...kb, description: null })
    setShowDeleteModal(true)
  }

  const handleDeleteDoc = (docId: number, kbId: number, filename: string) => {
    setSelectedDoc({ id: docId, kbId, name: filename })
    setShowDeleteDocModal(true)
  }

  const submitCreate = () => {
    if (!formName.trim()) return
    createMutation.mutate(
      { name: formName.trim(), description: formDescription.trim() || undefined },
      {
        onSuccess: () => setShowCreateModal(false),
      }
    )
  }

  const submitEdit = () => {
    if (!selectedKb || !formName.trim()) return
    updateMutation.mutate(
      {
        id: selectedKb.id,
        data: { name: formName.trim(), description: formDescription.trim() || undefined },
      },
      {
        onSuccess: () => setShowEditModal(false),
      }
    )
  }

  const submitDelete = () => {
    if (!selectedKb) return
    deleteMutation.mutate(selectedKb.id, {
      onSuccess: () => {
        setShowDeleteModal(false)
        if (kbId === selectedKb.id) {
          navigate('/knowledge-bases')
        }
      },
    })
  }

  const submitDeleteDoc = () => {
    if (!selectedDoc) return
    deleteDocMutation.mutate(
      { kbId: selectedDoc.kbId, docId: selectedDoc.id },
      {
        onSuccess: () => setShowDeleteDocModal(false),
      }
    )
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0 || !kbId) return

    const fileArray = Array.from(files)
    const invalidFiles = fileArray.flatMap((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || ''
      const errors: string[] = []

      if (!allowedFileExtensions.includes(extension)) {
        errors.push(`${file.name}: 不支持的文件格式`)
      }
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: 文件大小不能超过 50MB`)
      }

      return errors
    })

    if (invalidFiles.length > 0) {
      setUploadError(invalidFiles.join('；'))
      setUploadMessage(null)
      return
    }

    setUploadError(null)
    setUploadMessage(`准备上传 ${fileArray.length} 个文件`)

    uploadMutation.mutate(
      { kbId, files: fileArray },
      {
        onSuccess: (data) => {
          const successCount = data.uploaded.length
          const skippedCount = data.skipped.length
          if (skippedCount > 0) {
            setUploadMessage(`已接收 ${successCount} 个文件，跳过 ${skippedCount} 个文件`)
            setUploadError(data.skipped.join('；'))
            return
          }
          setUploadMessage(`已接收 ${successCount} 个文件，正在后台处理中`)
          setUploadError(null)
          setTimeout(() => {
            setUploadMessage((current) =>
              current === `已接收 ${successCount} 个文件，正在后台处理中` ? null : current
            )
          }, 4000)
        },
        onError: () => {
          setUploadMessage(null)
          setUploadError('上传失败，请稍后重试')
        },
      }
    )
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files)
    e.target.value = ''
  }

  if (kbLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!kbId) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">知识库</h2>
            <p className="mt-2 text-gray-500">管理你的知识库和文档</p>
          </div>
          <button
            onClick={handleCreateKb}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 新建知识库
          </button>
        </div>

        {knowledgeBases && knowledgeBases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/knowledge-bases/${kb.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{kb.name}</h3>
                    {kb.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{kb.description}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-400">
                      {kb.document_count} 个文档
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        handleEditKb({ id: kb.id, name: kb.name, description: kb.description })
                      }
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteKb({ id: kb.id, name: kb.name })}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg">暂无知识库</div>
            <p className="mt-2 text-gray-400">点击上方按钮创建第一个知识库</p>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">新建知识库</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="输入知识库名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="输入知识库描述"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitCreate}
                  disabled={!formName.trim() || createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createMutation.isPending ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && selectedKb && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">编辑知识库</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="输入知识库名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="输入知识库描述"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitEdit}
                  disabled={!formName.trim() || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateMutation.isPending ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && selectedKb && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
              <p className="text-gray-600">
                确定要删除知识库 <span className="font-medium text-gray-900">"{selectedKb.name}"</span> 吗？
                此操作将删除该知识库下的所有文档和数据，且无法恢复。
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteMutation.isPending ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/knowledge-bases')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← 返回
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{currentKb?.name}</h2>
          {currentKb?.description && (
            <p className="mt-1 text-gray-500">{currentKb.description}</p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              currentKb &&
              handleEditKb({
                id: currentKb.id,
                name: currentKb.name,
                description: currentKb.description,
              })
            }
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() =>
              currentKb && handleDeleteKb({ id: currentKb.id, name: currentKb.name })
            }
            className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div
          className={`flex-1 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-gray-500 mb-4">
            <p className="text-lg">拖拽文件到此处或</p>
            <label className="inline-block mt-2">
              <input
                type="file"
                multiple
                accept=".txt,.md,.pdf,.docx,.doc,.xlsx,.xls"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                选择文件
              </span>
            </label>
          </div>
          <p className="text-sm text-gray-400">
            支持 TXT、MD、PDF、DOCX、XLSX 格式，单文件最大 50MB
          </p>
          {uploadMutation.isPending && (
            <p className="mt-2 text-blue-600">上传中...</p>
          )}
          {uploadMessage && (
            <p className="mt-2 text-green-600">{uploadMessage}</p>
          )}
          {uploadError && (
            <div className="mt-2 text-sm text-red-600">{uploadError}</div>
          )}
        </div>

        <button
          onClick={() => navigate(`/knowledge-bases/${kbId}/notes/new`)}
          className="px-6 py-8 bg-white border-2 border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors flex flex-col items-center justify-center gap-2"
        >
          <span className="text-2xl">+</span>
          <span className="font-medium">新建笔记</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">
            文档列表 ({docTotal})
          </h3>
        </div>
        {docsLoading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : !documents || documents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400">暂无文档，上传第一个文档开始使用</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <div key={doc.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-500 uppercase">{doc.file_type}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{doc.filename}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.file_size)} · {doc.chunk_count} 个分段 ·{' '}
                      {new Date(doc.created_at).toLocaleString('zh-CN')}
                    </p>
                    {doc.error_message && (
                      <p className="mt-1 text-sm text-red-600">{doc.error_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(doc.status)}`}
                  >
                    {getStatusText(doc.status)}
                  </span>
                  {doc.file_type === 'md' && (
                    <button
                      onClick={() => navigate(`/knowledge-bases/${kbId}/notes/${doc.id}/edit`)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      编辑
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteDoc(doc.id, kbId, doc.filename)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditModal && selectedKb && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">编辑知识库</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="输入知识库名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="输入知识库描述"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitEdit}
                disabled={!formName.trim() || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedKb && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600">
              确定要删除知识库 <span className="font-medium text-gray-900">"{selectedKb.name}"</span> 吗？
              此操作将删除该知识库下的所有文档和数据，且无法恢复。
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDocModal && selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600">
              确定要删除文档 <span className="font-medium text-gray-900">"{selectedDoc.name}"</span> 吗？
              此操作无法恢复。
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteDocModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitDeleteDoc}
                disabled={deleteDocMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteDocMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeBasesPage
