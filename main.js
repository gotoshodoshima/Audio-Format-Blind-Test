const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');

nativeTheme.themeSource = 'dark';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true, // 必要に応じてセキュリティ設定を調整
      contextIsolation: false
    },
    autoHideMenuBar: true // メニューバーを隠す
  });

  // ローカルのHTMLファイルをロード
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});