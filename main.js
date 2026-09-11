const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const dns = require("dns");
const { autoUpdater } = require("electron-updater");

app.setPath("userData", path.join(app.getPath("appData"), "Educapp"));

// Nécessaire sur Windows pour que la barre des tâches associe bien
// l'icône et le nom à ton app plutôt qu'à Electron par défaut.
if (process.platform === "win32") {
  app.setAppUserModelId("com.educapp.app");
}

// Utilise le .ico (multi-résolutions) plutôt que le .png : c'est ce
// que Windows attend pour un rendu net en barre des tâches / Alt+Tab.
const APP_ICON = path.join(__dirname, "icon.ico");

let mainWindow = null;
let updateWindow = null;

// On garde le contrôle total : pas de téléchargement ni d'installation
// silencieuse tant que l'utilisateur n'a rien vu.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: APP_ICON,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile("index.html");
}

function createUpdateWindow() {
  if (updateWindow) return updateWindow;

  updateWindow = new BrowserWindow({
    width: 440,
    height: 440,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    icon: APP_ICON,
    backgroundColor: "#f5f8fc",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  updateWindow.once("ready-to-show", () => updateWindow.show());
  updateWindow.loadFile("update.html");

  updateWindow.on("closed", () => {
    updateWindow = null;
  });

  return updateWindow;
}

function sendToUpdateWindow(channel, payload) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send(channel, payload);
  }
}

// Vérifie qu'il y a une connexion avant de contacter GitHub.
// Si offline, on ne fait RIEN : pas d'erreur, pas de fenêtre.
function isOnline() {
  return new Promise((resolve) => {
    dns.lookup("github.com", (err) => resolve(!err));
  });
}

async function checkForUpdates() {
  const online = await isOnline();
  if (!online) return;

  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    console.error("Vérification de mise à jour impossible :", err);
  }
}

// --- Événements electron-updater --------------------------------------

autoUpdater.on("update-available", (info) => {
  // La fenêtre de mise à jour ne se crée QUE si une mise à jour existe.
  createUpdateWindow();
  sendToUpdateWindow("update-status", { state: "found", version: info.version });
  autoUpdater.downloadUpdate();
});

autoUpdater.on("update-not-available", () => {
  // Rien à faire : le menu de mise à jour ne s'active jamais.
});

autoUpdater.on("download-progress", (progress) => {
  sendToUpdateWindow("update-progress", {
    percent: Math.round(progress.percent)
  });
});

autoUpdater.on("update-downloaded", () => {
  sendToUpdateWindow("update-status", { state: "ready" });
});

autoUpdater.on("error", (err) => {
  console.error("Erreur electron-updater :", err);
  sendToUpdateWindow("update-status", { state: "error" });
});

// --- IPC depuis la fenêtre de mise à jour -------------------------------

ipcMain.on("update-restart-now", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on("update-close-window", () => {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.close();
  }
});

// --- Cycle de vie de l'app ----------------------------------------------

app.whenReady().then(() => {
  createMainWindow();
  checkForUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
