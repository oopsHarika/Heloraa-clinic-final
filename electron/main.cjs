const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

const DEFAULT_APP_URL = "https://healthcare-multiagent-beryl.vercel.app";
const APP_URL = process.env.HELORAA_DESKTOP_URL || DEFAULT_APP_URL;
let mainWindow;

function isAllowedAppUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const configured = new URL(APP_URL);
    return parsed.origin === configured.origin;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: "Heloraa Clinic",
    autoHideMenuBar: true,
    backgroundColor: "#f7f9fc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedAppUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.heloraa.clinic");
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
