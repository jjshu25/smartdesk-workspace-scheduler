import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../assets/icon.ico'),
  });

  // Load the app
  const startUrl = isDev
    ? 'http://localhost:3000' // Dev server
    : `file://${path.join(__dirname, '../build/index.html')}`; // Production build

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow?.reload();
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            mainWindow?.webContents.toggleDevTools();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('ready', () => {
  createWindow();
  createMenu();
  setupAutoStart();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ✅ NEW: Setup Windows Auto-Start
function setupAutoStart() {
  if (process.platform === 'win32') {
    const exePath = app.getPath('exe');
    
    app.setLoginItemSettings({
      openAtLogin: true,
      path: exePath,
    });

    console.log(`✅ Auto-start enabled for: ${exePath}`);
  }
}

// ✅ NEW: Listen for PC Client commands via IPC
import { ipcMain } from 'electron';

ipcMain.on('pc-client-ready', (event) => {
  console.log('✅ PC Client is ready');
  event.reply('pc-client-acknowledged', 'Main process received your message');
});