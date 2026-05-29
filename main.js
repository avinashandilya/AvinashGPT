const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');

let mainWindow;

app.setName('AvinashGPT');

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icnsPath = path.join(__dirname, 'build', 'icon.icns');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 680,
    minHeight: 500,
    icon: process.platform === 'darwin' && require('fs').existsSync(icnsPath) ? icnsPath : iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  });

  // macOS dock icon
  if (process.platform === 'darwin') {
    app.dock.setIcon(nativeImage.createFromPath(iconPath));
  }

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
