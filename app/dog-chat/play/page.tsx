"use client"

import Link from "next/link"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  canSpeak,
  noopSubscribe,
  readName,
  saveName,
  speak,
  stopSpeech,
  subscribeName,
  unlockSpeech,
} from "@/lib/dog-speech"
import { cn } from "@/lib/utils"

const DEFAULT_PHOTO = "/ppo/ppo-default.jpg"
const DEFAULT_NAME = "뽀식이"
const PHOTO_KEY = "dogPlayPhoto"

type Action = "idle" | "walk" | "run" | "fetch" | "jump" | "spin" | "wag" | "sit" | "sleep" | "happy" | "eat"
type Item = { kind: "ball" | "bone"; x: number; y: number }
type Point = { x: number; y: number }

let memoryPhoto: string | null = null
const photoListeners = new Set<() => void>()

function subscribePhoto(listener: () => void) {
  photoListeners.add(listener)
  return () => photoListeners.delete(listener)
}

function readPhoto() {
  try {
    return localStorage.getItem(PHOTO_KEY) ?? memoryPhoto
  } catch {
    return memoryPhoto
  }
}

function savePhoto(dataUrl: string | null) {
  memoryPhoto = dataUrl
  try {
    if (dataUrl) localStorage.setItem(PHOTO_KEY, dataUrl)
    else localStorage.removeItem(PHOTO_KEY)
  } catch {}
  photoListeners.forEach((l) => l())
}

const LINES: Record<string, (n: string) => string[]> = {
  idle: (n) => ["왈!", "놀아줘~", "주인님 뭐 해?", `${n} 심심해~`],
  walk: () => ["킁킁… 무슨 냄새지?", "산책 좋아~", "어디 가볼까?"],
  run: () => ["우다다다!", "달려라~!"],
  jump: () => ["왈왈!", "신난다!", "점프!"],
  spin: () => ["빙글빙글~", "꼬리 잡기!"],
  wag: () => ["꼬리 살랑살랑~", "헤헤", "기분 좋아!"],
  sit: () => ["얌전히 앉았어요!", "착하지?"],
  sleep: () => ["졸려… zzz", "잠깐 낮잠…"],
  pet: (n) => ["헤헤 좋아!", "쓰담쓰담 더 해줘!", `${n} 기분 최고!`],
}

const RANDOM_ACTIONS: [Action, number][] = [
  ["walk", 30],
  ["idle", 14],
  ["wag", 12],
  ["sit", 10],
  ["jump", 9],
  ["run", 8],
  ["spin", 7],
  ["sleep", 3],
]

const DURATIONS: Partial<Record<Action, [number, number]>> = {
  idle: [2500, 4500],
  wag: [2000, 2600],
  sit: [3000, 4500],
  jump: [1400, 1400],
  spin: [1600, 1600],
  sleep: [9000, 12000],
  happy: [1600, 1600],
  eat: [2600, 2600],
}

function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]
}

function pickAction(): Action {
  const total = RANDOM_ACTIONS.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [a, w] of RANDOM_ACTIONS) {
    r -= w
    if (r < 0) return a
  }
  return "idle"
}

function between([min, max]: [number, number]) {
  return min + Math.random() * (max - min)
}

