// 뽀식이 데스크톱 펫 - main process.
// One transparent, click-through, always-on-top window covers the work area
// (the screen minus the taskbar) of one monitor; the dog lives inside it.
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, dialog } = require("electron")
const path = require("path")
const fs = require("fs")

const smokeArg = process.argv.find((a) => a.startsWith("--smoke-test="))
const SMOKE_DIR = smokeArg ? path.resolve(smokeArg.split("=")[1]) : null

if (!SMOKE_DIR && !app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.setAppUserModelId("com.ppo.desktoppet")

const ASSETS = path.join(__dirname, "assets")
const DEFAULTS = { name: "", photo: null, size: "medium", sound: false, displayId: null, hidden: false, welcomed: false }

let settings = { ...DEFAULTS }
let petWin = null
let settingsWin = null
let tray = null

const settingsFile = () => path.join(app.getPath("userData"), "settings.json")

function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) }
  } catch {
    settings = { ...DEFAULTS }
  }
  if (settings.photo && !fs.existsSync(settings.photo)) settings.photo = null
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
  } catch (e) {
    console.error("settings save failed", e)
  }
}

function dogName() {
  return settings.name.trim() || (settings.photo ? "멍멍이" : "뽀식이")
}

function photoDataUrl() {
  const file = settings.photo || path.join(ASSETS, "ppo.png")
  try {
    const ext = path.extname(file).toLowerCase() === ".png" ? "png" : "jpeg"
    return `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`
  } catch {
    return null
  }
}

function publicSettings() {
  return {
    name: dogName(),
    rawName: settings.name,
    customPhoto: Boolean(settings.photo),
    photo: photoDataUrl(),
    size: settings.size,
    sound: settings.sound,
    autoStart: getAutoStart(),
    displays: screen.getAllDisplays().length,
  }
}

function broadcast() {
  const data = publicSettings()
  for (const w of [petWin, settingsWin]) if (w && !w.isDestroyed()) w.webContents.send("settings", data)
  buildTrayMenu()
}

function update(patch) {
  settings = { ...settings, ...patch }
  saveSettings()
  broadcast()
}

// ---------- auto start ----------
function getAutoStart() {
  if (process.platform !== "win32" && process.platform !== "darwin") return false
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch {
    return false
  }
}

function setAutoStart(on) {
  if (process.platform !== "win32" && process.platform !== "darwin") return
  app.setLoginItemSettings({ openAtLogin: on, path: process.execPath })
  broadcast()
}

// ---------- pet window ----------
function targetDisplay() {
  const all = screen.getAllDisplays()
  return all.find((d) => d.id === settings.displayId) || screen.getPrimaryDisplay()
}

function fitToDisplay() {
  if (!petWin || petWin.isDestroyed()) return
  const area = targetDisplay().workArea
  petWin.setBounds(area)
}

function createPetWindow() {
  const area = targetDisplay().workArea
  petWin = new BrowserWindow({
    ...area,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Clicking the dog shouldn't steal keyboard focus from whatever the user is typing in.
    focusable: process.platform !== "win32",
    show: false,
    backgroundColor: "#00000000",
    title: "뽀식이",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  })
  petWin.setAlwaysOnTop(true, "screen-saver")
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })
  petWin.setIgnoreMouseEvents(true, { forward: true })
  petWin.loadFile(path.join(__dirname, "pet.html"))
  petWin.once("ready-to-show", () => {
    if (!settings.hidden || SMOKE_DIR) petWin.showInactive()
  })
  petWin.on("closed", () => (petWin = null))

  // Other topmost windows (the taskbar, video players) can push us down; climb back up now and then.
  setInterval(() => {
    if (petWin && !petWin.isDestroyed() && petWin.isVisible()) petWin.setAlwaysOnTop(true, "screen-saver")
  }, 4000)
}

function sendCommand(type, extra = {}) {
  if (!petWin || petWin.isDestroyed()) return
  if (!petWin.isVisible()) {
    petWin.showInactive()
    update({ hidden: false })
  }
  petWin.webContents.send("command", { type, ...extra })
}

