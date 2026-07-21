import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  shell,
  Tray,
} from "electron";
import { loadEnvFiles, startServer } from "../server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LINUX_DESKTOP_NAME = "promptde";
let SHORTCUT;
let CLEAR_SHORTCUT;
let CONTEXT_SHORTCUT;
let COPY_TRANSLATION_SHORTCUT;
let COPY_PROMPT_SHORTCUT;
let TRANSLATE_PASTE_SHORTCUT;
const ENV_TEMPLATE = `# PromptDe desktop configuration\n# Restart PromptDe after changing this file.\n\nGROQ_API_KEY=\nGEMINI_API_KEY=\n\n# Optional shortcut override\n# PROMPTDE_TRANSLATE_PASTE_SHORTCUT=CommandOrControl+Shift+Alt+T\n`;

let mainWindow;
let tray;
let localServer;
let isQuitting = false;

function loadShortcutConfig() {
  SHORTCUT = process.env.PROMPTDE_SHORTCUT || process.env.BOLPROMPT_SHORTCUT || "CommandOrControl+Shift+Space";
  CLEAR_SHORTCUT = process.env.PROMPTDE_CLEAR_SHORTCUT || "CommandOrControl+Shift+Backspace";
  CONTEXT_SHORTCUT = process.env.PROMPTDE_CONTEXT_SHORTCUT || "CommandOrControl+Alt+C";
  COPY_TRANSLATION_SHORTCUT = process.env.PROMPTDE_COPY_TRANSLATION_SHORTCUT || "CommandOrControl+Alt+E";
  COPY_PROMPT_SHORTCUT = process.env.PROMPTDE_COPY_PROMPT_SHORTCUT || "CommandOrControl+Alt+P";
  TRANSLATE_PASTE_SHORTCUT = process.env.PROMPTDE_TRANSLATE_PASTE_SHORTCUT || "CommandOrControl+Shift+Alt+T";
}

loadShortcutConfig();

function runCommand(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    execFile(command, args, { timeout: 5000, windowsHide: true }, (error, stdout) => {
      if (error) rejectRun(error);
      else resolveRun(stdout);
    });
  });
}

function notifyDesktop(body) {
  if (Notification.isSupported()) new Notification({ title: "PromptDe", body }).show();
}

async function pasteClipboardText(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text || text.length > 100_000) throw new Error("The translated text is not valid.");
  clipboard.writeText(text);
  mainWindow?.hide();

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
  try {
    if (process.platform === "win32") {
      await runCommand("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
      ]);
    } else if (process.platform === "darwin") {
      await runCommand("osascript", [
        "-e",
        "tell application \"System Events\" to keystroke \"v\" using command down",
      ]);
    } else {
      try {
        let pasteChord = "ctrl+v";
        try {
          const windowId = (await runCommand("xdotool", ["getactivewindow"])).trim();
          const windowClass = await runCommand("xprop", ["-id", windowId, "WM_CLASS"]);
          if (/terminal|kitty|alacritty|konsole|xterm|tilix|terminator|wezterm|ptyxis|urxvt/iu.test(windowClass)) {
            pasteChord = "ctrl+shift+v";
          }
        } catch {
          // Use the standard GUI paste chord when window classification is unavailable.
        }
        await runCommand("xdotool", ["key", "--clearmodifiers", pasteChord]);
      } catch {
        await runCommand("wtype", ["-M", "ctrl", "-k", "v", "-m", "ctrl"]);
      }
    }
    return { pasted: true };
  } catch {
    return {
      pasted: false,
      message: "Translation copied, but automatic paste is unavailable. Press Ctrl/Cmd+V to paste it.",
    };
  }
}

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

function saveDesktopApiKeys(envPath, input = {}) {
  const updates = [
    ["GROQ_API_KEY", input.groqKey],
    ["GEMINI_API_KEY", input.geminiKey],
  ].map(([name, rawValue]) => {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (value.length > 512 || /\s/u.test(value)) throw new Error(`${name} is not a valid API key.`);
    return [name, value];
  });

  let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : ENV_TEMPLATE;
  for (const [name, value] of updates) {
    if (!value) continue;
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, "mu");
    contents = pattern.test(contents) ? contents.replace(pattern, line) : `${contents.trimEnd()}\n${line}\n`;
    process.env[name] = value;
  }
  writeFileSync(envPath, contents, { mode: 0o600 });
  chmodSync(envPath, 0o600);
  return {
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  };
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  app.focus({ steal: true });
  mainWindow.focus();
  mainWindow.moveTop();
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
    {
      label: "Translate and paste",
      accelerator: TRANSLATE_PASTE_SHORTCUT,
      click: () => mainWindow?.webContents.send("promptde:translate-paste"),
    },
    { label: "Show PromptDe", click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("double-click", showAndActivate);
}

if (process.platform === "linux") {
  // Match promptde.desktop even when PromptDe is started from an IDE or terminal.
  // Chromium's explicit class switch prevents the parent application's startup
  // identity from being inherited by the native window on X11.
  app.commandLine.appendSwitch("class", LINUX_DESKTOP_NAME);
  app.setDesktopName(LINUX_DESKTOP_NAME);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  if (process.platform === "linux") {
    app.commandLine.appendSwitch("enable-features", "GlobalShortcutsPortal");
  }

  app.on("second-instance", showWindow);
  app.whenReady().then(async () => {
    const { configDir, envPath } = ensureDesktopEnv();
    loadShortcutConfig();
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
      translatePasteShortcut: TRANSLATE_PASTE_SHORTCUT,
      configDir,
      envPath,
    }));
    ipcMain.handle("promptde:open-config-folder", () => shell.openPath(configDir));
    ipcMain.handle("promptde:save-api-keys", (_event, keys) => saveDesktopApiKeys(envPath, keys));
    ipcMain.handle("promptde:paste-text", (_event, text) => pasteClipboardText(text));
    ipcMain.on("promptde:notify", (_event, message) => notifyDesktop(String(message).slice(0, 300)));
    ipcMain.on("promptde:show", showWindow);

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
    if (!globalShortcut.register(TRANSLATE_PASTE_SHORTCUT, () => {
      mainWindow?.webContents.send("promptde:translate-paste");
    })) {
      console.error(`Could not register translate-and-paste shortcut: ${TRANSLATE_PASTE_SHORTCUT}`);
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
}
