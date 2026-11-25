const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("pet", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (patch) => ipcRenderer.invoke("update-settings", patch),
  choosePhoto: () => ipcRenderer.invoke("choose-photo"),
  resetPhoto: () => ipcRenderer.invoke("reset-photo"),
  getCursor: () => ipcRenderer.invoke("get-cursor"),
  carryToCursor: () => ipcRenderer.invoke("carry-to-cursor"),
  setIgnore: (ignore) => ipcRenderer.send("set-ignore", ignore),
  command: (type) => ipcRenderer.send("pet-command", type),
  onSettings: (fn) => ipcRenderer.on("settings", (_e, data) => fn(data)),
  onCommand: (fn) => ipcRenderer.on("command", (_e, data) => fn(data)),
  onIdle: (fn) => ipcRenderer.on("idle", (_e, seconds) => fn(seconds)),
  // conversation: chat window -> main -> pet window, and the dog's reply back
  sendChat: (text) => ipcRenderer.send("chat-send", text),
  onChat: (fn) => ipcRenderer.on("chat", (_e, text) => fn(text)),
  chatReply: (text) => ipcRenderer.send("chat-reply", text),
  onChatReply: (fn) => ipcRenderer.on("chat-reply", (_e, text) => fn(text)),
})