// ---------- settings window ----------
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show()
    settingsWin.focus()
    return
  }
  settingsWin = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: `${dogName()} 설정`,
    icon: path.join(ASSETS, "tray@2x.png"),
    autoHideMenuBar: true,
    backgroundColor: "#fff8ef",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  })
  settingsWin.setMenu(null)
  settingsWin.loadFile(path.join(__dirname, "settings.html"))
  settingsWin.on("closed", () => (settingsWin = null))
}

async function choosePhoto() {
  const parent = settingsWin && !settingsWin.isDestroyed() ? settingsWin : undefined
  const result = await dialog.showOpenDialog(parent, {
    title: "강아지 사진 고르기",
    properties: ["openFile"],
    filters: [{ name: "사진", extensions: ["png", "jpg", "jpeg"] }],
  })
  if (result.canceled || !result.filePaths[0]) return false
  const img = nativeImage.createFromPath(result.filePaths[0])
  if (img.isEmpty()) {
    dialog.showMessageBox(parent, { type: "warning", message: "이 사진은 열 수 없어요. JPG나 PNG 사진을 골라 주세요." })
    return false
  }
  const { width, height } = img.getSize()
  const scaled = Math.max(width, height) > 600 ? img.resize(width >= height ? { width: 600 } : { height: 600 }) : img
  const dest = path.join(app.getPath("userData"), `photo-${Date.now()}.png`)
  fs.writeFileSync(dest, scaled.toPNG())
  const old = settings.photo
  update({ photo: dest })
  if (old && old !== dest) fs.rm(old, () => {})
  return true
}

function resetPhoto() {
  const old = settings.photo
  update({ photo: null })
  if (old) fs.rm(old, () => {})
}

// ---------- tray ----------
function buildTrayMenu() {
  if (!tray) return
  const name = dogName()
  const visible = petWin && !petWin.isDestroyed() && petWin.isVisible()
  const displays = screen.getAllDisplays()
  const sizes = [
    ["small", "작게"],
    ["medium", "보통"],
    ["large", "크게"],
  ]
  const template = [
    { label: `🐶 ${name} 부르기`, click: () => sendCommand("come") },
    { label: "🦴 간식 주기", click: () => sendCommand("treat") },
    { label: "🎾 공 던져 주기", click: () => sendCommand("ball") },
    { label: "💤 재우기", click: () => sendCommand("sleep") },
    { type: "separator" },
    {
      label: "🔊 소리 (말하기)",
      type: "checkbox",
      checked: settings.sound,
      click: (item) => update({ sound: item.checked }),
    },
    {
      label: "📏 크기",
      submenu: sizes.map(([value, label]) => ({
        label,
        type: "radio",
        checked: settings.size === value,
        click: () => update({ size: value }),
      })),
    },
  ]
  if (displays.length > 1) {
    template.push({
      label: "🖥️ 다른 모니터로 보내기",
      click: () => {
        const idx = displays.findIndex((d) => d.id === targetDisplay().id)
        update({ displayId: displays[(idx + 1) % displays.length].id })
        fitToDisplay()
      },
    })
  }
  if (process.platform === "win32" || process.platform === "darwin") {
    template.push({
      label: "🚀 컴퓨터 켜면 자동으로 나오기",
      type: "checkbox",
      checked: getAutoStart(),
      click: (item) => setAutoStart(item.checked),
    })
  }
  template.push(
    { label: "⚙️ 설정 (이름·사진 바꾸기)", click: openSettings },
    {
      label: visible ? `🙈 ${name} 잠깐 숨기기` : `👀 ${name} 다시 보이기`,
      click: () => {
        if (!petWin || petWin.isDestroyed()) return
        if (petWin.isVisible()) petWin.hide()
        else petWin.showInactive()
        update({ hidden: !petWin.isVisible() })
      },
    },
    { type: "separator" },
    { label: "종료", click: () => app.quit() },
  )
  tray.setContextMenu(Menu.buildFromTemplate(template))
  tray.setToolTip(`${name} (클릭하면 메뉴)`)
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(ASSETS, "tray.png"))
  const icon2x = nativeImage.createFromPath(path.join(ASSETS, "tray@2x.png"))
  if (!icon2x.isEmpty()) icon.addRepresentation({ scaleFactor: 2, buffer: icon2x.toPNG() })
  tray = new Tray(icon)
  tray.on("click", () => tray.popUpContextMenu())
  buildTrayMenu()
}

