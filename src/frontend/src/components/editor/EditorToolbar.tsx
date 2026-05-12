import { type FC } from 'react'
import { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'

export type ViewMode = 'split' | 'source' | 'preview'

interface EditorToolbarProps {
  editorRef: React.MutableRefObject<EditorView | null>
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onSave: () => void
  isSaving: boolean
  canUndo: boolean
  canRedo: boolean
}

const ToolbarButton: FC<{
  onClick: () => void
  children: React.ReactNode
  title?: string
  active?: boolean
  disabled?: boolean
}> = ({ onClick, children, title, active, disabled }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-blue-100 text-blue-700'
        : disabled
        ? 'text-gray-400 cursor-not-allowed'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }`}
  >
    {children}
  </button>
)

const ToolbarDivider: FC = () => <div className="w-px h-6 bg-gray-200 mx-2" />

const EditorToolbar: FC<EditorToolbarProps> = ({
  editorRef,
  viewMode,
  onViewModeChange,
  onSave,
  isSaving,
  canUndo,
  canRedo,
}) => {
  const insertText = (before: string, after: string = '') => {
    const view = editorRef.current
    if (!view) return

    const { state } = view
    const { from, to } = state.selection.main
    const selectedText = state.sliceDoc(from, to)
    const insertion = before + selectedText + after

    view.dispatch({
      changes: { from, to, insert: insertion },
      selection: { anchor: from + before.length + selectedText.length + after.length },
    })

    view.focus()
  }

  const insertBlock = (prefix: string) => {
    const view = editorRef.current
    if (!view) return

    const { state } = view
    const { from, to } = state.selection.main
    const line = state.doc.lineAt(from)
    const lineStart = line.from

    const insertion = prefix + state.sliceDoc(lineStart, to) + '\n'
    view.dispatch({
      changes: { from: lineStart, to, insert: insertion },
      selection: { anchor: lineStart + insertion.length },
    })

    view.focus()
  }

  const handleUndo = () => {
    const view = editorRef.current
    if (view) {
      undo(view)
      view.focus()
    }
  }

  const handleRedo = () => {
    const view = editorRef.current
    if (view) {
      redo(view)
      view.focus()
    }
  }

  const handleBold = () => insertText('**', '**')
  const handleItalic = () => insertText('*', '*')
  const handleH1 = () => insertBlock('# ')
  const handleH2 = () => insertBlock('## ')
  const handleH3 = () => insertBlock('### ')
  const handleOrderedList = () => insertBlock('1. ')
  const handleUnorderedList = () => insertBlock('- ')
  const handleLink = () => insertText('[链接文本](', ')')
  const handleCodeBlock = () => insertText('```javascript\n', '\n```')
  const handleInlineMath = () => insertText('$', '$')
  const handleBlockMath = () => insertText('$$\n', '\n$$')

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center gap-1 flex-wrap">
        <ToolbarButton onClick={onSave} disabled={isSaving}>
          {isSaving ? '保存中...' : '保存'}
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={handleUndo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
          ↩
        </ToolbarButton>
        <ToolbarButton onClick={handleRedo} disabled={!canRedo} title="重做 (Ctrl+Y)">
          ↪
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={handleBold} title="加粗">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton onClick={handleItalic} title="斜体">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton onClick={handleH1} title="标题 1">
          H1
        </ToolbarButton>
        <ToolbarButton onClick={handleH2} title="标题 2">
          H2
        </ToolbarButton>
        <ToolbarButton onClick={handleH3} title="标题 3">
          H3
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={handleOrderedList} title="有序列表">
          1.
        </ToolbarButton>
        <ToolbarButton onClick={handleUnorderedList} title="无序列表">
          •
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={handleLink} title="插入链接">
          🔗
        </ToolbarButton>
        <ToolbarButton onClick={handleCodeBlock} title="插入代码块">
          {'</>'}
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton onClick={handleInlineMath} title="行内公式">
          ∑
        </ToolbarButton>
        <ToolbarButton onClick={handleBlockMath} title="块级公式">
          ∑∑
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton
            onClick={() => onViewModeChange('source')}
            active={viewMode === 'source'}
            title="仅源码"
          >
            源码
          </ToolbarButton>
          <ToolbarButton
            onClick={() => onViewModeChange('split')}
            active={viewMode === 'split'}
            title="分屏"
          >
            分屏
          </ToolbarButton>
          <ToolbarButton
            onClick={() => onViewModeChange('preview')}
            active={viewMode === 'preview'}
            title="仅预览"
          >
            预览
          </ToolbarButton>
        </div>
      </div>
    </div>
  )
}

export default EditorToolbar
