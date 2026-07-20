const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("promptDeDesktop", {
  getInfo: () => ipcRenderer.invoke("promptde:get-desktop-info"),
  openConfigFolder: () => ipcRenderer.invoke("promptde:open-config-folder"),
  saveApiKeys: (keys) => ipcRenderer.invoke("promptde:save-api-keys", keys),
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
});