// ---------- IPC ----------
ipcMain.handle("get-settings", () => publicSettings())
ipcMain.on("set-ignore", (e, ignore) => {
  const w = BrowserWindow.fromWebContents(e.sender)
  if (w && !w.isDestroyed()) w.setIgnoreMouseEvents(ignore, { forward: true })
})
ipcMain.handle("get-cursor", () => {
  const p = screen.getCursorScreenPoint()
  const b = petWin && !petWin.isDestroyed() ? petWin.getBounds() : { x: 0, y: 0 }
  return { x: p.x - b.x, y: p.y - b.y }
})
ipcMain.handle("update-settings", (_e, patch) => {
  const allowed = {}
  if (typeof patch.name === "string") allowed.name = patch.name.slice(0, 20)
  if (["small", "medium", "large"].includes(patch.size)) allowed.size = patch.size
  if (typeof patch.sound === "boolean") allowed.sound = patch.sound
  update(allowed)
  if (typeof patch.autoStart === "boolean") setAutoStart(patch.autoStart)
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.setTitle(`${dogName()} 설정`)
  return publicSettings()
})
ipcMain.handle("choose-photo", () => choosePhoto())
ipcMain.handle("reset-photo", () => resetPhoto())
ipcMain.on("pet-command", (_e, type) => sendCommand(type))

// ---------- smoke test (Linux CI / dev only) ----------
async function runSmokeTest() {
  fs.mkdirSync(SMOKE_DIR, { recursive: true })
  const shots = [
    [2500, "1-start", null],
    [3500, "2-treat", "treat"],
    [6000, "3-eating", null],
    [7000, "4-sleep", "sleep"],
    [9500, "5-sleeping", null],
    [10500, "6-come", "come"],
  ]
  const t0 = Date.now()
  for (const [at, label, cmd] of shots) {
    await new Promise((r) => setTimeout(r, Math.max(0, at - (Date.now() - t0))))
    if (cmd) sendCommand(cmd)
    await new Promise((r) => setTimeout(r, 600))
    const img = await petWin.webContents.capturePage()
    fs.writeFileSync(path.join(SMOKE_DIR, `${label}.png`), img.toPNG())
    const state = await petWin.webContents.executeJavaScript("window.__petState && window.__petState()")
    fs.appendFileSync(path.join(SMOKE_DIR, "log.txt"), `${label}: ${JSON.stringify(state)}\n`)
  }
  app.quit()
}

// ---------- lifecycle ----------
app.on("second-instance", () => sendCommand("come"))

app.whenReady().then(() => {
  loadSettings()
  createPetWindow()
  createTray()
  screen.on("display-metrics-changed", fitToDisplay)
  screen.on("display-added", () => {
    fitToDisplay()
    buildTrayMenu()
  })
  screen.on("display-removed", () => {
    fitToDisplay()
    buildTrayMenu()
  })
  if (!settings.welcomed && !SMOKE_DIR) {
    if (process.platform === "win32") {
      tray.displayBalloon({
        title: "뽀식이가 나왔어요!",
        content: "여기 작은 강아지 아이콘을 누르면 간식 주기, 재우기, 설정, 종료 메뉴가 있어요.",
        iconType: "info",
      })
    }
    update({ welcomed: true })
  }
  if (SMOKE_DIR) petWin.webContents.once("did-finish-load", runSmokeTest)
})

app.on("window-all-closed", (e) => e.preventDefault())
