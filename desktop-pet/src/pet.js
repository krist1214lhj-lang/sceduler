// 뽀식이 데스크톱 펫 - the dog's brain. Ported from the web playground (app/dog-chat/play/page.tsx).
const petEl = document.getElementById("pet")
const bodyEl = document.getElementById("body")
const tiltEl = document.getElementById("tilt")
const imgEl = document.getElementById("img")
const bubbleEl = document.getElementById("bubble")
const fxEl = document.getElementById("fx")
const spriteEl = document.getElementById("sprite")

// Frames of the real 뽀식이, made from the user's photo (assets/ppo/*.png). All share one scale.
const SPRITES = {
  front: ["front"],
  walk: ["walk0", "walk1", "walk2", "walk3"],
  run: ["run0", "run1", "run2", "run3"],
  sit: ["sit"],
  sleep: ["sleep"],
  jump: ["jump"],
  bow: ["bow"],
  paw: ["paw"],
  eat: ["eat"],
}
const POSE = { walk: "walk", run: "run", fetch: "run", spin: "run", sit: "sit", sleep: "sleep", jump: "jump", bow: "bow", paw: "paw", eat: "eat" }
const FRAME_MS = { walk: 130, run: 85 }
const BASE_W = 222 // natural width of a walking frame = the dog's box width
const BASE_H = 244
const spriteSize = {}
for (const name of new Set(Object.values(SPRITES).flat())) {
  const im = new Image()
  im.onload = () => (spriteSize[name] = [im.naturalWidth, im.naturalHeight])
  im.src = `assets/ppo/${name}.png`
}

function drawSprite(now) {
  const pose = POSE[S.action] || "front"
  const frames = SPRITES[pose]
  const name = frames.length > 1 ? frames[Math.floor(now / FRAME_MS[pose]) % frames.length] : frames[0]
  if (spriteEl.dataset.n !== name) {
    spriteEl.dataset.n = name
    spriteEl.src = `assets/ppo/${name}.png`
  }
  const size = spriteSize[name]
  if (size) spriteEl.style.width = `${(size[0] * S.w) / BASE_W}px`
  // The side-view frames face right; the front photo has the name tag text, so it never mirrors.
  const flip = pose === "front" ? 1 : S.facing
  spriteEl.style.transform = `translateX(-50%) scaleX(${flip})`
}

const SIZES = { small: 110, medium: 150, large: 200 }
const GRAVITY = 2600

const LINES = {
  idle: (n) => ["왈!", "놀아줘~", "주인님 뭐 해?", `${n} 심심해~`, "나 여기 있어요!"],
  walk: () => ["킁킁… 무슨 냄새지?", "산책 좋아~", "어디 가볼까?", "총총총~"],
  run: () => ["우다다다!", "달려라~!"],
  jump: () => ["왈왈!", "신난다!", "점프!"],
  spin: () => ["빙글빙글~", "꼬리 잡기!"],
  wag: () => ["꼬리 살랑살랑~", "헤헤", "기분 좋아!"],
  sit: () => ["얌전히 앉았어요!", "착하지?", "주인님 구경 중~"],
  sleep: () => ["졸려… zzz", "잠깐 낮잠…", "새근새근…"],
  pet: (n) => ["헤헤 좋아!", "쓰담쓰담 더 해줘!", `${n} 기분 최고!`, "주인님 최고!"],
  hover: () => ["헤헤 간지러워~", "킁킁, 주인님 손이다!", "쓰담쓰담 해줄 거야?"],
  drag: () => ["으앗! 높다~", "날 어디로 데려가?", "내려줘~ 멍!"],
  land: () => ["휴~ 무사 착지!", "다시 해줘!", "멍! 착지 성공!"],
  wake: () => ["으응… 깼다!", "더 자고 싶은데…", "주인님이다!"],
  come: () => ["왔어요! 불렀어요?", "주인님~ 나 왔어!", "부르셨나요? 멍!"],
  bow: () => ["놀자 놀자!", "기지개~ 쭈욱!", "같이 놀아요!"],
  paw: () => ["손! 여기요~", "악수해요!"],
}

const RANDOM_ACTIONS = [
  ["walk", 30],
  ["idle", 16],
  ["wag", 11],
  ["sit", 11],
  ["jump", 8],
  ["run", 8],
  ["spin", 6],
  ["bow", 5],
  ["sleep", 3],
]

