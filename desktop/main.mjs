import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
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
let QUICK_PROMPT_PASTE_SHORTCUT;
let STANDARD_PROMPT_PASTE_SHORTCUT;
let DETAILED_PROMPT_PASTE_SHORTCUT;
let SELECTED_TRANSLATE_SHORTCUT;
let SELECTED_QUICK_PROMPT_SHORTCUT;
let SELECTED_STANDARD_PROMPT_SHORTCUT;
let SELECTED_DETAILED_PROMPT_SHORTCUT;
const ENV_TEMPLATE = `# PromptDe desktop configuration\n# Restart PromptDe after changing this file.\n\nGROQ_API_KEY=\nGEMINI_API_KEY=\n\n# Optional shortcut overrides\n# PROMPTDE_TRANSLATE_PASTE_SHORTCUT=CommandOrControl+F9\n# PROMPTDE_QUICK_PROMPT_PASTE_SHORTCUT=Shift+F1\n# PROMPTDE_STANDARD_PROMPT_PASTE_SHORTCUT=Shift+F2\n# PROMPTDE_DETAILED_PROMPT_PASTE_SHORTCUT=Shift+F3\n# PROMPTDE_SELECTED_TRANSLATE_SHORTCUT=CommandOrControl+Shift+F5\n# PROMPTDE_SELECTED_QUICK_PROMPT_SHORTCUT=CommandOrControl+Shift+F6\n# PROMPTDE_SELECTED_STANDARD_PROMPT_SHORTCUT=CommandOrControl+Shift+F7\n# PROMPTDE_SELECTED_DETAILED_PROMPT_SHORTCUT=CommandOrControl+Shift+F8\n`;

let mainWindow;
let tray;
let localServer;
let isQuitting = false;
let selectedRewriteBusy = false;
let activeNotification;
let notificationTimer;
let startupLogPath;
let startupFailureShown = false;

function errorMessage(error) {
  return error instanceof Error ? `${error.message}\n${error.stack || ""}`.trim() : String(error);
}

