const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { startBackend, stopBackend, getApiPort, getBackendStatus } = require('./backendManager')

const VITE_DEV_SERVER_URL = 'http://localhost:5174'
const PRELOAD_PATH = path.join(__dirname, 'preload.js')

let mainWindow: InstanceType<typeof BrowserWindow> | null = null
let backendStarted = false

async function handleGetApiPort(): Promise<number | null> {
  return getApiPort()
}

async function handleGetBackendStatus(): Promise<string> {
  return getBackendStatus()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '本地知识库',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function startup(): Promise<void> {
  ipcMain.handle('get-api-port', handleGetApiPort)
  ipcMain.handle('get-backend-status', handleGetBackendStatus)

  if (!backendStarted) {
    backendStarted = true
    await startBackend()
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}

async function shutdown(): Promise<void> {
  console.log('Shutting down...')
  await stopBackend()
}

app.whenReady().then(startup)

app.on('window-all-closed', async () => {
  await shutdown()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event: Electron.Event) => {
  if (backendStarted) {
    event.preventDefault()
    await shutdown()
    app.quit()
  }
})