const DURATIONS = {
  idle: [3000, 6000],
  wag: [2000, 2600],
  sit: [4000, 7000],
  jump: [1400, 1400],
  spin: [1600, 1600],
  sleep: [15000, 25000],
  happy: [1600, 1600],
  eat: [2600, 2600],
  land: [450, 450],
  bow: [1800, 2600],
  paw: [2200, 2800],
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const between = ([a, b]) => a + Math.random() * (b - a)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function pickAction() {
  const total = RANDOM_ACTIONS.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [a, w] of RANDOM_ACTIONS) {
    r -= w
    if (r < 0) return a
  }
  return "idle"
}

// ---------- state ----------
const S = {
  name: "뽀식이",
  sound: false,
  w: 150,
  h: 180,
  W: window.innerWidth,
  H: window.innerHeight,
  x: -1,
  y: -1,
  vx: 0,
  vy: 0,
  action: "fall",
  until: 0,
  targetX: null,
  facing: 1,
  item: null,
  ignoring: true,
  hovering: false,
  drag: null,
  mouseX: -1,
  mouseY: -1,
  lastStretch: performance.now(),
  greeted: false,
  sprite: true,
  ownerName: "",
  lastFed: Date.now(),
}

window.__petState = () => ({
  action: S.action,
  x: Math.round(S.x),
  y: Math.round(S.y),
  w: S.w,
  h: Math.round(S.h),
  W: S.W,
  H: S.H,
  item: S.item && { kind: S.item.kind, x: Math.round(S.item.x), y: Math.round(S.item.y) },
  bubble: bubbleEl.classList.contains("show") ? bubbleEl.textContent : null,
})

const ground = () => S.H - S.h

function lineFor(key) {
  return pick(LINES[key](S.name))
}

// ---------- speech ----------
const EMOJI = /[\p{Extended_Pictographic}‍️]/gu
function speak(text) {
  if (!("speechSynthesis" in window)) return
  const clean = text.replace(EMOJI, "").replace(/~/g, "").replace(/z{2,}/gi, "").trim()
  if (!clean) return
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = "ko-KR"
  u.pitch = 1.5
  u.rate = 1.05
  const korean = synth.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith("ko"))
  if (korean) u.voice = korean
  synth.cancel()
  synth.speak(u)
}

let bubbleTimer = null
function say(text) {
  bubbleEl.textContent = text
  bubbleEl.classList.add("show")
  clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => bubbleEl.classList.remove("show"), 3200)
  if (S.sound) speak(text)
}

// ---------- actions ----------
function setAnim(name) {
  bodyEl.className = `dog-${name}`
  petEl.classList.toggle("sleeping", name === "sleep")
}

let bedTimer = null
function cancelBed() {
  clearTimeout(bedTimer)
  bedTimer = null
  petEl.classList.remove("vanish")
}

// Sleep mode: doze off for a moment, fade away, then the window hides until the dog is woken.
function goToBed(line) {
  removeItem()
  doAction("sleep", { line, duration: 1e9 })
  bedTimer = setTimeout(() => {
    petEl.classList.add("vanish")
    bedTimer = setTimeout(() => window.pet.command("hide-sleep"), 1600)
  }, 3500)
}

function wakeUp() {
  cancelBed()
  if (S.action === "fall" || S.drag) return
  doAction("bow", { line: pick(["잘 잤다~ 기지개 쭈욱!", "으응… 주인님 안녕!", "푹 잤어요! 놀아요!"]) })
}

function doAction(a, opts = {}) {
  if (a !== "sleep") cancelBed()
  S.action = a
  setAnim(a)
  S.targetX = opts.targetX ?? null
  const range = DURATIONS[a]
  S.until = performance.now() + (opts.duration ?? (range ? between(range) : 20000))
  if (opts.line) say(opts.line)
}

function randomWalkX() {
  const span = Math.max(0, S.W - S.w)
  const step = (Math.random() < 0.5 ? -1 : 1) * (150 + Math.random() * 450)
  let x = S.x + step
  if (x < 0 || x > span) x = S.x - step
  return clamp(x, 0, span)
}

function timeLine() {
  const now = new Date()
  const h = now.getHours() + now.getMinutes() / 60
  if (performance.now() - S.lastStretch > 50 * 60 * 1000) {
    S.lastStretch = performance.now()
    return "주인님 잠깐 쉬었다 해요~ 기지개 쭉!"
  }
  if (Math.random() > 0.25) return null
  if (h >= 6 && h < 10) return pick(["좋은 아침이에요!", "아침 먹었어요?"])
  if (h >= 11.5 && h < 13.5) return pick(["점심시간이다! 밥 먹어요~", "나도 배고파…"])
  if (h >= 23 || h < 5) return pick(["주인님 이제 자야지~", "늦었어요… 졸려…"])
  return null
}