function logStartup(message, error) {
  const detail = error === undefined ? message : `${message}: ${errorMessage(error)}`;
  console.error(detail);
  if (!startupLogPath) return;
  try {
    appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${detail}\n`, "utf8");
  } catch {
    // Logging must never turn a recoverable startup problem into a crash.
  }
}

function reportStartupFailure(message, error) {
  logStartup(message, error);
  if (startupFailureShown || isQuitting) return;
  startupFailureShown = true;
  const logHint = startupLogPath ? `\n\nDiagnostic log:\n${startupLogPath}` : "";
  dialog.showErrorBox("PromptDe could not start", `${message}\n\n${errorMessage(error)}${logHint}`);
}

function loadShortcutConfig() {
  SHORTCUT = process.env.PROMPTDE_SHORTCUT || process.env.BOLPROMPT_SHORTCUT || "CommandOrControl+Shift+Space";
  CLEAR_SHORTCUT = process.env.PROMPTDE_CLEAR_SHORTCUT || "CommandOrControl+Shift+Backspace";
  CONTEXT_SHORTCUT = process.env.PROMPTDE_CONTEXT_SHORTCUT || "CommandOrControl+Alt+C";
  COPY_TRANSLATION_SHORTCUT = process.env.PROMPTDE_COPY_TRANSLATION_SHORTCUT || "CommandOrControl+Alt+E";
  COPY_PROMPT_SHORTCUT = process.env.PROMPTDE_COPY_PROMPT_SHORTCUT || "CommandOrControl+Alt+P";
  TRANSLATE_PASTE_SHORTCUT = process.env.PROMPTDE_TRANSLATE_PASTE_SHORTCUT || "CommandOrControl+F9";
  QUICK_PROMPT_PASTE_SHORTCUT = process.env.PROMPTDE_QUICK_PROMPT_PASTE_SHORTCUT || "Shift+F1";
  STANDARD_PROMPT_PASTE_SHORTCUT = process.env.PROMPTDE_STANDARD_PROMPT_PASTE_SHORTCUT || "Shift+F2";
  DETAILED_PROMPT_PASTE_SHORTCUT = process.env.PROMPTDE_DETAILED_PROMPT_PASTE_SHORTCUT || "Shift+F3";
  SELECTED_TRANSLATE_SHORTCUT = process.env.PROMPTDE_SELECTED_TRANSLATE_SHORTCUT || "CommandOrControl+Shift+F5";
  SELECTED_QUICK_PROMPT_SHORTCUT = process.env.PROMPTDE_SELECTED_QUICK_PROMPT_SHORTCUT || "CommandOrControl+Shift+F6";
  SELECTED_STANDARD_PROMPT_SHORTCUT = process.env.PROMPTDE_SELECTED_STANDARD_PROMPT_SHORTCUT || "CommandOrControl+Shift+F7";
  SELECTED_DETAILED_PROMPT_SHORTCUT = process.env.PROMPTDE_SELECTED_DETAILED_PROMPT_SHORTCUT || "CommandOrControl+Shift+F8";
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
  if (!Notification.isSupported()) return;

  // Keep progress messages useful without letting Linux docks accumulate an
  // unread counter for every stage of a shortcut workflow.
  clearTimeout(notificationTimer);
  const previousNotification = activeNotification;
  activeNotification = undefined;
  previousNotification?.close();
  app.setBadgeCount(0);
  const notification = new Notification({ title: "PromptDe", body, silent: true });
  activeNotification = notification;
  notification.on("close", () => {
    if (activeNotification === notification) activeNotification = undefined;
    app.setBadgeCount(0);
  });
  notification.show();
  notificationTimer = setTimeout(() => notification.close(), 6000);
}

function clipboardSnapshot() {
  return clipboard.availableFormats().map((format) => [format, clipboard.readBuffer(format)]);
}

function restoreClipboard(snapshot) {
  clipboard.clear();
  for (const [format, contents] of snapshot) clipboard.writeBuffer(format, contents);
}

async function linuxTerminalClipboardShortcut() {
  try {
    const windowId = (await runCommand("xdotool", ["getactivewindow"])).trim();
    const windowClass = await runCommand("xprop", ["-id", windowId, "WM_CLASS"]);
    return /terminal|kitty|alacritty|konsole|xterm|tilix|terminator|wezterm|ptyxis|urxvt/iu.test(windowClass);
  } catch {
    return false;
  }
}

async function sendLinuxClipboardShortcut(key) {
  const needsShift = await linuxTerminalClipboardShortcut();
  try {
    // A global shortcut can leave Electron/X11 seeing Ctrl or Shift as held.
    // Release every common modifier first, then explicitly hold only the keys
    // needed for copy/paste. This prevents the replacement from becoming a
    // plain "c" or "v" when the original shortcut included Fn and Shift.
    await runCommand("xdotool", [
      "keyup",
      "Control_L",
      "Control_R",
      "Shift_L",
      "Shift_R",
      "Alt_L",
      "Alt_R",
      "Super_L",
      "Super_R",
    ]);
    await runCommand("xdotool", ["keydown", "Control_L"]);
    if (needsShift) await runCommand("xdotool", ["keydown", "Shift_L"]);
    try {
      await runCommand("xdotool", ["key", key]);
    } finally {
      if (needsShift) await runCommand("xdotool", ["keyup", "Shift_L"]).catch(() => {});
      await runCommand("xdotool", ["keyup", "Control_L"]).catch(() => {});
    }
  } catch {
    const modifiers = needsShift ? ["-M", "ctrl", "-s", "40", "-M", "shift"] : ["-M", "ctrl"];
    const releasedModifiers = needsShift ? ["-m", "shift", "-s", "40", "-m", "ctrl"] : ["-m", "ctrl"];
    await runCommand("wtype", [...modifiers, "-s", "40", "-k", key, "-s", "40", ...releasedModifiers]);
  }
}

async function copyCurrentSelection() {
  const previousClipboard = clipboardSnapshot();
  const marker = `promptde-no-selection-${Date.now()}-${Math.random()}`;
  clipboard.writeText(marker);

  try {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 220));
    if (process.platform === "win32") {
      await runCommand("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')",
      ]);
    } else if (process.platform === "darwin") {
      await runCommand("osascript", [
        "-e",
        "tell application \"System Events\" to keystroke \"c\" using command down",
      ]);
    } else {
      await sendLinuxClipboardShortcut("c");
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
    const selectedText = clipboard.readText();
    if (!selectedText.trim() || selectedText === marker) {
      restoreClipboard(previousClipboard);
      throw new Error("Select some text before using this shortcut.");
    }
    return selectedText;
  } catch (error) {
    if (clipboard.readText() === marker) restoreClipboard(previousClipboard);
    throw error;
  }
}

async function rewriteCurrentSelection(mode) {
  if (selectedRewriteBusy) {
    notifyDesktop("PromptDe is already rewriting selected text.");
    return;
  }
  selectedRewriteBusy = true;
  try {
    const text = await copyCurrentSelection();
    notifyDesktop(mode === "translate" ? "Translating selected text…" : `Creating a ${mode} prompt…`);
    mainWindow?.webContents.send("promptde:rewrite-selection", { mode, text });
  } catch (error) {
    selectedRewriteBusy = false;
    notifyDesktop(error.message || "Could not read the selected text.");
  }
}

async function pasteClipboardText(rawText) {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text || text.length > 100_000) throw new Error("The text to paste is not valid.");
  clipboard.writeText(text);

  // Keep PromptDe represented in the taskbar when a voice prompt,
  // translation, or selected-text rewrite is pasted. If PromptDe currently
  // owns focus, minimizing transfers focus for the paste without turning the
  // application into a tray-only process.
  if (mainWindow?.isFocused()) mainWindow.minimize();

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
      await sendLinuxClipboardShortcut("v");
    }
    return { pasted: true };
  } catch {
    return {
      pasted: false,
      message: "Text copied, but automatic paste is unavailable. Press Ctrl/Cmd+V to paste it.",
    };
  }
}

function appIconPath() {
  const unpackedIcon = join(process.resourcesPath, "icon.png");
  return existsSync(unpackedIcon) ? unpackedIcon : join(__dirname, "../assets/icon.png");
}

function ensureDesktopEnv() {
  const configDir = app.getPath("userData");
  const envPath = join(configDir, ".env");
  const legacyEnvPath = join(app.getPath("appData"), "BolPrompt", ".env");
  mkdirSync(configDir, { recursive: true });
  if (!existsSync(envPath) && existsSync(legacyEnvPath)) copyFileSync(legacyEnvPath, envPath);
  if (!existsSync(envPath)) writeFileSync(envPath, ENV_TEMPLATE, { mode: 0o600 });
  loadEnvFiles([envPath]);
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
  clearTimeout(notificationTimer);
  activeNotification?.close();
  app.setBadgeCount(0);
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

async function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    show: false,
    skipTaskbar: false,
    backgroundColor: "#080b12",
    title: "PromptDe",
    icon: appIconPath(),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    reportStartupFailure(`The PromptDe interface failed to load (${failedUrl}).`, `${description} (${code})`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    reportStartupFailure("The PromptDe interface process stopped unexpectedly.", details.reason);
  });
  mainWindow.on("unresponsive", () => {
    logStartup("The PromptDe window became unresponsive.");
  });
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
  await mainWindow.loadURL(url);
}

function createTray() {
  tray = new Tray(appIconPath());
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
    startupLogPath = join(configDir, "startup.log");
    logStartup(`Starting PromptDe ${app.getVersion()} on ${process.platform} ${process.arch}.`);
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
      quickPromptPasteShortcut: QUICK_PROMPT_PASTE_SHORTCUT,
      standardPromptPasteShortcut: STANDARD_PROMPT_PASTE_SHORTCUT,
      detailedPromptPasteShortcut: DETAILED_PROMPT_PASTE_SHORTCUT,
      selectedTranslateShortcut: SELECTED_TRANSLATE_SHORTCUT,
      selectedQuickPromptShortcut: SELECTED_QUICK_PROMPT_SHORTCUT,
      selectedStandardPromptShortcut: SELECTED_STANDARD_PROMPT_SHORTCUT,
      selectedDetailedPromptShortcut: SELECTED_DETAILED_PROMPT_SHORTCUT,
      configDir,
      envPath,
    }));
    ipcMain.handle("promptde:open-config-folder", () => shell.openPath(configDir));
    ipcMain.handle("promptde:save-api-keys", (_event, keys) => saveDesktopApiKeys(envPath, keys));
    ipcMain.handle("promptde:paste-text", (_event, text) => pasteClipboardText(text));
    ipcMain.on("promptde:selection-rewrite-finished", () => { selectedRewriteBusy = false; });
    ipcMain.on("promptde:notify", (_event, message) => notifyDesktop(String(message).slice(0, 300)));
    ipcMain.on("promptde:show", showWindow);

    Menu.setApplicationMenu(null);
    await createWindow(started.url);
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
    for (const [shortcut, mode] of [
      [QUICK_PROMPT_PASTE_SHORTCUT, "quick"],
      [STANDARD_PROMPT_PASTE_SHORTCUT, "standard"],
      [DETAILED_PROMPT_PASTE_SHORTCUT, "detailed"],
    ]) {
      if (!globalShortcut.register(shortcut, () => {
        mainWindow?.webContents.send("promptde:prompt-paste", mode);
      })) {
        console.error(`Could not register ${mode} prompt-and-paste shortcut: ${shortcut}`);
      }
    }
    for (const [shortcut, mode] of [
      [SELECTED_TRANSLATE_SHORTCUT, "translate"],
      [SELECTED_QUICK_PROMPT_SHORTCUT, "quick"],
      [SELECTED_STANDARD_PROMPT_SHORTCUT, "standard"],
      [SELECTED_DETAILED_PROMPT_SHORTCUT, "detailed"],
    ]) {
      if (!globalShortcut.register(shortcut, () => rewriteCurrentSelection(mode))) {
        console.error(`Could not register selected-text ${mode} shortcut: ${shortcut}`);
      }
    }
  }).catch((error) => {
    reportStartupFailure("The desktop application could not finish starting.", error);
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
