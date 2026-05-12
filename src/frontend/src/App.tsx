import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { router } from '@/routes'
import { setApiBaseUrl } from '@/api/client'
import '@/types/electron'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

const HEALTH_CHECK_INTERVAL = 1000
const MAX_HEALTH_ATTEMPTS = 60

type LoadingStatus = 'idle' | 'loading' | 'ready' | 'error'

function App() {
  const [status, setStatus] = useState<LoadingStatus>('idle')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const initializeApp = async () => {
      setStatus('loading')

      const isElectron = !!window.electronAPI

      if (!isElectron) {
        setStatus('ready')
        return
      }

      try {
        const port = await window.electronAPI!.getApiPort()
        const baseUrl = `http://localhost:${port}`
        setApiBaseUrl(baseUrl)

        for (let attempt = 0; attempt < MAX_HEALTH_ATTEMPTS; attempt++) {
          try {
            await axios.get(`${baseUrl}/health`)
            setStatus('ready')
            return
          } catch {
            await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL))
          }
        }

        setStatus('error')
        setError('后端服务启动超时，请检查日志并重试。')
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : '启动服务时发生未知错误。')
      }
    }

    initializeApp()
  }, [])

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-700 text-lg font-medium">正在启动服务...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-red-800 mb-2">启动失败</h1>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

export default App
