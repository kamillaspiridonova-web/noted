const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

// ─── Configuration ────────────────────────────────────────────────────────────
// The URL of your deployed Noted app.
// In CI this is replaced by the APP_URL GitHub secret.
const APP_URL =
  process.env.APP_URL || "https://YOUR_PUBLISHED_APP_URL.replit.app";
// ─────────────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: "Noted",
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Load the published app
  win.loadURL(APP_URL);

  // Open external links (e.g. Clerk auth pages) in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Remove the default menu bar
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
