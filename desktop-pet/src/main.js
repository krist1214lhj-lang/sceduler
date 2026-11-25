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
const DEFAULTS = { name: "", ownerName: "", photo: null, size: "medium", sound: false, displayId: null, hidden: false, asleep: false, welcomed: false }

let settings = { ...DEFAULTS }
let petWin = null
let settingsWin = null
let chatWin = null
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
    ownerName: settings.ownerName,
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
  for (const w of [petWin, settingsWin, chatWin]) if (w && !w.isDestroyed()) w.webContents.send("settings", data)
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

function showPet() {
  if (!petWin || petWin.isDestroyed()) return
  const wasAsleep = settings.asleep
  if (!petWin.isVisible()) petWin.showInactive()
  if (settings.hidden || settings.asleep) update({ hidden: false, asleep: false })
  if (wasAsleep) petWin.webContents.send("command", { type: "wake" })
}

function sendCommand(type, extra = {}) {
  if (!petWin || petWin.isDestroyed()) return
  if (type === "sleep" && !petWin.isVisible()) return
  if (type !== "sleep") showPet()
  if (type === "wake") return
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

// ---------- chat window ----------
function openChat() {
  if (chatWin && !chatWin.isDestroyed()) {
    chatWin.show()
    chatWin.focus()
    return
  }
  const area = targetDisplay().workArea
  const width = 340
  const height = 440
  chatWin = new BrowserWindow({
    width,
    height,
    x: area.x + area.width - width - 24,
    y: area.y + area.height - height - 24,
    resizable: true,
    minimizable: true,
    maximizable: false,
    alwaysOnTop: true,
    title: `${dogName()}랑 대화하기`,
    icon: path.join(ASSETS, "tray@2x.png"),
    autoHideMenuBar: true,
    backgroundColor: "#fff8ef",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  })
  chatWin.setMenu(null)
  chatWin.loadFile(path.join(__dirname, "chat.html"))
  chatWin.on("closed", () => (chatWin = null))
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
    ...(settings.asleep ? [{ label: `☀️ ${name} 깨우기`, click: () => sendCommand("wake") }] : []),
    { label: `💬 ${name}랑 대화하기`, click: openChat },
    { label: `🐶 ${name} 부르기`, click: () => sendCommand("come") },
    { label: "🦴 간식 주기", click: () => sendCommand("treat") },
    {
      label: "🎪 재주 부리기",
      submenu: [
        ["bang", "🔫 빵!"],
        ["shy", "🙈 얼굴 가리기"],
        ["highfive", "🖐️ 하이파이브"],
        ["beg", "🙏 애교 (주세요~)"],
        ["belly", "🐾 배 보이고 뒹굴"],
        ["yawn", "🥱 하품"],
      ].map(([t, label]) => ({ label, click: () => sendCommand(`trick:${t}`) })),
    },
    { label: "🎾 공 던져 주기", click: () => sendCommand("ball") },
    ...(settings.asleep ? [] : [{ label: "💤 재우기 (자고 나면 사라져요)", click: () => sendCommand("sleep") }]),
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
        if (petWin.isVisible()) {
          petWin.hide()
          update({ hidden: true })
        } else showPet()
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
  if (typeof patch.ownerName === "string") allowed.ownerName = patch.ownerName.slice(0, 10)
  update(allowed)
  if (typeof patch.autoStart === "boolean") setAutoStart(patch.autoStart)
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.setTitle(`${dogName()} 설정`)
  return publicSettings()
})
ipcMain.handle("choose-photo", () => choosePhoto())
ipcMain.handle("reset-photo", () => resetPhoto())
ipcMain.on("pet-command", (_e, type) => {
  if (type === "chat") openChat()
  else if (type === "hide-sleep") {
    if (petWin && !petWin.isDestroyed()) petWin.hide()
    update({ hidden: true, asleep: true })
  } else sendCommand(type)
})
ipcMain.on("chat-send", (_e, text) => {
  if (!petWin || petWin.isDestroyed()) return
  showPet()
  petWin.webContents.send("chat", String(text).slice(0, 200))
})
ipcMain.on("chat-reply", (_e, text) => {
  if (chatWin && !chatWin.isDestroyed()) chatWin.webContents.send("chat-reply", text)
})

// ---------- smoke test (Linux CI / dev only) ----------
async function runSmokeTest() {
  fs.mkdirSync(SMOKE_DIR, { recursive: true })
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const js = (code) => petWin.webContents.executeJavaScript(code)
  // [label, setup code (run in the pet window), ms to wait before the shot]
  const steps = [
    ["01-landed", "", 2500],
    ["02-walk", "doAction('walk', { targetX: 100 }); S.facing = -1", 400],
    ["03-run", "doAction('run', { targetX: 1100 })", 250],
    ["04-sit", "doAction('sit', { duration: 99999 })", 700],
    ["05-sleep", "doAction('sleep', { duration: 99999 })", 700],
    ["06-bow", "doAction('bow', { duration: 99999 })", 700],
    ["07-chat-paw", "window.dispatchChat('손')", 700],
    ["08-chat-love", "window.dispatchChat('사랑해')", 500],
    ["09-chat-name", "window.dispatchChat('내 이름은 민지야')", 500],
    ["10-chat-treat", "window.dispatchChat('간식 줄까?')", 2500],
    ["11-drag", "doAction('drag'); S.y = 200", 400],
    ["12-bang", "window.dispatchChat('빵!')", 900],
    ["13-shy", "window.dispatchChat('얼굴!')", 700],
    ["14-highfive", "window.dispatchChat('하이파이브')", 700],
    ["15-beg", "doAction('beg', { duration: 99999 })", 700],
    ["16-belly", "window.dispatchChat('배 쓰담쓰담')", 700],
    ["17-yawn", "window.dispatchChat('하품')", 700],
  ]
  for (const [label, code, ms] of steps) {
    if (code) await js(code)
    await wait(ms)
    const img = await petWin.webContents.capturePage()
    fs.writeFileSync(path.join(SMOKE_DIR, `${label}.png`), img.toPNG())
    const state = await js("window.__petState && window.__petState()")
    fs.appendFileSync(path.join(SMOKE_DIR, "log.txt"), `${label}: ${JSON.stringify(state)}\n`)
  }
  // Sleep mode: the dog dozes, fades and the window hides; waking brings it back.
  const note = (t) => fs.appendFileSync(path.join(SMOKE_DIR, "log.txt"), t + "\n")
  await js("doAction('idle')")
  sendCommand("sleep")
  await wait(1500)
  note(`sleep+1.5s: visible=${petWin.isVisible()} ${JSON.stringify(await js("window.__petState()"))}`)
  await wait(4500)
  note(`sleep+6s: visible=${petWin.isVisible()} asleep=${settings.asleep}`)
  sendCommand("wake")
  await wait(800)
  note(`wake: visible=${petWin.isVisible()} asleep=${settings.asleep} ${JSON.stringify(await js("window.__petState()"))}`)
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
