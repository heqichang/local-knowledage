import { createBrowserRouter } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import ChatPage from '@/pages/ChatPage'
import KnowledgeBasesPage from '@/pages/KnowledgeBasesPage'
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
      { path: '/search', element: <SearchPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
])