function pickNext() {
  const a = pickAction()
  const special = a === "idle" || a === "sit" ? timeLine() : null
  const line = special || (a === "sleep" || Math.random() < 0.15 ? lineFor(a) : undefined)
  if (a === "walk" || a === "run") doAction(a, { targetX: randomWalkX(), line })
  else {
    if (Math.random() < 0.3) S.facing = -S.facing // look the other way now and then
    doAction(a, { line })
  }
}

function arrive() {
  const item = S.item
  if (S.action === "fetch" && item) {
    if (item.kind === "ball" && item.kicks < 2 && Math.random() < 0.7) {
      // Nudge the ball away and chase it again.
      item.kicks++
      const dir = item.x < S.W / 2 ? 1 : -1
      item.vx = dir * (350 + Math.random() * 350)
      item.vy = -350
      say(pick(["톡!", "에잇!", "또 굴러간다~"]))
      return
    }
    removeItem()
    if (item.kind === "bone") {
      S.lastFed = Date.now()
      doAction("eat", { line: "냠냠! 맛있다!" })
    }
    else doAction("happy", { line: "잡았다! 또 던져줘!" })
    return
  }
  doAction("idle", { duration: 1500 })
}

// ---------- effects ----------
function burstHearts() {
  for (let i = 0; i < 5; i++) {
    const el = document.createElement("span")
    el.className = "fx heart"
    el.textContent = "💗"
    el.style.left = `${S.x + S.w / 2 + (i - 2) * 18}px`
    el.style.top = `${S.y - Math.random() * 20}px`
    el.style.animationDelay = `${i * 60}ms`
    fxEl.appendChild(el)
    setTimeout(() => el.remove(), 1500)
  }
}

function dropItem(kind) {
  removeItem()
  const el = document.createElement("div")
  el.className = `fx item-${kind}`
  if (kind === "bone") el.textContent = "🦴"
  fxEl.appendChild(el)
  const size = kind === "bone" ? 34 : 30
  const margin = 40
  let x = clamp(S.x + S.w / 2 + (Math.random() < 0.5 ? -1 : 1) * (250 + Math.random() * 400), margin, S.W - margin)
  S.item = { kind, el, size, x, y: -size, vx: 0, vy: 0, kicks: 0 }
  if (S.action === "sleep") say(lineFor("wake"))
  doAction("fetch", { line: kind === "ball" ? "공이다! 잡으러 간다!" : "간식이다!!" })
}

function removeItem() {
  if (S.item) S.item.el.remove()
  S.item = null
}

function updateItem(dt) {
  const it = S.item
  if (!it) return
  const floor = S.H - it.size
  it.vy += GRAVITY * dt
  it.x += it.vx * dt
  it.y += it.vy * dt
  if (it.y >= floor) {
    it.y = floor
    it.vy = Math.abs(it.vy) > 300 ? -it.vy * 0.4 : 0
    it.vx *= 0.985
    if (Math.abs(it.vx) < 8) it.vx = 0
  }
  if (it.x < it.size / 2 || it.x > S.W - it.size / 2) {
    it.vx = -it.vx * 0.6
    it.x = clamp(it.x, it.size / 2, S.W - it.size / 2)
  }
  it.el.style.transform = `translate(${it.x - it.size / 2}px, ${it.y}px) rotate(${it.x * 2}deg)`
}

// ---------- interaction ----------
function petRect() {
  // The cut-out image has empty corners; shrink the hit box a little.
  const insetX = S.w * 0.12
  return { left: S.x + insetX, right: S.x + S.w - insetX, top: S.y + S.h * 0.05, bottom: S.y + S.h }
}

function isOverPet(cx, cy) {
  const r = petRect()
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
}

function setIgnore(ignore) {
  if (S.ignoring === ignore) return
  S.ignoring = ignore
  window.pet.setIgnore(ignore)
}

