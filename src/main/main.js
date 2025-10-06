// src/main/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { initIpc } = require('./ipc');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100, height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  // Temporary: load a placeholder page or local file; UI comes later
  win.loadURL('data:text/html,<html><body><h3>DJ Assistant Backend Ready</h3></body></html>');
}

app.whenReady().then(() => {
  initIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
