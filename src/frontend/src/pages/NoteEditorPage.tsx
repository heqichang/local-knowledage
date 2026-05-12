import { type FC, useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorView } from '@codemirror/view'
import MarkdownEditor from '@/components/editor/MarkdownEditor'
import MarkdownPreview from '@/components/editor/MarkdownPreview'
import EditorToolbar, { type ViewMode } from '@/components/editor/EditorToolbar'
import {
  useDocumentContent,
  useCreateNote,
  useUpdateDocumentContent,
  useDocuments,
} from '@/hooks/useDocuments'

const NoteEditorPage: FC = () => {
  const { kbId, docId } = useParams()
  const navigate = useNavigate()

  const kbIdNum = kbId ? parseInt(kbId, 10) : undefined
  const docIdNum = docId ? parseInt(docId, 10) : undefined
  const isEditMode = Boolean(docIdNum)

  const editorRef = useRef<EditorView | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [filename, setFilename] = useState('')
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [originalFilename, setOriginalFilename] = useState('')

  const { data: documentContent, isLoading: isLoadingContent, error: loadError } =
    useDocumentContent(kbIdNum, docIdNum)

  const { data: documents } = useDocuments(kbIdNum)

  const createNote = useCreateNote()
  const updateContent = useUpdateDocumentContent()

  const isSaving = createNote.isPending || updateContent.isPending
  const saveError = createNote.error || updateContent.error

  const isDirty = content !== originalContent || filename !== originalFilename

  const currentDoc = documents?.items.find((d) => d.id === docIdNum)
  const isProcessing = currentDoc?.status === 'pending' || currentDoc?.status === 'processing'

  useEffect(() => {
    if (isEditMode && documentContent && !isLoadingContent) {
      setContent(documentContent.content)
      setOriginalContent(documentContent.content)
      setFilename(documentContent.filename)
      setOriginalFilename(documentContent.filename)
    }
  }, [documentContent, isLoadingContent, isEditMode])

  const handleBack = () => {
    if (kbIdNum) {
      navigate(`/knowledge-bases/${kbIdNum}`)
    } else {
      navigate('/knowledge-bases')
    }
  }

  const handleSave = async () => {
    if (!kbIdNum) return

    if (isEditMode && docIdNum) {
      await updateContent.mutateAsync({
        kbId: kbIdNum,
        docId: docIdNum,
        data: {
          content,
          filename: filename !== originalFilename ? filename : undefined,
        },
      })
      setOriginalContent(content)
      setOriginalFilename(filename)
    } else {
      if (!filename.trim()) {
        alert('请输入文件名')
        return
      }
      const result = await createNote.mutateAsync({
        kbId: kbIdNum,
        data: {
          filename: filename.trim(),
          content,
        },
      })
      navigate(`/knowledge-bases/${kbIdNum}/notes/${result.id}/edit`)
    }
  }

  if (isEditMode && isLoadingContent) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-red-500">加载失败: {(loadError as Error).message}</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ← 返回
          </button>
          <div className="flex-1">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="输入文件名..."
              className="w-full text-xl font-semibold text-gray-800 border-none outline-none bg-transparent placeholder-gray-400"
            />
          </div>
          {isProcessing && (
            <div className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-lg">
              处理中...
            </div>
          )}
          {saveError && (
            <div className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-lg">
              保存失败
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${
                isSaving || !isDirty
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </header>

      <EditorToolbar
        editorRef={editorRef}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSave={handleSave}
        isSaving={isSaving}
        canUndo={true}
        canRedo={true}
      />

      <main className="flex-1 flex overflow-hidden">
        {viewMode === 'source' && (
          <div className="flex-1">
            <MarkdownEditor
              value={content}
              onChange={setContent}
              editorRef={editorRef}
              placeholder="开始编写 Markdown..."
            />
          </div>
        )}

        {viewMode === 'preview' && (
          <div className="flex-1">
            <MarkdownPreview content={content} />
          </div>
        )}

        {viewMode === 'split' && (
          <>
            <div className="flex-1 border-r border-gray-200">
              <MarkdownEditor
                value={content}
                onChange={setContent}
                editorRef={editorRef}
                placeholder="开始编写 Markdown..."
              />
            </div>
            <div className="flex-1">
              <MarkdownPreview content={content} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default NoteEditorPage
