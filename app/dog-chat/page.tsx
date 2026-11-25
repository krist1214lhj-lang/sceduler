"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const EMOTION_EMOJI: Record<string, string> = {
  Happy: "😊",
  Relaxed: "😌",
  Curious: "🤔",
  Anxious: "😰",
  Sad: "😢",
  Angry: "😠",
  Sleepy: "😴",
}

const EMOTION_KR: Record<string, string> = {
  Happy: "신남",
  Relaxed: "편안",
  Curious: "궁금",
  Anxious: "불안",
  Sad: "시무룩",
  Angry: "예민",
  Sleepy: "졸림",
}

const AUTO_READ_MS = 15_000
const IDLE_STOP_MS = 30 * 60_000
const HISTORY_LIMIT = 20

type Mode = "idle" | "live" | "photo"
type Emotion = { label: string; reason: string }
type Message = { role: "user" | "assistant"; content: string }

function emotionForChat(e: Emotion) {
  return `${EMOTION_KR[e.label] ?? e.label} (${e.reason})`
}

type Recognition = {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null
}

const NAME_KEY = "dogName"
let memoryName = ""
const nameListeners = new Set<() => void>()

function subscribeName(listener: () => void) {
  nameListeners.add(listener)
  return () => nameListeners.delete(listener)
}

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? memoryName
  } catch {
    return memoryName
  }
}

function saveName(name: string) {
  memoryName = name
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {}
  nameListeners.forEach((l) => l())
}

const noopSubscribe = () => () => {}

function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

const EMOJI = new RegExp("[\\p{Extended_Pictographic}\\u200d\\ufe0f]", "gu")

let speechErrorListener: ((code: string) => void) | null = null
let speechStateListener: ((speaking: boolean) => void) | null = null
// Safari can garbage-collect an utterance mid-speech, so keep the current one alive.
let currentUtterance: SpeechSynthesisUtterance | null = null

function speak(text: string, pitch: number, rate: number) {
  if (!canSpeak()) return
  const clean = text.replace(EMOJI, "").replace(/~/g, "").trim()
  if (!clean) return
  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(clean)
  // No explicit voice: iOS can list voices that aren't installed, and picking one plays silence.
  utterance.lang = "ko-KR"
  utterance.pitch = pitch
  utterance.rate = rate
  utterance.onstart = () => speechStateListener?.(true)
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null
    speechStateListener?.(false)
  }
  utterance.onerror = (e) => {
    speechStateListener?.(false)
    if (e.error !== "canceled" && e.error !== "interrupted") speechErrorListener?.(e.error)
  }
  currentUtterance = utterance
  // Safari drops a speak() issued right after cancel(), so only cancel when needed and wait a beat.
  if (synth.speaking || synth.pending) {
    synth.cancel()
    setTimeout(() => synth.speak(utterance), 120)
  } else {
    synth.speak(utterance)
  }
}

function speakAsDog(text: string) {
  speak(text, 1.5, 1.05)
}

// Dogs respond to familiar cue words in a bright, slow tone, so calls use a clearer voice.
function callDog(text: string) {
  speak(text, 1.3, 0.9)
}

const CALLS: { icon: string; label: string; line: (name: string) => string }[] = [
  { icon: "🐾", label: "이리 와", line: (n) => `${n}! 이리 와!` },
  { icon: "🦴", label: "간식", line: (n) => `${n}! 간식 먹자!` },
  { icon: "🦮", label: "산책", line: (n) => `${n}! 산책 가자!` },
  { icon: "🪑", label: "앉아", line: (n) => `${n}, 앉아!` },
  { icon: "👍", label: "잘했어", line: (n) => `${n}, 잘했어! 착하다!` },
  { icon: "🌙", label: "잘 자", line: (n) => `${n}, 잘 자` },
]

// iOS only lets speech start inside a tap, so prime it with a silent utterance on each tap.
function unlockSpeech() {
  if (canSpeak()) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""))
}