window.addEventListener("mousemove", (e) => {
  if (S.drag) {
    const d = S.drag
    const now = performance.now()
    const dt = Math.max(1, now - d.lastT) / 1000
    d.vx = d.vx * 0.5 + ((e.clientX - d.lastX) / dt) * 0.5
    d.vy = d.vy * 0.5 + ((e.clientY - d.lastY) / dt) * 0.5
    d.lastX = e.clientX
    d.lastY = e.clientY
    d.lastT = now
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
      d.moved = true
      petEl.classList.add("dragging")
      doAction("drag", { line: lineFor("drag") })
    }
    if (d.moved) {
      S.x = e.clientX - d.offX
      S.y = e.clientY - d.offY
    }
    return
  }
  S.mouseX = e.clientX
  S.mouseY = e.clientY
  const over = isOverPet(e.clientX, e.clientY)
  setIgnore(!over)
  if (over && !S.hovering && ["idle", "sit", "walk"].includes(S.action)) {
    doAction("wag", { line: Math.random() < 0.4 ? lineFor("hover") : undefined })
  }
  S.hovering = over
})

window.addEventListener("contextmenu", (e) => {
  if (isOverPet(e.clientX, e.clientY)) window.pet.command("chat")
})

window.addEventListener("mousedown", (e) => {
  if (e.button !== 0 || !isOverPet(e.clientX, e.clientY)) return
  const now = performance.now()
  S.drag = {
    startX: e.clientX,
    startY: e.clientY,
    offX: e.clientX - S.x,
    offY: e.clientY - S.y,
    lastX: e.clientX,
    lastY: e.clientY,
    lastT: now,
    vx: 0,
    vy: 0,
    moved: false,
  }
})

window.addEventListener("mouseup", () => {
  const d = S.drag
  if (!d) return
  S.drag = null
  petEl.classList.remove("dragging")
  if (d.moved) {
    S.vx = clamp(d.vx, -1500, 1500)
    S.vy = clamp(d.vy, -1500, 1500)
    doAction("fall")
    return
  }
  // A click, not a drag.
  if (S.action === "sleep") {
    burstHearts()
    doAction("happy", { line: lineFor("wake") })
    return
  }
  burstHearts()
  doAction("happy", { line: lineFor("pet") })
})

window.addEventListener("resize", () => {
  S.W = window.innerWidth
  S.H = window.innerHeight
})

// ---------- commands from the tray ----------
window.pet.onCommand(async ({ type }) => {
  if (S.drag) return
  if (type === "treat") dropItem("bone")
  else if (type === "ball") dropItem("ball")
  else if (type === "sleep") goToBed(lineFor("sleep"))
  else if (type === "wake") wakeUp()
  else if (type === "come") {
    await comeToCursor(lineFor("come"))
  }
})

async function comeToCursor(line) {
  const c = await window.pet.getCursor()
  const tx = clamp(c.x - S.w / 2, 0, Math.max(0, S.W - S.w))
  if (S.action === "fall" || S.drag) return
  removeItem()
  doAction("run", { targetX: tx, line })
}

// ---------- conversation ----------
window.pet.onChat((text) => handleChat(text))
window.dispatchChat = (text) => handleChat(text) // used by the smoke test
async function handleChat(text) {
  const ctx = { name: S.name, ownerName: S.ownerName, hungry: Date.now() - S.lastFed > 2 * 60 * 60 * 1000 }
  const r = window.dogBrain.reply(text, ctx)
  if (r.remember && r.remember.ownerName) {
    S.ownerName = r.remember.ownerName
    window.pet.updateSettings({ ownerName: S.ownerName })
  }
  window.pet.chatReply(r.text)
  if (S.drag || S.action === "fall") return say(r.text)
  if (r.hearts) burstHearts()
  switch (r.action) {
    case "treat":
      dropItem("bone")
      return say(r.text)
    case "ball":
      dropItem("ball")
      return say(r.text)
    case "come":
      return comeToCursor(r.text)
    case "walk":
      return doAction("walk", { targetX: randomWalkX(), line: r.text })
    case "sleep":
      return goToBed(r.text)
    default:
      if (S.action === "sleep" && r.action !== "sleep") burstHearts()
      return doAction(r.action || "wag", { line: r.text })
  }
}

// ---------- settings ----------
function hasTransparentCorners(img) {
  try {
    const c = document.createElement("canvas")
    c.width = c.height = 24
    const ctx = c.getContext("2d")
    ctx.drawImage(img, 0, 0, 24, 24)
    const corners = [
      [0, 0],
      [23, 0],
      [0, 23],
      [23, 23],
    ]
    return corners.filter(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] < 20).length >= 2
  } catch {
    return false
  }
}

