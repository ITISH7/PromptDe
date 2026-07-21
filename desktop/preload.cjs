const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("promptDeDesktop", {
  getInfo: () => ipcRenderer.invoke("promptde:get-desktop-info"),
  openConfigFolder: () => ipcRenderer.invoke("promptde:open-config-folder"),
  saveApiKeys: (keys) => ipcRenderer.invoke("promptde:save-api-keys", keys),
  pasteText: (text) => ipcRenderer.invoke("promptde:paste-text", text),
  notify: (message) => ipcRenderer.send("promptde:notify", message),
  show: () => ipcRenderer.send("promptde:show"),
  onActivate: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("promptde:activate", handler);
    return () => ipcRenderer.removeListener("promptde:activate", handler);
  },
  onClearTranscript: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("promptde:clear-transcript", handler);
    return () => ipcRenderer.removeListener("promptde:clear-transcript", handler);
  },
  onRecordContext: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("promptde:record-context", handler);
    return () => ipcRenderer.removeListener("promptde:record-context", handler);
  },
  onCopyTranslation: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("promptde:copy-translation", handler);
    return () => ipcRenderer.removeListener("promptde:copy-translation", handler);
  },
  onCopyPrompt: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("promptde:copy-prompt", handler);
    return () => ipcRenderer.removeListener("promptde:copy-prompt", handler);
  },
  onTranslatePaste: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("promptde:translate-paste", handler);
    return () => ipcRenderer.removeListener("promptde:translate-paste", handler);
  },
  onPromptPaste: (callback) => {
    const handler = (_event, mode) => callback(mode);
    ipcRenderer.on("promptde:prompt-paste", handler);
    return () => ipcRenderer.removeListener("promptde:prompt-paste", handler);
  },
});
