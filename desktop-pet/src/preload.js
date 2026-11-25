const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("pet", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (patch) => ipcRenderer.invoke("update-settings", patch),
  choosePhoto: () => ipcRenderer.invoke("choose-photo"),
  resetPhoto: () => ipcRenderer.invoke("reset-photo"),
  getCursor: () => ipcRenderer.invoke("get-cursor"),
  setIgnore: (ignore) => ipcRenderer.send("set-ignore", ignore),
  command: (type) => ipcRenderer.send("pet-command", type),
  onSettings: (fn) => ipcRenderer.on("settings", (_e, data) => fn(data)),
  onCommand: (fn) => ipcRenderer.on("command", (_e, data) => fn(data)),
})
