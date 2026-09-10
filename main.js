const { app, BrowserWindow, net } = require("electron");
const path = require("path");

let autoUpdater;
let retryTimer;
try {
  ({ autoUpdater } = require("electron-updater"));
} catch (_error) {
  autoUpdater = null;
}

app.setPath("userData", path.join(app.getPath("appData"), "Educapp"));

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile("index.html");
  let updateScreenShown = false;
  let latestProgress = 0;

  const showUpdateScreen = async (message) => {
    if (updateScreenShown || win.isDestroyed()) return;
    updateScreenShown = true;
    await win.loadFile("loading.html");
    win.webContents.send("update-status", message);
    win.webContents.send("update-progress", latestProgress);
  };

  const returnToApp = () => {
    if (!updateScreenShown || win.isDestroyed()) return;
    updateScreenShown = false;
    win.loadFile("index.html");
  };

  const scheduleUpdateRetry = () => {
    if (retryTimer || !app.isPackaged || !autoUpdater) return;

    retryTimer = setInterval(() => {
      if (!net.isOnline()) return;
      clearInterval(retryTimer);
      retryTimer = null;
      autoUpdater.checkForUpdates().catch(scheduleUpdateRetry);
    }, 30000);
  };

  if (!app.isPackaged || !autoUpdater) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.on("update-available", async () => {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    latestProgress = 0;
    await showUpdateScreen("Téléchargement de la mise à jour...");
  });
  autoUpdater.on("download-progress", (progress) => {
    latestProgress = Math.max(0, Math.min(100, progress.percent || 0));
    if (updateScreenShown && !win.isDestroyed()) {
      win.webContents.send("update-progress", latestProgress);
    }
  });
  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("update-status", "Mise à jour prête. Redémarrage...");
    autoUpdater.quitAndInstall();
  });
  autoUpdater.on("error", () => {
    returnToApp();
    scheduleUpdateRetry();
  });

  autoUpdater.checkForUpdates().catch(scheduleUpdateRetry);
}

app.whenReady().then(createWindow);