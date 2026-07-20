import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  session,
  shell,
  Tray,
} from "electron";
import { loadEnvFiles, startServer } from "../server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHORTCUT = process.env.PROMPTDE_SHORTCUT || process.env.BOLPROMPT_SHORTCUT || "CommandOrControl+Shift+Space";
const CLEAR_SHORTCUT = process.env.PROMPTDE_CLEAR_SHORTCUT || "CommandOrControl+Shift+Backspace";
const CONTEXT_SHORTCUT = process.env.PROMPTDE_CONTEXT_SHORTCUT || "CommandOrControl+Alt+C";
const COPY_TRANSLATION_SHORTCUT = process.env.PROMPTDE_COPY_TRANSLATION_SHORTCUT || "CommandOrControl+Alt+E";
const COPY_PROMPT_SHORTCUT = process.env.PROMPTDE_COPY_PROMPT_SHORTCUT || "CommandOrControl+Alt+P";
const ENV_TEMPLATE = `# PromptDe desktop configuration\n# Restart PromptDe after changing this file.\n\nGROQ_API_KEY=\nGEMINI_API_KEY=\n`;

let mainWindow;
let tray;
let localServer;
let isQuitting = false;

function createTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#111722"/><circle cx="32" cy="32" r="22" fill="#ff6a3d"/><path d="M22 34v-4m7 10V24m7 12v-8m7 6v-4" stroke="white" stroke-width="4" stroke-linecap="round"/></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

function ensureDesktopEnv() {
  const configDir = app.getPath("userData");
  const envPath = join(configDir, ".env");
  const legacyEnvPath = join(app.getPath("appData"), "BolPrompt", ".env");
  mkdirSync(configDir, { recursive: true });
  if (!existsSync(envPath) && existsSync(legacyEnvPath)) copyFileSync(legacyEnvPath, envPath);
  if (!existsSync(envPath)) writeFileSync(envPath, ENV_TEMPLATE, { mode: 0o600 });
  loadEnvFiles([join(process.cwd(), ".env"), envPath]);
  return { configDir, envPath };
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showAndActivate() {
  if (!mainWindow) return;
  showWindow();
  mainWindow.webContents.send("promptde:activate");
}

function showAndSend(channel) {
  showWindow();
  mainWindow?.webContents.send(channel);
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    show: false,
    backgroundColor: "#080b12",
    title: "PromptDe",
    icon: createTrayIcon(),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(url);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/u.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(url)) event.preventDefault();
  });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(`PromptDe — ${SHORTCUT}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Record a prompt", accelerator: SHORTCUT, click: showAndActivate },
    { label: "Show PromptDe", click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("double-click", showAndActivate);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

if (process.platform === "linux") {
  app.commandLine.appendSwitch("enable-features", "GlobalShortcutsPortal");
}

app.on("second-instance", showAndActivate);
app.whenReady().then(async () => {
  const { configDir, envPath } = ensureDesktopEnv();
  const started = await startServer({ port: 0 });
  localServer = started.server;

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isLocal = details.requestingUrl.startsWith(started.url);
    callback(permission === "media" && isLocal);
  });

  ipcMain.handle("promptde:get-desktop-info", () => ({
    shortcut: SHORTCUT,
    clearShortcut: CLEAR_SHORTCUT,
    contextShortcut: CONTEXT_SHORTCUT,
    copyTranslationShortcut: COPY_TRANSLATION_SHORTCUT,
    copyPromptShortcut: COPY_PROMPT_SHORTCUT,
    configDir,
    envPath,
  }));
  ipcMain.handle("promptde:open-config-folder", () => shell.openPath(configDir));

  Menu.setApplicationMenu(null);
  createWindow(started.url);
  createTray();
  if (!globalShortcut.register(SHORTCUT, showAndActivate)) {
    console.error(`Could not register global shortcut: ${SHORTCUT}`);
  }
  if (!globalShortcut.register(CLEAR_SHORTCUT, () => showAndSend("promptde:clear-transcript"))) {
    console.error(`Could not register clear-transcript shortcut: ${CLEAR_SHORTCUT}`);
  }
  if (!globalShortcut.register(CONTEXT_SHORTCUT, () => showAndSend("promptde:record-context"))) {
    console.error(`Could not register project-context shortcut: ${CONTEXT_SHORTCUT}`);
  }
  if (!globalShortcut.register(COPY_TRANSLATION_SHORTCUT, () => showAndSend("promptde:copy-translation"))) {
    console.error(`Could not register copy-translation shortcut: ${COPY_TRANSLATION_SHORTCUT}`);
  }
  if (!globalShortcut.register(COPY_PROMPT_SHORTCUT, () => showAndSend("promptde:copy-prompt"))) {
    console.error(`Could not register copy-prompt shortcut: ${COPY_PROMPT_SHORTCUT}`);
  }
}).catch((error) => {
  console.error(error);
  app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  localServer?.close();
});

app.on("window-all-closed", () => {
  // Keep the tray process active on Windows and Linux for the global shortcut.
});
