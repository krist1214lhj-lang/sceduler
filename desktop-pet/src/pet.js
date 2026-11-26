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
  // 8 frames of one natural step cycle: legs swing front/back from one picture (desktop-pet/README.md)
  walk: ["walk0", "walk1", "walk2", "walk3", "walk4", "walk5", "walk6", "walk7"],
  run: ["run0", "run1", "run2", "run3"],
  sit: ["sit"],
  sleep: ["sleep"],
  jump: ["jump"],
  bow: ["bow"],
  paw: ["paw"],
  eat: ["eat"],
  bang: ["bang"],
  shy: ["shy"],
  highfive: ["highfive"],
  beg: ["beg"],
  belly: ["belly"],
  yawn: ["yawn"],
}
const TRICKS = ["bang", "shy", "highfive", "beg", "belly", "yawn"]
const POSE = { walk: "walk", run: "run", fetch: "run", spin: "run", chase: "run", nap: "sleep", sit: "sit", sleep: "sleep", jump: "jump", bow: "bow", paw: "paw", eat: "eat" }
for (const t of TRICKS) POSE[t] = t
const FRAME_MS = { walk: 130, run: 85 }
const WALK_STEP = 0.075 // fraction of the dog's width walked per frame (8 frames = one stride cycle)
const BASE_W = 222 // natural width of a walking frame = the dog's box width
const BASE_H = 244
const spriteSize = {}
const spriteImgs = {}
for (const name of new Set(Object.values(SPRITES).flat())) {
  const im = document.createElement("img")
  im.alt = ""
  im.draggable = false
  im.onload = () => (spriteSize[name] = [im.naturalWidth, im.naturalHeight])
  im.src = `assets/ppo/${name}.png`
  spriteEl.appendChild(im)
  spriteImgs[name] = im
}
let shownSprite = null

