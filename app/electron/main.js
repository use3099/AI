// 桌面版（Windows / macOS）：窗口里直接加载线上网站，外部链接用系统浏览器打开
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { siteUrl, appName } = require('../site.json');

const siteHost = new URL(siteUrl).host;

function createWindow() {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: appName,
    backgroundColor: '#F2F5F9',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });

  const showOffline = () => win.loadFile(path.join(__dirname, '..', 'www', 'offline.html'));
  win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) showOffline();
  });

  // 站外链接（支付页面除外的普通链接）交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const u = new URL(url);
    if (u.protocol === 'file:') return;
    if (u.host !== siteHost && !/pay|alipay|wx|epay/i.test(u.host + u.pathname)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(siteUrl);
}

if (process.platform === 'darwin') {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }
  ]));
} else {
  Menu.setApplicationMenu(null);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
