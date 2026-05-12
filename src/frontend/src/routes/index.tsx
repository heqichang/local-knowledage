import { createBrowserRouter } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import ChatPage from '@/pages/ChatPage'
import KnowledgeBasesPage from '@/pages/KnowledgeBasesPage'
import NoteEditorPage from '@/pages/NoteEditorPage'
import SearchPage from '@/pages/SearchPage'
import SettingsPage from '@/pages/SettingsPage'

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <ChatPage /> },
      { path: '/chat/:conversationId?', element: <ChatPage /> },
      { path: '/knowledge-bases', element: <KnowledgeBasesPage /> },
      { path: '/knowledge-bases/:id', element: <KnowledgeBasesPage /> },
      { path: '/knowledge-bases/:kbId/notes/new', element: <NoteEditorPage /> },
      { path: '/knowledge-bases/:kbId/notes/:docId/edit', element: <NoteEditorPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])
