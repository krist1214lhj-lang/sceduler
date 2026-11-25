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

type Emotion = { label: string; reason: string }

function emotionForChat(e: Emotion) {
  return `${EMOTION_KR[e.label] ?? e.label} (${e.reason})`
}

type Phase = "idle" | "detecting" | "streaming" | "chat" | "error"
type Message = { role: "user" | "assistant"; content: string }

type Recognition = {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
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
  utterance.onerror = (e) => {
    if (e.error !== "canceled" && e.error !== "interrupted") speechErrorListener?.(e.error)
  }
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null
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

export default function DogChatPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<Phase>("idle")
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [emotion, setEmotion] = useState<Emotion | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState("")
  const [inputText, setInputText] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const dogName = useSyncExternalStore(subscribeName, readName, () => "")
  const voiceSupported = useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== null,
    () => false,
  )
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  const speechSupported = useSyncExternalStore(noopSubscribe, canSpeak, () => false)
  const [speakOn, setSpeakOn] = useState(true)
  const speakOnRef = useRef(true)
  const [soundError, setSoundError] = useState<string | null>(null)
  const isIOS = useSyncExternalStore(
    noopSubscribe,
    () => /iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false,
  )

  useEffect(() => {
    speechErrorListener = (code) => setSoundError(code)
    return () => {
      speechErrorListener = null
    }
  }, [])

  function toggleSpeak() {
    const next = !speakOnRef.current
    speakOnRef.current = next
    setSpeakOn(next)
    if (next) unlockSpeech()
    else stopSpeech()
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } catch {
          setErrorMsg("카메라에 접근할 수 없습니다. 브라우저 권한을 확인해 주세요.")
          return
        }
      }
      if (videoRef.current) videoRef.current.srcObject = stream
    }
    start()
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  function handleCapture() {
    unlockSpeech()
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const maxSize = 640
    const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = video.videoWidth * scale
    canvas.height = video.videoHeight * scale
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
    setCapturedDataUrl(dataUrl)
    runAnalysis(dataUrl)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    // Phone photos exceed Vercel's 4.5MB request limit, so downscale to JPEG like the camera path.
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = canvasRef.current
      if (!canvas) return
      const maxSize = 640
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
      setCapturedDataUrl(dataUrl)
      runAnalysis(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setErrorMsg("이미지를 열 수 없습니다. 다른 사진을 선택해 주세요.")
      setPhase("error")
    }
    img.src = url
  }

  async function runAnalysis(dataUrl: string) {
    setPhase("detecting")
    setEmotion(null)
    setMessages([])
    setStreamingText("")
    setErrorMsg(null)

    try {
      const emotionRes = await fetch("/api/dog-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      })
      const emotionData = await emotionRes.json()

      if (!emotionRes.ok || emotionData.error) {
        setErrorMsg(emotionData.error ?? "감정 분석에 실패했습니다.")
        setPhase("error")
        return
      }

      const detectedEmotion: Emotion = { label: emotionData.label, reason: emotionData.reason }
      setEmotion(detectedEmotion)

      setPhase("streaming")
      await streamDogResponse(emotionForChat(detectedEmotion), [], true)
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.")
      setPhase("error")
    }
  }

  async function streamDogResponse(
    emotionLabel: string,
    history: Message[],
    isInitial: boolean,
  ) {
    setIsSending(true)
    setStreamingText("")
    let fullText = ""

    try {
      const res = await fetch("/api/dog-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emotion: emotionLabel,
          messages: history,
          isInitial,
          dogName: dogName.trim(),
        }),
      })

      if (!res.ok || !res.body) {
        setErrorMsg("대화 생성에 실패했습니다.")
        setPhase("error")
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setStreamingText(fullText)
      }

      setMessages((prev) => [...prev, { role: "assistant", content: fullText }])
      if (speakOnRef.current) speakAsDog(fullText)
      setStreamingText("")
      setPhase("chat")
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.")
      setPhase("error")
    } finally {
      setIsSending(false)
    }
  }

  async function handleSend(text = inputText) {
    if (!text.trim() || !emotion || isSending) return
    unlockSpeech()
    const userMsg: Message = { role: "user", content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputText("")
    await streamDogResponse(emotionForChat(emotion), newMessages, false)
  }

  function handleVoice() {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    // Stop the dog talking so the mic doesn't transcribe its voice.
    stopSpeech()
    unlockSpeech()
    const recognition = new Ctor()
    recognition.lang = "ko-KR"
    recognition.interimResults = true
    let finalText = ""
    recognition.onresult = (e) => {
      const result = e.results[e.results.length - 1]
      setInputText(result[0].transcript)
      if (result.isFinal) finalText = result[0].transcript
    }
    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setErrorMsg("마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요.")
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      if (finalText.trim()) handleSend(finalText)
    }
    recognitionRef.current = recognition
    setErrorMsg(null)
    setIsListening(true)
    recognition.start()
  }

  function handleReset() {
    recognitionRef.current?.stop()
    stopSpeech()
    setCapturedDataUrl(null)
    setEmotion(null)
    setMessages([])
    setStreamingText("")
    setInputText("")
    setErrorMsg(null)
    setPhase("idle")
  }

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
            disabled={isListening}
            onClick={() => {
              setSoundError(null)
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

  const isAnalyzing = phase === "detecting" || phase === "streaming"
  const inChat = phase === "chat" || (phase === "streaming" && messages.length > 0)

  return (
    <main className="flex min-h-svh flex-col bg-background">
      {/* Header */}
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
          {inChat && (
            <Button variant="ghost" size="sm" className="text-sm" onClick={handleReset}>
              새로 시작
            </Button>
          )}
        </div>
      </header>

      {!inChat ? (
        <>
          {/* Camera / Image area */}
          <section className="relative flex-1 overflow-hidden bg-black min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn("w-full h-full object-cover", capturedDataUrl && "hidden")}
            />
            {capturedDataUrl && (
              <img
                src={capturedDataUrl}
                alt="캡처된 강아지"
                className="w-full h-full object-cover"
              />
            )}
            {emotion && (
              <div className="absolute top-3 inset-x-3 flex flex-col items-start gap-1.5">
                <Badge className="text-sm px-3 py-1 gap-1.5 bg-white/90 text-foreground shadow-md">
                  {EMOTION_EMOJI[emotion.label] ?? "🐾"}
                  <span className="font-semibold">{EMOTION_KR[emotion.label] ?? emotion.label}</span>
                </Badge>
                <p className="rounded-xl bg-white/90 px-3 py-2 text-xs leading-relaxed text-foreground shadow-md">
                  {emotion.reason}
                </p>
              </div>
            )}
            {!capturedDataUrl && errorMsg?.includes("카메라") && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm px-6 text-center">
                {errorMsg}
              </div>
            )}
          </section>

          {/* Bottom panel */}
          <section className="flex flex-col gap-3 p-4 border-t bg-card min-h-[180px]">
            {isAnalyzing && (
              <div className="flex flex-col gap-2">
                <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
                <div className="h-16 rounded-2xl bg-muted animate-pulse" />
              </div>
            )}

            {phase === "streaming" && streamingText && (
              <div className="relative rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                <div className="absolute -top-2.5 left-6 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[10px] border-l-transparent border-r-transparent border-b-amber-200 dark:border-b-amber-800" />
                <div className="absolute -top-2 left-[26px] w-0 h-0 border-l-[9px] border-r-[9px] border-b-[9px] border-l-transparent border-r-transparent border-b-amber-50 dark:border-b-amber-950/30" />
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {streamingText}
                  <span className="animate-pulse">▍</span>
                </p>
              </div>
            )}

            {phase === "error" && errorMsg && !errorMsg.includes("카메라") && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            {phase === "idle" && (
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
            )}

            {phase === "idle" && callButtons}

            <div className="flex gap-2 mt-auto">
              <Button
                size="lg"
                className="flex-1 h-14 text-base font-semibold"
                disabled={isAnalyzing}
                onClick={phase === "error" ? handleReset : handleCapture}
              >
                {phase === "idle" && "📸 사진 찍기"}
                {phase === "detecting" && "🔍 감정 분석 중..."}
                {phase === "streaming" && "💬 말 생성 중..."}
                {phase === "error" && "🔄 다시 시도"}
              </Button>
              {(phase === "idle" || phase === "error") && (
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
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Thumbnail + emotion badge */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-card/50">
            {capturedDataUrl && (
              <img
                src={capturedDataUrl}
                alt="강아지"
                className="w-12 h-12 rounded-xl object-cover border"
              />
            )}
            {emotion && (
              <div className="flex flex-col items-start gap-1 min-w-0">
                <Badge className="text-sm px-3 py-1 gap-1.5 bg-white/90 text-foreground shadow-sm border">
                  {EMOTION_EMOJI[emotion.label] ?? "🐾"}
                  <span className="font-semibold">{EMOTION_KR[emotion.label] ?? emotion.label}</span>
                </Badge>
                <p className="text-xs leading-snug text-muted-foreground">{emotion.reason}</p>
              </div>
            )}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <span className="text-lg mr-2 self-end mb-0.5">🐶</span>
                )}
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

            {/* Streaming bubble */}
            {streamingText && (
              <div className="flex justify-start">
                <span className="text-lg mr-2 self-end mb-0.5">🐶</span>
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  {streamingText}
                  <span className="animate-pulse">▍</span>
                </div>
              </div>
            )}

            {/* Typing indicator */}
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

          {/* Chat input */}
          {errorMsg && (
            <p className={cn("px-4 pt-3 text-sm text-destructive bg-card", !callButtons && "border-t")}>{errorMsg}</p>
          )}
          <div className={cn("flex gap-2 p-4 bg-card", !errorMsg && !callButtons && "border-t")}>
            {voiceSupported && (
              <Button
                size="lg"
                variant={isListening ? "destructive" : "outline"}
                className={cn("h-12 w-12 p-0 text-xl shrink-0", isListening && "animate-pulse")}
                onClick={handleVoice}
                disabled={isSending}
                title={isListening ? "듣는 중 (눌러서 멈추기)" : "음성으로 말하기"}
              >
                {isListening ? "⏹️" : "🎤"}
              </Button>
            )}
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={isListening ? "듣고 있어요... 말해보세요" : `${dogName.trim() || "강아지"}에게 말 걸기...`}
              disabled={isSending || isListening}
              className="flex-1 h-12 rounded-xl"
            />
            <Button
              size="lg"
              className="h-12 px-5"
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isSending || isListening}
            >
              전송
            </Button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </main>
  )
}