const ANIMATIONS = `
@keyframes dog-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.03) } }
@keyframes dog-walk { 0%,100% { transform: translateY(0) rotate(-3deg) } 50% { transform: translateY(-7px) rotate(3deg) } }
@keyframes dog-run { 0%,100% { transform: translateY(0) rotate(-5deg) } 50% { transform: translateY(-12px) rotate(5deg) } }
@keyframes dog-jump { 0%,100% { transform: translateY(0) scale(1, 1) } 15% { transform: translateY(0) scale(1.08, .9) } 50% { transform: translateY(-80px) scale(.96, 1.05) } 85% { transform: translateY(0) scale(1.06, .92) } }
@keyframes dog-spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
@keyframes dog-wag { 0%,100% { transform: rotate(-9deg) } 50% { transform: rotate(9deg) } }
@keyframes dog-sit { 0%,100% { transform: translateY(10px) scale(1, .88) } 50% { transform: translateY(9px) scale(1.01, .9) } }
@keyframes dog-sleep { 0%,100% { transform: translateY(22px) rotate(-78deg) scale(.92) } 50% { transform: translateY(22px) rotate(-78deg) scale(.95) } }
@keyframes dog-happy { 0%,100% { transform: translateY(0) } 30% { transform: translateY(-26px) rotate(-6deg) } 60% { transform: translateY(0) rotate(6deg) } 80% { transform: translateY(-10px) } }
@keyframes dog-eat { 0%,100% { transform: rotate(0) translateY(0) } 50% { transform: rotate(10deg) translateY(8px) } }
@keyframes heart-float { from { transform: translate(-50%, 0) scale(.6); opacity: 1 } to { transform: translate(-50%, -110px) scale(1.3); opacity: 0 } }
@keyframes zzz-float { 0% { transform: translate(0, 0); opacity: 0 } 30% { opacity: 1 } 100% { transform: translate(26px, -50px); opacity: 0 } }
@keyframes item-drop { from { transform: translateY(-160px) } 70% { transform: translateY(0) } 85% { transform: translateY(-14px) } to { transform: translateY(0) } }
.dog-idle { animation: dog-breathe 2s ease-in-out infinite }
.dog-walk { animation: dog-walk .45s ease-in-out infinite }
.dog-run, .dog-fetch { animation: dog-run .26s ease-in-out infinite }
.dog-jump { animation: dog-jump .7s ease-in-out 2 }
.dog-spin { animation: dog-spin .8s ease-in-out 2 }
.dog-wag { animation: dog-wag .3s ease-in-out infinite }
.dog-sit { animation: dog-sit 2.2s ease-in-out infinite }
.dog-sleep { animation: dog-sleep 3s ease-in-out infinite }
.dog-happy { animation: dog-happy .8s ease-in-out 2 }
.dog-eat { animation: dog-eat .35s ease-in-out infinite }
`

