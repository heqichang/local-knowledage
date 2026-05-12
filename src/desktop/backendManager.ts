import { ChildProcess, spawn } from 'child_process'
import { app } from 'electron'
import axios from 'axios'
import getPort, { portNumbers } from 'get-port'
import treeKill from 'tree-kill'
import path from 'path'

type BackendStatus = 'starting' | 'ready' | 'error'

interface BackendState {
  status: BackendStatus
  port: number | null
  errorMessage: string | null
  process: ChildProcess | null
}

const state: BackendState = {
  status: 'starting',
  port: null,
  errorMessage: null,
  process: null,
}

const isDev = !!process.env.VITE_DEV_SERVER_URL

async function findAvailablePort(): Promise<number> {
  return getPort({
    port: portNumbers(8765, 9000),
  })
}

function getBackendWorkingDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', '..', 'src', 'backend')
  }
  return path.join(process.resourcesPath, 'backend')
}

function getBackendCommandAndArgs(port: number, dataDir: string): { command: string; args: string[] } {
  if (isDev) {
    return {
      command: 'uv',
      args: ['run', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)],
    }
  }
  return {
    command: path.join(process.resourcesPath, 'backend', 'local-knowledge-base.exe'),
    args: [],
  }
}

async function checkHealth(port: number): Promise<boolean> {
  try {
    const response = await axios.get(`http://127.0.0.1:${port}/health`, {
      timeout: 2000,
    })
    return response.status === 200
  } catch {
    return false
  }
}

async function waitForHealth(port: number, timeoutMs: number = 60000, intervalMs: number = 1000): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    if (await checkHealth(port)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return false
}

function logProcessOutput(process: ChildProcess): void {
  if (process.stdout) {
    process.stdout.on('data', (data) => {
      console.log(`[backend stdout] ${data.toString().trim()}`)
    })
  }

  if (process.stderr) {
    process.stderr.on('data', (data) => {
      console.error(`[backend stderr] ${data.toString().trim()}`)
    })
  }
}

export async function startBackend(): Promise<void> {
  state.status = 'starting'
  state.errorMessage = null

  try {
    const port = await findAvailablePort()
    state.port = port

    const dataDir = path.join(app.getPath('userData'), 'data')
    const workingDir = getBackendWorkingDir()
    const { command, args } = getBackendCommandAndArgs(port, dataDir)

    const env = {
      ...process.env,
      APP_PORT: String(port),
      APP_DATA_DIR: dataDir,
    }

    console.log(`Starting backend on port ${port}...`)
    console.log(`Working directory: ${workingDir}`)
    console.log(`Command: ${command} ${args.join(' ')}`)
    console.log(`APP_DATA_DIR: ${dataDir}`)

    const backendProcess = spawn(command, args, {
      cwd: workingDir,
      env,
      windowsHide: true,
    })

    state.process = backendProcess
    logProcessOutput(backendProcess)

    backendProcess.on('error', (error) => {
      console.error('Backend process error:', error)
      if (state.status !== 'ready') {
        state.status = 'error'
        state.errorMessage = `Failed to start backend: ${error.message}`
      }
    })

    backendProcess.on('exit', (code, signal) => {
      console.log(`Backend process exited with code ${code}, signal ${signal}`)
      state.process = null
      if (state.status === 'ready') {
        state.status = 'error'
        state.errorMessage = `Backend exited unexpectedly (code: ${code})`
      }
    })

    const isHealthy = await waitForHealth(port)

    if (isHealthy) {
      state.status = 'ready'
      console.log(`Backend is ready on port ${port}`)
    } else {
      state.status = 'error'
      state.errorMessage = 'Backend health check timed out after 60 seconds'
      console.error('Backend health check timed out')
    }
  } catch (error) {
    console.error('Error starting backend:', error)
    state.status = 'error'
    state.errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }
}

export async function stopBackend(): Promise<void> {
  if (!state.process) {
    console.log('No backend process to stop')
    return
  }

  const processId = state.process.pid
  console.log(`Stopping backend process (PID: ${processId})...`)

  return new Promise((resolve) => {
    if (!processId) {
      state.process = null
      resolve()
      return
    }

    treeKill(processId, (error) => {
      if (error) {
        console.error('Error killing backend process:', error)
      } else {
        console.log(`Backend process (PID: ${processId}) stopped successfully`)
      }
      state.process = null
      resolve()
    })
  })
}

export function getApiPort(): number | null {
  return state.port
}

export function getBackendStatus(): BackendStatus {
  return state.status
}

export function getBackendErrorMessage(): string | null {
  return state.errorMessage
}
