import { type FC, useCallback, useEffect, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  editorRef?: React.MutableRefObject<EditorView | null>
  placeholder?: string
}

const MarkdownEditor: FC<MarkdownEditorProps> = ({ value, onChange, editorRef, placeholder }) => {
  const cmRef = useRef<ReactCodeMirrorRef>(null)

  useEffect(() => {
    if (editorRef && cmRef.current?.view) {
      editorRef.current = cmRef.current.view
    }
    return () => {
      if (editorRef) {
        editorRef.current = null
      }
    }
  }, [editorRef])

  const handleCreateEditor = useCallback((view: EditorView) => {
    if (editorRef) {
      editorRef.current = view
    }
  }, [editorRef])

  return (
    <CodeMirror
      ref={cmRef}
      value={value}
      height="100%"
      extensions={[
        markdown(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
      ]}
      onChange={onChange}
      onCreateEditor={handleCreateEditor}
      placeholder={placeholder || '开始编写 Markdown...'}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
      }}
    />
  )
}

export default MarkdownEditor