function drawSprite(now) {
  const pose = POSE[S.action] || "front"
  const frames = SPRITES[pose]
  // Walking frames follow the distance walked, so the paws stay planted instead of sliding.
  // (Single-picture poses have no frame timing: always their only picture.)
  const index =
    frames.length === 1 ? 0 : pose === "walk" ? Math.floor(S.walkDist / (S.w * WALK_STEP)) : Math.floor(now / FRAME_MS[pose])
  const name = frames[index % frames.length]
  const el = spriteImgs[name]
  if (!el) return
  if (shownSprite !== el) {
    // Keep showing the previous picture until the next one has loaded, so the dog never blinks out.
    if (!el.complete || !el.naturalWidth) return
    if (shownSprite) shownSprite.classList.remove("on")
    el.classList.add("on")
    shownSprite = el
  }
  const size = spriteSize[name]
  const width = size ? (size[0] * S.w) / BASE_W : S.w
  if (size) el.style.width = `${width}px`
  // Wide poses (bang, belly) stick out of the box; keep them on screen at the edges.
  const extra = Math.max(0, (width - S.w) / 2)
  let shift = 0
  if (S.free) shift = 0
  else if (S.x - extra < 0) shift = extra - S.x
  else if (S.x + S.w + extra > S.W) shift = S.W - (S.x + S.w + extra)
  // The side-view frames face right; the front photo has the name tag text, so it never mirrors.
  const flip = pose === "front" ? 1 : S.facing
  // Each step lifts the body a touch (two steps per cycle).
  const bob = pose === "walk" ? -Math.abs(Math.sin((S.walkDist / (S.w * WALK_STEP * frames.length)) * Math.PI * 2)) * S.w * 0.015 : 0
  el.style.transform = `translate(calc(-50% + ${shift}px), ${bob}px) scaleX(${flip})`
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
  bang: () => ["으악! 당했다… 꼴깍", "빵! …(죽은 척 중)", "윽… 나 죽었어요… (실눈)"],
  shy: () => ["부끄부끄~", "아잉 몰라요~ (얼굴 가림)", "보지 마세요… 부끄러워!"],
  highfive: () => ["하이파이브! 짝!", "손바닥 짝! 왈!", "우리 최고!"],
  beg: () => ["주세요~ 주세요~", "간식 하나만요… 네?", "두 발로 섰어요! 칭찬해 주세요!"],
  belly: () => ["배 쓰담쓰담 해주세요~", "뒹굴뒹굴~ 기분 좋다!", "배 만져도 돼요! 헤헤"],
  yawn: () => ["하아암~ 졸려…", "하품 나와요~", "아함… 조금 졸리다"],
  zoomies: () => ["우다다다다!!", "갑자기 신난다!!", "달려라 뽀식이!!"],
  chase: () => ["꼬리 잡을 거야!", "내 꼬리 어디 갔지?", "거기 서! 꼬리야!"],
  peek: () => ["빼꼼!", "나 찾아봐라~", "여기 있지롱!"],
  follow: () => ["주인님 어디 가요~", "같이 가요!", "어? 주인님 손이다!"],
  rub: () => ["헤헤 간지러워~ 더 해줘!", "아~ 거기 거기!", "쓰담쓰담 최고예요!"],
  hungry: () => ["배고파요… 간식 주세요~", "꼬르륵… 간식 시간 아니에요?", "간식… 간식…!"],
  welcome: () => ["주인님 왔다!!", "기다렸어요! 왈왈!", "어디 갔다 왔어요~ 보고 싶었어요!"],
  nap: () => ["주인님 어디 갔지… 기다리다 잘래요 zzz", "아무도 없네… 낮잠 자야지… zzz"],
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
  ["yawn", 3],
  ["belly", 3],
  ["shy", 2],
  ["beg", 2],
  ["highfive", 2],
  ["bang", 1],
  ["zoomies", 3],
  ["chase", 3],
  ["peek", 2],
  ["follow", 3],
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
  bang: [3500, 4500],
  shy: [2600, 3200],
  highfive: [1800, 2200],
  beg: [2600, 3400],
  belly: [3500, 5000],
  yawn: [2200, 2600],
  chase: [2400, 2400],
  nap: [1e9, 1e9],
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
  entered: false,
  walkDist: 0,
  sprite: true,
  ownerName: "",
  lastFed: Date.now(),
  script: null, // a short sequence of steps (zoomies, peek…), see runScript()
  speed: 0,
  free: false, // may leave the screen (peeking from the edge)
  nextLook: 0,
  rub: { dir: 0, flips: 0, t: 0, lastX: -1 },
  napping: false,
  lastChime: -1,
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
  // The picture actually on screen (null = the dog is invisible: a bug the smoke test must catch).
  pic: S.sprite ? (shownSprite ? shownSprite.src.split("/").pop() : null) : "photo",
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
  petEl.classList.toggle("sleeping", name === "sleep" || name === "nap")
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
  if (!opts.keepScript) S.script = null
  if (a !== "nap") S.napping = false
  S.speed = opts.speed || (a === "walk" ? 75 : 330)
  S.free = Boolean(opts.free)
  if (opts.face) S.facing = opts.face
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

// ---------- little routines made of several steps ----------
function runScript(steps) {
  S.script = steps.slice()
  nextStep()
}

function nextStep() {
  const st = S.script && S.script.shift()
  if (!st) {
    S.script = null
    return false
  }
  doAction(st.a, { targetX: st.x, line: st.line, duration: st.d, speed: st.speed, free: st.free, face: st.face, keepScript: true })
  return true
}

const span = () => Math.max(0, S.W - S.w)

function startZoomies(line) {
  removeItem()
  const fast = 600
  const far = S.x < span() / 2 ? span() : 0
  runScript([
    { a: "run", x: far, speed: fast, line: line || lineFor("zoomies") },
    { a: "run", x: span() - far, speed: fast },
    { a: "run", x: far, speed: fast },
    { a: "run", x: span() / 2, speed: fast, line: "우다다다다!!" },
    { a: "bow", d: 2200, line: pick(["헥헥… 신났다!", "헥헥 재밌다!"]) },
  ])
}

function startChase(line) {
  runScript([
    { a: "chase", d: 2400, line: line || lineFor("chase") },
    { a: "sit", d: 2200, line: pick(["어질어질~", "놓쳤다… 다음엔 잡을 거야!"]) },
  ])
}

function startPeek(line) {
  removeItem()
  const left = S.x + S.w / 2 < S.W / 2
  const edge = left ? 0 : span()
  const hidden = left ? -S.w * 1.1 : span() + S.w * 1.1
  const peekX = left ? -S.w * 0.5 : span() + S.w * 0.5
  const inward = left ? 1 : -1
  runScript([
    { a: "walk", x: edge, line: "쉿… 숨바꼭질!" },
    { a: "run", x: hidden, free: true },
    { a: "idle", d: 2500, free: true },
    { a: "walk", x: peekX, free: true },
    { a: "sit", d: 2600, free: true, face: inward, line: line || lineFor("peek") },
    { a: "run", x: left ? S.w : span() - S.w, free: true, line: "찾았다~ 히히!" },
  ])
}

function followCursor(line) {
  if (S.mouseX < 0) return false
  doAction("run", { targetX: clamp(S.mouseX - S.w / 2, 0, span()), line: line || lineFor("follow") })
  return true
}

const SPECIAL = { zoomies: startZoomies, chase: startChase, peek: startPeek }

function pickNext() {
  // Hungry dogs beg now and then.
  if (Date.now() - S.lastFed > 3 * 60 * 60 * 1000 && Math.random() < 0.12) {
    doAction("beg", { line: lineFor("hungry") })
    return
  }
  const a = pickAction()
  if (SPECIAL[a]) return SPECIAL[a]()
  if (a === "follow") {
    if (!followCursor()) doAction("idle")
    return
  }
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
  if (S.script && nextStep()) return
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

// While carrying the dog past the window's edge, check whether the cursor reached another monitor.
let carrying = false
async function carryAcross(d) {
  if (carrying) return
  carrying = true
  try {
    const at = await window.pet.carryToCursor()
    if (at && S.drag === d) {
      // The window now covers the other monitor; keep the dog under the cursor there.
      S.W = window.innerWidth
      S.H = window.innerHeight
      d.lastX = at.x
      d.lastY = at.y
      S.x = at.x - d.offX
      S.y = at.y - d.offY
      say(pick(["여기는 어디지? 킁킁", "옆 모니터 도착!", "새 놀이터다!"]))
    }
  } finally {
    carrying = false
  }
}

window.addEventListener("mousemove", (e) => {
  if (S.drag && e.buttons === 0) {
    // The button was released where we could not hear it (e.g. on another monitor): drop the dog.
    endDrag()
    return
  }
  if (S.drag) {
    const d = S.drag
    if (d.moved && (e.clientX < 0 || e.clientY < 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
      carryAcross(d)
    }
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
  const now = performance.now()
  if (over) trackRub(e.clientX, now)
  else if (["idle", "sit", "wag"].includes(S.action) && !S.script && now > S.nextLook) {
    // Notice the cursor nearby: look at it, and sometimes trot over.
    const dx = e.clientX - (S.x + S.w / 2)
    if (Math.abs(dx) < 260 && Math.abs(e.clientY - (S.y + S.h / 2)) < 260) {
      S.nextLook = now + 5000
      S.facing = dx < 0 ? -1 : 1
      if (Math.random() < 0.3) followCursor()
    }
  }
  if (over && !S.hovering && ["idle", "sit", "walk"].includes(S.action)) {
    doAction("wag", { line: Math.random() < 0.4 ? lineFor("hover") : undefined })
  }
  S.hovering = over
})

// Rubbing the dog (moving the mouse back and forth over it) gets a belly roll.
function trackRub(x, now) {
  const r = S.rub
  if (now - r.t > 1500) r.flips = 0
  if (r.lastX >= 0) {
    const dir = Math.sign(x - r.lastX)
    if (dir && r.dir && dir !== r.dir && Math.abs(x - r.lastX) > 2) {
      r.flips++
      r.t = now
    }
    if (dir) r.dir = dir
  }
  r.lastX = x
  if (r.flips >= 5 && S.action !== "belly" && !S.drag) {
    r.flips = 0
    burstHearts()
    doAction("belly", { line: lineFor("rub") })
  }
}

window.addEventListener("dblclick", (e) => {
  if (isOverPet(e.clientX, e.clientY)) doAction("bang", { line: lineFor("bang") })
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

window.addEventListener("mouseup", () => endDrag())

function endDrag() {
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
}

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
  else if (type.startsWith("trick:")) {
    const t = type.slice(6)
    if (S.action === "fall") return
    if (SPECIAL[t]) SPECIAL[t]()
    else if (TRICKS.includes(t)) doAction(t, { line: lineFor(t) })
  }
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
    case "zoomies":
    case "chase":
    case "peek":
      return SPECIAL[r.action](r.text)
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
  // 0.7: the user asked for the dog at 70% of its earlier size.
  S.w = Math.round((SIZES[s.size] || SIZES.medium) * (S.sprite ? 1.2 : 1) * 0.7)
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

// ---------- the owner's presence (keyboard + mouse idle time from Windows) ----------
window.pet.onIdle((seconds) => handleIdle(seconds))
window.__idle = (seconds) => handleIdle(seconds) // used by the smoke test
function handleIdle(seconds) {
  if (S.drag || S.action === "fall") return
  if (seconds >= 300 && !S.napping && !["sleep", "nap"].includes(S.action)) {
    removeItem()
    doAction("nap", { line: lineFor("nap") })
    S.napping = true
  } else if (seconds < 5 && S.napping) {
    S.napping = false
    burstHearts()
    doAction("jump", { line: lineFor("welcome") })
  }
}

// ---------- hourly chime ----------
const CHIME = {
  9: "오늘도 힘내요!",
  12: "점심 먹을 시간이에요!",
  15: "물 한 잔 마셔요~",
  18: "퇴근 시간이다! 수고했어요!",
  22: "슬슬 쉴 시간이에요~",
}
setInterval(() => {
  const d = new Date()
  const h = d.getHours()
  if (d.getMinutes() !== 0 || h === S.lastChime || h < 7) return
  S.lastChime = h
  if (S.drag || S.napping || ["sleep", "nap", "fall"].includes(S.action)) return
  const ap = h < 12 ? "오전" : "오후"
  const extra = CHIME[h] || pick(["물 한 잔 마셔요~", "눈 좀 쉬어요~", "기지개 한 번 쭉!"])
  doAction("sit", { line: `${ap} ${h % 12 || 12}시예요! ${extra}`, duration: 4000 })
}, 15000)

// ---------- main loop ----------
let last = performance.now()
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  S.W = window.innerWidth
  S.H = window.innerHeight

  if (!S.entered) {
    // Entrance: drop in from the top of the screen.
    S.entered = true
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
      const step = S.speed * dt
      if (Math.abs(dx) <= step && !itemMoving) {
        S.x = S.targetX
        arrive()
      } else if (Math.abs(dx) > step) {
        S.x += Math.sign(dx) * step
        if (a === "walk") S.walkDist += step
        S.facing = dx < 0 ? -1 : 1
      }
    } else if (now > S.until) {
      if (!(S.script && nextStep())) pickNext()
    }
    if (a === "chase") S.facing = Math.floor(now / 170) % 2 ? 1 : -1
  }

  if (!S.free) S.x = clamp(S.x, 0, Math.max(0, S.W - S.w))
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