export default function DogPlayPage() {
  const stageRef = useRef<HTMLDivElement>(null)
  const dogRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [action, setAction] = useState<Action>("idle")
  const [facing, setFacing] = useState(1)
  const [bubble, setBubble] = useState<string | null>(null)
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const [item, setItem] = useState<Item | null>(null)
  const [soundOn, setSoundOn] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hintClosed, setHintClosed] = useState(false)

  const storedName = useSyncExternalStore(subscribeName, readName, () => "")
  const customPhoto = useSyncExternalStore(subscribePhoto, readPhoto, () => null)
  const speechSupported = useSyncExternalStore(noopSubscribe, canSpeak, () => false)
  const fullscreenSupported = useSyncExternalStore(noopSubscribe, () => !!document.fullscreenEnabled, () => false)
  const platform = useSyncExternalStore(
    noopSubscribe,
    () => (/iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "desktop"),
    () => "desktop",
  )
  const isInstalled = useSyncExternalStore(
    noopSubscribe,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => true,
  )
  const photo = customPhoto ?? DEFAULT_PHOTO
  const name = storedName.trim() || (customPhoto ? "멍멍이" : DEFAULT_NAME)

  // The animation loop outlives renders, so it reads and writes these refs directly.
  const posRef = useRef<Point>({ x: -1, y: -1 })
  const targetRef = useRef<Point | null>(null)
  const actionRef = useRef<Action>("idle")
  const untilRef = useRef(0)
  const facingRef = useRef(1)
  const itemRef = useRef<Item | null>(null)
  const boundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0, size: 0 })
  const soundOnRef = useRef(false)
  const nameRef = useRef(name)
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartIdRef = useRef(0)
  const actionsRef = useRef({ pickNext: () => {}, arrive: () => {} })

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const stage = stageRef.current
      const dog = dogRef.current
      if (stage && dog) {
        const size = dog.offsetWidth
        // Keep the dog (and its speech bubble) below the toolbar, which is taller on phones.
        const floorTop = Math.max(stage.clientHeight * 0.28, (toolbarRef.current?.offsetHeight ?? 0) + 44)
        const bounds = {
          minX: 0,
          maxX: Math.max(0, stage.clientWidth - size),
          minY: floorTop,
          maxY: Math.max(floorTop, stage.clientHeight - dog.offsetHeight - 8),
          size,
        }
        boundsRef.current = bounds
        const pos = posRef.current
        if (pos.x < 0) {
          pos.x = bounds.maxX / 2
          pos.y = (bounds.minY + bounds.maxY) / 2
        }
        const a = actionRef.current
        const target = targetRef.current
        if (target && (a === "walk" || a === "run" || a === "fetch")) {
          const dx = target.x - pos.x
          const dy = target.y - pos.y
          const dist = Math.hypot(dx, dy)
          const step = (a === "walk" ? 90 : 280) * dt
          if (dist <= step) {
            pos.x = target.x
            pos.y = target.y
            targetRef.current = null
            actionsRef.current.arrive()
          } else {
            pos.x += (dx / dist) * step
            pos.y += (dy / dist) * step
            const face = dx < 0 ? -1 : 1
            if (Math.abs(dx) > 2 && face !== facingRef.current) {
              facingRef.current = face
              setFacing(face)
            }
          }
        } else if (now > untilRef.current) {
          actionsRef.current.pickNext()
        }
        pos.x = Math.min(bounds.maxX, Math.max(bounds.minX, pos.x))
        pos.y = Math.min(bounds.maxY, Math.max(bounds.minY, pos.y))
        // Farther back on the floor looks smaller, for a little depth.
        const depth = bounds.maxY > bounds.minY ? (pos.y - bounds.minY) / (bounds.maxY - bounds.minY) : 1
        dog.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${0.82 + depth * 0.22})`
        dog.style.zIndex = String(10 + Math.round(depth * 10))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      stopSpeech()
    }
  }, [])

  function say(text: string) {
    setBubble(text)
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current)
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 2800)
    if (soundOnRef.current) speak(text, 1.5, 1.05)
  }

  function doAction(a: Action, opts: { target?: Point; line?: string; duration?: number } = {}) {
    actionRef.current = a
    setAction(a)
    targetRef.current = opts.target ?? null
    const range = DURATIONS[a]
    untilRef.current = performance.now() + (opts.duration ?? (range ? between(range) : 15000))
    if (opts.line) say(opts.line)
  }

  function randomSpot(): Point {
    const b = boundsRef.current
    return { x: b.minX + Math.random() * (b.maxX - b.minX), y: b.minY + Math.random() * (b.maxY - b.minY) }
  }

  function lineFor(key: string) {
    return pick(LINES[key](nameRef.current))
  }

  function pickNext() {
    const a = pickAction()
    const talk = a === "sleep" || Math.random() < 0.35
    const line = talk ? lineFor(a) : undefined
    if (a === "walk" || a === "run") doAction(a, { target: randomSpot(), line })
    else doAction(a, { line })
  }

  function arrive() {
    const current = itemRef.current
    if (actionRef.current === "fetch" && current) {
      itemRef.current = null
      setItem(null)
      if (current.kind === "bone") doAction("eat", { line: "냠냠! 맛있다!" })
      else doAction("happy", { line: "잡았다! 또 던져줘!" })
      return
    }
    doAction("idle", { duration: 1200 })
  }

  function burstHearts(x: number, y: number) {
    const batch = Array.from({ length: 5 }, (_, i) => ({
      id: ++heartIdRef.current,
      x: x + (i - 2) * 18,
      y: y - Math.random() * 20,
    }))
    setHearts((h) => [...h, ...batch])
    setTimeout(() => setHearts((h) => h.filter((p) => !batch.some((b) => b.id === p.id))), 1300)
  }

  function petDog(e: React.MouseEvent) {
    e.stopPropagation()
    const b = boundsRef.current
    const pos = posRef.current
    burstHearts(pos.x + b.size / 2, pos.y)
    doAction("happy", { line: lineFor("pet") })
  }

  function callTo(e: React.MouseEvent<HTMLDivElement>) {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const b = boundsRef.current
    const target = { x: e.clientX - rect.left - b.size / 2, y: e.clientY - rect.top - b.size / 2 }
    doAction("run", { target, line: Math.random() < 0.5 ? lineFor("run") : undefined })
  }

  function throwItem(kind: Item["kind"]) {
    const b = boundsRef.current
    const spot = randomSpot()
    const next: Item = { kind, x: spot.x + b.size / 2, y: spot.y + b.size * 0.7 }
    itemRef.current = next
    setItem(next)
    doAction("fetch", {
      target: { x: next.x - b.size / 2, y: next.y - b.size * 0.7 },
      line: kind === "ball" ? "공이다! 잡으러 간다!" : "간식이다!!",
    })
  }

  function toggleSound() {
    const next = !soundOnRef.current
    soundOnRef.current = next
    setSoundOn(next)
    if (next) unlockSpeech()
    else stopSpeech()
  }

  function goFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  function choosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // Center-crop to a small square so it fits in browser storage.
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 320
      canvas
        .getContext("2d")!
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 320, 320)
      savePhoto(canvas.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  useEffect(() => {
    nameRef.current = name
    actionsRef.current = { pickNext, arrive }
  })

  return (
    <main className="relative h-svh w-full touch-manipulation overflow-hidden select-none">
      <style>{ANIMATIONS}</style>

      <div
        ref={stageRef}
        onClick={callTo}
        className="absolute inset-0 cursor-pointer"
        style={{
          background:
            "linear-gradient(to bottom, #fbe7cf 0%, #f8dfc2 28%, #e8c69d 28%, #f2d9b6 100%)",
        }}
      >
        <div
          className="absolute left-1/2 top-[58%] h-[30%] w-[55%] -translate-x-1/2 rounded-[50%] opacity-60"
          style={{ background: "radial-gradient(#f9c9c0, #f3b2a6)" }}
        />
        <div className="absolute left-[8%] top-[5%] hidden h-[18%] w-[16%] rounded-lg sm:block border-8 border-white/80 bg-sky-200/80 shadow-inner" />

        {item && (
          <div
            className="absolute text-4xl"
            style={{
              left: item.x,
              top: item.y,
              transform: "translate(-50%, -50%)",
              zIndex: 9,
              animation: "item-drop .7s ease-out",
            }}
          >
            {/* Drawn ball: the 🎾 emoji is a racket in some fonts, and the link is shared across computers. */}
            {item.kind === "ball" ? (
              <div
                data-item="ball"
                className="h-9 w-9 rounded-full shadow-md"
                style={{ background: "radial-gradient(circle at 35% 30%, #f4ff8a, #c8e62a 55%, #9bb81a)" }}
              />
            ) : (
              <span data-item="bone">🦴</span>
            )}
          </div>
        )}

        {hearts.map((h) => (
          <span
            key={h.id}
            className="pointer-events-none absolute text-2xl"
            style={{ left: h.x, top: h.y, zIndex: 30, animation: "heart-float 1.2s ease-out forwards" }}
          >
            💗
          </span>
        ))}

        <div
          ref={dogRef}
          onClick={petDog}
          className="absolute left-0 top-0 origin-bottom cursor-grab will-change-transform"
          style={{ width: "clamp(100px, 14vw, 180px)" }}
        >
          {bubble && (
            <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-2xl border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 shadow-md">
              {bubble}
            </div>
          )}
          <div style={{ transform: `scaleX(${facing})` }}>
            <div className={`dog-${action}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt={name}
                draggable={false}
                className="aspect-square w-full rounded-full border-4 border-white object-cover shadow-xl [-webkit-touch-callout:none]"
              />
            </div>
          </div>
          {action === "sleep" &&
            [0, 1, 2].map((i) => (
              <span
                key={i}
                className="pointer-events-none absolute right-1 top-1 text-xl"
                style={{ animation: `zzz-float 2.4s ease-out ${i * 0.8}s infinite` }}
              >
                💤
              </span>
            ))}
          <div className="mx-auto mt-1 h-3 w-3/4 rounded-[50%] bg-black/15 blur-[2px]" />
          <div className="mt-0.5 text-center text-xs font-semibold text-neutral-700">{name}</div>
        </div>
      </div>

      {/* Labels collapse to icons on phones so the toolbar stays one or two rows. */}
      <div
        ref={toolbarRef}
        className="absolute inset-x-0 top-0 z-40 flex flex-wrap items-center gap-1.5 bg-white/70 px-3 pb-2 backdrop-blur"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <span className="mr-1 font-semibold text-neutral-800">
          🐶 {name}
          <span className="hidden sm:inline"> 놀이터</span>
        </span>
        <Button size="sm" variant="outline" title="공 던지기" onClick={() => throwItem("ball")}>
          🎾<span className="hidden sm:inline"> 공 던지기</span>
        </Button>
        <Button size="sm" variant="outline" title="간식 주기" onClick={() => throwItem("bone")}>
          🦴<span className="hidden sm:inline"> 간식 주기</span>
        </Button>
        <Button size="sm" variant="outline" title="재우기" onClick={() => doAction("sleep", { line: lineFor("sleep") })}>
          💤<span className="hidden sm:inline"> 재우기</span>
        </Button>
        <Button size="sm" variant="outline" title="신나게" onClick={() => doAction("spin", { line: lineFor("spin") })}>
          🎉<span className="hidden sm:inline"> 신나게</span>
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {speechSupported && (
            <Button size="sm" variant="ghost" title={soundOn ? "소리 끄기" : "소리 켜기"} onClick={toggleSound}>
              {soundOn ? "🔊" : "🔇"}
              <span className="hidden sm:inline">{soundOn ? " 소리 켬" : " 소리 끔"}</span>
            </Button>
          )}
          {fullscreenSupported && !isInstalled && (
            <Button size="sm" variant="ghost" title="전체 화면" onClick={goFullscreen}>
              ⛶<span className="hidden sm:inline"> 전체 화면</span>
            </Button>
          )}
          <Button size="sm" variant="ghost" title="설정" onClick={() => setSettingsOpen((o) => !o)}>
            ⚙️<span className="hidden sm:inline"> 설정</span>
          </Button>
          <Link
            href="/dog-chat"
            title="대화하기"
            className="rounded-md px-2 py-1 text-sm text-neutral-700 hover:bg-black/5"
          >
            💬<span className="hidden sm:inline"> 대화하기</span>
          </Link>
        </div>
      </div>

      {!isInstalled && !hintClosed && platform !== "desktop" && (
        <div
          className="absolute inset-x-3 z-40 flex items-start gap-2 rounded-2xl border border-amber-200 bg-white/95 p-3 text-xs leading-relaxed text-neutral-800 shadow-lg"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <span className="flex-1">
            📲 <b>앱처럼 설치하기</b>:{" "}
            {platform === "ios"
              ? "사파리 아래쪽 공유 버튼(네모에 위쪽 화살표) → '홈 화면에 추가'를 누르세요."
              : "크롬 오른쪽 위 메뉴(⋮) → '홈 화면에 추가' 또는 '앱 설치'를 누르세요."}{" "}
            홈 화면의 {name} 얼굴 아이콘으로 바로 열려요.
          </span>
          <button className="px-1 text-base text-neutral-500" aria-label="닫기" onClick={() => setHintClosed(true)}>
            ✕
          </button>
        </div>
      )}

      {settingsOpen && (
        <div
          className="absolute right-3 z-50 flex w-[min(340px,calc(100vw-24px))] flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-xl"
          style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">강아지 이름</span>
            <Input
              value={storedName}
              onChange={(e) => saveName(e.target.value)}
              placeholder={customPhoto ? "예: 초코" : DEFAULT_NAME}
              maxLength={20}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground">강아지 사진</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                📷 내 강아지 사진 고르기
              </Button>
              {customPhoto && (
                <Button size="sm" variant="outline" onClick={() => savePhoto(null)}>
                  기본 뽀식이로
                </Button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              고른 사진은 이 기기의 브라우저에만 저장되고 어디에도 올라가지 않아요.
            </span>
          </div>
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <span className="text-muted-foreground">다른 사람에게 보내기</span>
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? "✅ 링크 복사됨" : "🔗 놀이터 링크 복사"}
            </Button>
            <span className="text-xs text-muted-foreground">
              링크를 받은 사람도 설치 없이 똑같이 쓸 수 있고, 자기 강아지 사진으로 바꿀 수 있어요.
            </span>
          </div>
          <span className={cn("text-xs text-muted-foreground")}>
            💡 바닥을 누르면 달려오고, {name}를 누르면 좋아해요.
          </span>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={choosePhoto} />
    </main>
  )
}