function applySize() {
  const round = imgEl.classList.contains("round")
  const ratio = S.sprite ? BASE_H / BASE_W : round || !imgEl.naturalWidth ? 1 : imgEl.naturalHeight / imgEl.naturalWidth
  const oldBottom = S.y + S.h
  S.h = S.w * ratio
  petEl.style.setProperty("--w", `${S.w}px`)
  petEl.style.setProperty("--h", `${S.h}px`)
  if (S.y >= 0) S.y = oldBottom - S.h
}

function applySettings(s) {
  S.name = s.name
  S.sound = s.sound
  S.ownerName = s.ownerName || ""
  S.sprite = !s.customPhoto
  petEl.classList.toggle("sprite", S.sprite)
  if (!s.sound && "speechSynthesis" in window) window.speechSynthesis.cancel()
  S.w = Math.round((SIZES[s.size] || SIZES.medium) * (S.sprite ? 1.2 : 1))
  if (s.photo && imgEl.dataset.src !== s.photo) {
    imgEl.dataset.src = s.photo
    imgEl.onload = () => {
      imgEl.classList.toggle("round", !hasTransparentCorners(imgEl))
      applySize()
    }
    imgEl.src = s.photo
  }
  imgEl.alt = s.name
  applySize()
}

window.pet.onSettings(applySettings)

// ---------- main loop ----------
let last = performance.now()
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  S.W = window.innerWidth
  S.H = window.innerHeight

  if (S.x < 0) {
    // Entrance: drop in from the top of the screen.
    S.x = Math.random() * Math.max(0, S.W - S.w)
    S.y = -S.h
    S.vx = 0
    S.vy = 0
  }

  updateItem(dt)

  const a = S.action
  if (a === "drag") {
    // Position follows the mouse in the mousemove handler.
  } else if (a === "fall") {
    S.vy += GRAVITY * dt
    S.x += S.vx * dt
    S.y += S.vy * dt
    const span = Math.max(0, S.W - S.w)
    if (S.x < 0 || S.x > span) {
      S.vx = -S.vx * 0.5
      S.x = clamp(S.x, 0, span)
    }
    if (S.y >= ground()) {
      S.y = ground()
      if (S.vy > 900) {
        S.vy = -S.vy * 0.3
        S.vx *= 0.6
      } else {
        S.vx = 0
        S.vy = 0
        let line
        if (!S.greeted) {
          S.greeted = true
          line = `왈! ${S.name} 왔어요!`
        } else if (Math.random() < 0.5) line = lineFor("land")
        doAction("land", { line })
      }
    }
  } else {
    // Keep the dog standing on the floor (e.g. after the screen size changed).
    S.y = ground()
    if (a === "fetch" && S.item) S.targetX = clamp(S.item.x - S.w / 2, 0, Math.max(0, S.W - S.w))
    const moving = a === "walk" || a === "run" || a === "fetch"
    if (moving && S.targetX !== null) {
      const dx = S.targetX - S.x
      const itemMoving = a === "fetch" && S.item && (S.item.vx !== 0 || S.item.y < S.H - S.item.size)
      const step = (a === "walk" ? 90 : 330) * dt
      if (Math.abs(dx) <= step && !itemMoving) {
        S.x = S.targetX
        arrive()
      } else if (Math.abs(dx) > step) {
        S.x += Math.sign(dx) * step
        S.facing = dx < 0 ? -1 : 1
      }
    } else if (now > S.until) {
      pickNext()
    }
  }

  S.x = clamp(S.x, 0, Math.max(0, S.W - S.w))
  // The dog may walk out from under a resting cursor: let clicks through again.
  if (!S.ignoring && !S.drag && !isOverPet(S.mouseX, S.mouseY)) {
    setIgnore(true)
    S.hovering = false
  }
  const moving = ["walk", "run", "fetch"].includes(S.action)
  tiltEl.style.transform = S.sprite ? "" : moving ? `rotate(${S.facing * 6}deg)` : ""
  if (S.sprite) drawSprite(now)
  petEl.style.transform = `translate(${S.x}px, ${S.y}px)`

  // Keep the speech bubble on screen near the edges.
  if (bubbleEl.classList.contains("show")) {
    const bw = bubbleEl.offsetWidth
    const center = S.x + S.w / 2
    const shift = clamp(center, bw / 2 + 4, S.W - bw / 2 - 4) - center
    bubbleEl.style.setProperty("--shift", `${shift}px`)
  }

  requestAnimationFrame(loop)
}

window.pet.getSettings().then((s) => {
  applySettings(s)
  setAnim("drag")
  requestAnimationFrame(loop)
})