function stopSpeech() {
  if (canSpeak()) window.speechSynthesis.cancel()
}

function drawToJpeg(canvas: HTMLCanvasElement, source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, 640 / Math.max(width, height))
  canvas.width = width * scale
  canvas.height = height * scale
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.85)
}

export default function DogChatPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<Mode>("idle")
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [emotion, setEmotion] = useState<Emotion | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [dogMissing, setDogMissing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [inputText, setInputText] = useState("")
  const [heard, setHeard] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speakOn, setSpeakOn] = useState(true)
  const [soundError, setSoundError] = useState<string | null>(null)

  const dogName = useSyncExternalStore(subscribeName, readName, () => "")
  const voiceSupported = useSyncExternalStore(noopSubscribe, () => getRecognitionCtor() !== null, () => false)
  const speechSupported = useSyncExternalStore(noopSubscribe, canSpeak, () => false)
  const isIOS = useSyncExternalStore(noopSubscribe, () => /iPhone|iPad|iPod/.test(navigator.userAgent), () => false)
  const isAndroid = useSyncExternalStore(noopSubscribe, () => /Android/.test(navigator.userAgent), () => false)
  const isInstalled = useSyncExternalStore(
    noopSubscribe,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => true,
  )

  // Timers, recognition and speech callbacks outlive renders, so they read live values from refs.
  const modeRef = useRef<Mode>("idle")
  const emotionRef = useRef<Emotion | null>(null)
  const messagesRef = useRef<Message[]>([])
  const busyRef = useRef(false)
  const analyzingRef = useRef(false)
  const micOnRef = useRef(false)
  const speakOnRef = useRef(true)
  const speakingRef = useRef(false)
  const heardRef = useRef("")
  const recognitionRef = useRef<Recognition | null>(null)
  const quickEndsRef = useRef(0)
  const lastActivityRef = useRef(0)
  const sessionRef = useRef(0)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const actionsRef = useRef({ tick: () => {}, resumeListening: () => {}, pauseListening: () => {} })

  function updateEmotion(e: Emotion | null) {
    emotionRef.current = e
    setEmotion(e)
  }

  function updateMessages(m: Message[]) {
    messagesRef.current = m
    setMessages(m)
  }

  function setBusy(b: boolean) {
    busyRef.current = b
    setIsSending(b)
  }

  function updateHeard(text: string) {
    heardRef.current = text
    setHeard(text)
  }

  useEffect(() => {
    actionsRef.current = { tick, resumeListening: startListening, pauseListening }
  })

  useEffect(() => {
    let stream: MediaStream | null = null
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } catch {
          setCameraError("카메라에 접근할 수 없어요. 브라우저 권한을 확인하거나 🖼️로 사진을 골라 주세요.")
          return
        }
      }
      if (videoRef.current) videoRef.current.srcObject = stream
    }
    start()
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  useEffect(() => {
    speechErrorListener = (code) => setSoundError(code)
    speechStateListener = (speaking) => {
      speakingRef.current = speaking
      // Pause the mic while the dog talks so it doesn't transcribe its own voice.
      if (speaking) actionsRef.current.pauseListening()
      else actionsRef.current.resumeListening()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && modeRef.current === "live") requestWakeLock()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      speechErrorListener = null
      speechStateListener = null
      document.removeEventListener("visibilitychange", onVisible)
      recognitionRef.current?.abort()
      wakeLockRef.current?.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (mode !== "live") return
    const id = setInterval(() => actionsRef.current.tick(), AUTO_READ_MS)
    return () => clearInterval(id)
  }, [mode])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  function requestWakeLock() {
    if (!("wakeLock" in navigator)) return
    navigator.wakeLock
      .request("screen")
      .then((lock) => {
        wakeLockRef.current = lock
      })
      .catch(() => {})
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return null
    return drawToJpeg(canvas, video, video.videoWidth, video.videoHeight)
  }

  function startListening() {
    if (!micOnRef.current || recognitionRef.current || speakingRef.current || busyRef.current) return
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.lang = "ko-KR"
    recognition.interimResults = true
    let finalText = ""
    let gotResult = false
    const startedAt = Date.now()
    recognition.onresult = (e) => {
      const result = e.results[e.results.length - 1]
      gotResult = true
      quickEndsRef.current = 0
      updateHeard(result[0].transcript)
      if (result.isFinal) finalText = result[0].transcript
    }
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        turnMicOff("마이크를 쓸 수 없어요. 브라우저에서 마이크를 허용한 뒤 🎤를 눌러 주세요.")
      }
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setIsListening(false)
      updateHeard("")
      if (finalText.trim()) {
        handleSend(finalText)
        return
      }
      if (!gotResult && Date.now() - startedAt < 1500) quickEndsRef.current += 1
      if (quickEndsRef.current >= 5) {
        turnMicOff("자동 듣기가 자꾸 끊겨서 멈췄어요. 🎤를 눌러 다시 켜 주세요.")
        return
      }
      if (micOnRef.current) setTimeout(() => actionsRef.current.resumeListening(), 400)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      recognitionRef.current = null
      turnMicOff("자동 듣기를 시작하지 못했어요. 🎤를 눌러 다시 켜 주세요.")
    }
  }

  function pauseListening() {
    const recognition = recognitionRef.current
    if (!recognition) return
    recognitionRef.current = null
    recognition.abort()
  }

  function turnMicOff(message?: string) {
    micOnRef.current = false
    setMicOn(false)
    pauseListening()
    if (message) setErrorMsg(message)
  }

  function toggleMic() {
    if (micOnRef.current) {
      turnMicOff()
      return
    }
    lastActivityRef.current = Date.now()
    micOnRef.current = true
    quickEndsRef.current = 0
    setMicOn(true)
    setErrorMsg(null)
    stopSpeech()
    speakingRef.current = false
    unlockSpeech()
    startListening()
  }

  function toggleSpeak() {
    const next = !speakOnRef.current
    speakOnRef.current = next
    setSpeakOn(next)
    if (next) unlockSpeech()
    else stopSpeech()
  }

  function resetSession() {
    sessionRef.current += 1
    pauseListening()
    stopSpeech()
    speakingRef.current = false
    analyzingRef.current = false
    setAnalyzing(false)
    setBusy(false)
    updateEmotion(null)
    updateMessages([])
    updateHeard("")
    setStreamingText("")
    setInputText("")
    setErrorMsg(null)
    setDogMissing(false)
    setPhotoUrl(null)
  }

  function stopAll(notice?: string) {
    resetSession()
    turnMicOff()
    releaseWakeLock()
    modeRef.current = "idle"
    setMode("idle")
    if (notice) setErrorMsg(notice)
  }

  async function analyze(dataUrl: string, quick: boolean): Promise<Emotion | "no-dog" | null> {
    const session = sessionRef.current
    analyzingRef.current = true
    setAnalyzing(true)
    try {
      const res = await fetch("/api/dog-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, quick }),
      })
      const data = await res.json()
      if (session !== sessionRef.current) return null
      if (res.status === 422) {
        setDogMissing(true)
        return "no-dog"
      }
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? "감정 분석에 실패했습니다.")
        return null
      }
      setDogMissing(false)
      const next: Emotion = { label: data.label, reason: data.reason }
      updateEmotion(next)
      return next
    } catch {
      if (session === sessionRef.current) setErrorMsg("네트워크 오류가 발생했습니다.")
      return null
    } finally {
      if (session === sessionRef.current) {
        analyzingRef.current = false
        setAnalyzing(false)
      }
    }
  }

  async function dogSpeak(history: Message[], event?: "greet" | "mood") {
    const current = emotionRef.current
    if (!current) return
    const session = sessionRef.current
    setBusy(true)
    pauseListening()
    setStreamingText("")
    let fullText = ""
    try {
      const res = await fetch("/api/dog-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emotion: emotionForChat(current),
          messages: history.slice(-HISTORY_LIMIT),
          event,
          dogName: readName().trim(),
        }),
      })
      if (!res.ok || !res.body) {
        if (session === sessionRef.current) setErrorMsg("대화 생성에 실패했습니다.")
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (session !== sessionRef.current) {
          reader.cancel()
          return
        }
        fullText += decoder.decode(value, { stream: true })
        setStreamingText(fullText)
      }
      updateMessages([...history, { role: "assistant", content: fullText }])
      if (speakOnRef.current && fullText.trim()) {
        speakAsDog(fullText)
        // If the phone never starts speaking (muted, blocked), don't leave the mic paused forever.
        setTimeout(() => {
          if (!speakingRef.current) actionsRef.current.resumeListening()
        }, 1500)
      }
    } catch {
      if (session === sessionRef.current) setErrorMsg("네트워크 오류가 발생했습니다.")
    } finally {
      if (session === sessionRef.current) {
        setStreamingText("")
        setBusy(false)
        if (!speakOnRef.current) actionsRef.current.resumeListening()
      }
    }
  }

  async function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !emotionRef.current || busyRef.current) return
    lastActivityRef.current = Date.now()
    setInputText("")
    setErrorMsg(null)
    const next: Message[] = [...messagesRef.current, { role: "user", content: trimmed }]
    updateMessages(next)
    await dogSpeak(next)
  }

  async function tick() {
    if (modeRef.current !== "live" || document.hidden || analyzingRef.current || busyRef.current) return
    if (Date.now() - lastActivityRef.current > IDLE_STOP_MS) {
      stopAll("30분 동안 대화가 없어서 자동으로 멈췄어요. 다시 시작하려면 ▶️를 눌러 주세요.")
      return
    }
    const frame = captureFrame()
    if (!frame) return
    const previous = emotionRef.current?.label
    const next = await analyze(frame, true)
    if (!next || next === "no-dog" || modeRef.current !== "live") return
    // Don't talk over the owner mid-sentence or over a reply in progress.
    if (busyRef.current || heardRef.current) return
    if (!previous) await dogSpeak(messagesRef.current, messagesRef.current.length ? "mood" : "greet")
    else if (next.label !== previous) await dogSpeak(messagesRef.current, "mood")
  }

  async function startLive() {
    const frame = captureFrame()
    if (!frame) {
      setErrorMsg("카메라가 아직 준비되지 않았어요. 잠시 후 다시 눌러 주세요.")
      return
    }
    unlockSpeech()
    resetSession()
    modeRef.current = "live"
    setMode("live")
    lastActivityRef.current = Date.now()
    requestWakeLock()
    if (voiceSupported) {
      micOnRef.current = true
      quickEndsRef.current = 0
      setMicOn(true)
      startListening()
    }
    const first = await analyze(frame, false)
    if (first && first !== "no-dog" && modeRef.current === "live") await dogSpeak([], "greet")
  }

  async function lookCloser() {
    const frame = captureFrame()
    if (!frame || analyzingRef.current) return
    lastActivityRef.current = Date.now()
    unlockSpeech()
    const previous = emotionRef.current?.label
    const next = await analyze(frame, false)
    if (!next || next === "no-dog" || busyRef.current) return
    if (!previous) await dogSpeak(messagesRef.current, messagesRef.current.length ? "mood" : "greet")
    else if (next.label !== previous) await dogSpeak(messagesRef.current, "mood")
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    // Phone photos exceed Vercel's 4.5MB request limit, so downscale to JPEG like the camera path.
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      URL.revokeObjectURL(url)
      const canvas = canvasRef.current
      if (!canvas) return
      const dataUrl = drawToJpeg(canvas, img, img.width, img.height)
      resetSession()
      releaseWakeLock()
      turnMicOff()
      modeRef.current = "photo"
      setMode("photo")
      setPhotoUrl(dataUrl)
      const result = await analyze(dataUrl, false)
      if (result && result !== "no-dog") await dogSpeak([], "greet")
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setErrorMsg("이미지를 열 수 없습니다. 다른 사진을 선택해 주세요.")
    }
    img.src = url
  }

  const active = mode !== "idle"
  const callName = dogName.trim() || "멍멍이"

  const callButtons = speechSupported && (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">
        📣 {callName} 부르기 · 아는 말을 밝은 목소리로 들려줘요
      </span>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {CALLS.map((c) => (
          <Button
            key={c.label}
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full h-9 px-3"
            onClick={() => {
              setSoundError(null)
              lastActivityRef.current = Date.now()
              pauseListening()
              callDog(c.line(callName))
            }}
          >
            {c.icon} {c.label}
          </Button>
        ))}
      </div>
      {soundError && (
        <p className="text-xs text-destructive">
          소리를 낼 수 없어요 (오류: {soundError}). 새로고침한 뒤 다시 눌러 주세요.
        </p>
      )}
      {isIOS && (
        <p className="text-xs text-muted-foreground">
          🔕 소리가 안 나면 아이폰 무음 모드를 꺼 주세요 (옆면 스위치 또는 제어 센터의 🔔)
        </p>
      )}
    </div>
  )

  const statusText = analyzing
    ? "표정 읽는 중..."
    : dogMissing
      ? "화면에 강아지가 안 보여요"
      : "15초마다 표정 읽는 중"

  return (
    <main className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 px-4 py-3 border-b bg-card">
        <span className="text-xl">🐶</span>
        <h1 className="font-semibold text-base">{dogName.trim() || "강아지 감정 탐지기"}</h1>
        <div className="ml-auto flex items-center gap-1">
          {speechSupported && (
            <Button
              variant="ghost"
              size="sm"
              className="text-sm"
              onClick={toggleSpeak}
              title={speakOn ? "음성 끄기" : "음성 켜기"}
            >
              {speakOn ? "🔊 소리 켬" : "🔇 소리 끔"}
            </Button>
          )}
          {active && (
            <Button variant="ghost" size="sm" className="text-sm" onClick={() => stopAll()}>
              {mode === "live" ? "⏹️ 멈추기" : "처음으로"}
            </Button>
          )}
        </div>
      </header>

      <section
        className={cn("relative overflow-hidden bg-black", active ? "h-[36svh] shrink-0" : "flex-1 min-h-0")}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn("w-full h-full object-cover", mode === "photo" && "hidden")}
        />
        {mode === "photo" && photoUrl && (
          <img src={photoUrl} alt="선택한 강아지 사진" className="w-full h-full object-cover" />
        )}
        {cameraError && mode !== "photo" && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white">
            {cameraError}
          </div>
        )}
        {emotion && (
          <div className="absolute top-3 inset-x-3 flex flex-col items-start gap-1.5">
            <Badge className="text-sm px-3 py-1 gap-1.5 bg-white/90 text-foreground shadow-md">
              {EMOTION_EMOJI[emotion.label] ?? "🐾"}
              <span className="font-semibold">{EMOTION_KR[emotion.label] ?? emotion.label}</span>
            </Badge>
            <p
              className={cn(
                "rounded-xl bg-white/90 px-3 py-2 text-xs leading-relaxed text-foreground shadow-md",
                active && "line-clamp-3",
              )}
            >
              {emotion.reason}
            </p>
          </div>
        )}
        {mode === "live" && (
          <>
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {statusText}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-3 right-3 h-8 rounded-full"
              disabled={analyzing}
              onClick={lookCloser}
            >
              🔍 자세히 보기
            </Button>
          </>
        )}
        {mode === "photo" && (analyzing || dogMissing) && (
          <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
            {analyzing ? "표정 읽는 중..." : "사진에서 강아지를 찾지 못했어요"}
          </div>
        )}
      </section>

      {!active ? (
        <section className="flex flex-col gap-3 p-4 border-t bg-card">
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">우리 강아지 이름</span>
            <Input
              value={dogName}
              onChange={(e) => saveName(e.target.value)}
              placeholder="예: 뽀식이"
              maxLength={20}
              className="h-10 rounded-xl"
            />
          </label>

          {callButtons}

          {errorMsg && (
            <p className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              size="lg"
              className="flex-1 h-14 text-base font-semibold"
              disabled={!!cameraError}
              onClick={startLive}
            >
              ▶️ 대화 시작
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 px-5 text-xl"
              title="갤러리에서 사진 선택"
              onClick={() => {
                unlockSpeech()
                fileInputRef.current?.click()
              }}
            >
              🖼️
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            시작하면 카메라와 마이크가 켜진 채로 15초마다 표정을 읽고, 말을 걸면 바로 대답해요.
          </p>
          {!isInstalled && (isIOS || isAndroid) && (
            <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs leading-relaxed">
              📲 <b>앱처럼 쓰기</b>:{" "}
              {isIOS
                ? "사파리 아래쪽 공유 버튼(네모에 위쪽 화살표)을 누르고 '홈 화면에 추가'를 누르세요."
                : "크롬 오른쪽 위 메뉴(⋮)에서 '홈 화면에 추가'를 누르세요."}{" "}
              홈 화면의 🐶 아이콘으로 바로 열 수 있어요.
            </p>
          )}
        </section>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && !streamingText && (
              <p className="text-center text-sm text-muted-foreground">
                {analyzing
                  ? `${callName}의 표정을 읽고 있어요...`
                  : dogMissing
                    ? "강아지 얼굴이 잘 보이게 카메라를 비춰 주세요."
                    : ""}
              </p>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && <span className="text-lg mr-2 self-end mb-0.5">🐶</span>}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-bl-sm",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {streamingText && (
              <div className="flex justify-start">
                <span className="text-lg mr-2 self-end mb-0.5">🐶</span>
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  {streamingText}
                  <span className="animate-pulse">▍</span>
                </div>
              </div>
            )}

            {isSending && !streamingText && (
              <div className="flex justify-start">
                <span className="text-lg mr-2">🐶</span>
                <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex gap-1 items-center h-4">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {callButtons && <div className="px-4 pt-3 border-t bg-card">{callButtons}</div>}
          {errorMsg && (
            <p className={cn("px-4 pt-3 text-sm text-destructive bg-card", !callButtons && "border-t")}>{errorMsg}</p>
          )}
          {heard && <p className="px-4 pt-2 text-sm text-muted-foreground bg-card">🎙️ {heard}</p>}

          <div className={cn("flex gap-2 p-4 bg-card", !callButtons && !errorMsg && "border-t")}>
            {voiceSupported && (
              <Button
                size="lg"
                variant={micOn ? "default" : "outline"}
                className={cn("h-12 w-12 p-0 text-xl shrink-0", isListening && "ring-2 ring-red-400")}
                onClick={toggleMic}
                title={micOn ? "듣기 끄기" : "듣기 켜기"}
              >
                {micOn ? "🎙️" : "🎤"}
              </Button>
            )}
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(inputText)
                }
              }}
              placeholder={micOn ? "그냥 말하면 돼요 (입력도 가능)" : `${callName}에게 말 걸기...`}
              disabled={isSending}
              className="flex-1 h-12 rounded-xl"
            />
            <Button
              size="lg"
              className="h-12 px-5"
              onClick={() => handleSend(inputText)}
              disabled={!inputText.trim() || isSending || !emotion}
            >
              전송
            </Button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
    </main>
  )
}
