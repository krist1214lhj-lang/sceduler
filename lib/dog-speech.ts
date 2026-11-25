const NAME_KEY = "dogName"
let memoryName = ""
const nameListeners = new Set<() => void>()

export function subscribeName(listener: () => void) {
  nameListeners.add(listener)
  return () => nameListeners.delete(listener)
}

export function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? memoryName
  } catch {
    return memoryName
  }
}

export function saveName(name: string) {
  memoryName = name
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {}
  nameListeners.forEach((l) => l())
}

export const noopSubscribe = () => () => {}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

const EMOJI = new RegExp("[\\p{Extended_Pictographic}\\u200d\\ufe0f]", "gu")

let onSpeechState: ((speaking: boolean) => void) | null = null
let onSpeechError: ((code: string) => void) | null = null
// Safari can garbage-collect an utterance mid-speech, so keep the current one alive.
let currentUtterance: SpeechSynthesisUtterance | null = null

export function setSpeechListeners(
  listeners: { onState?: (speaking: boolean) => void; onError?: (code: string) => void } | null,
) {
  onSpeechState = listeners?.onState ?? null
  onSpeechError = listeners?.onError ?? null
}

export function speak(text: string, pitch: number, rate: number) {
  if (!canSpeak()) return
  const clean = text.replace(EMOJI, "").replace(/~/g, "").trim()
  if (!clean) return
  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(clean)
  // No explicit voice: iOS can list voices that aren't installed, and picking one plays silence.
  utterance.lang = "ko-KR"
  utterance.pitch = pitch
  utterance.rate = rate
  utterance.onstart = () => onSpeechState?.(true)
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null
    onSpeechState?.(false)
  }
  utterance.onerror = (e) => {
    onSpeechState?.(false)
    if (e.error !== "canceled" && e.error !== "interrupted") onSpeechError?.(e.error)
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

// iOS only lets speech start inside a tap, so prime it with a silent utterance on each tap.
export function unlockSpeech() {
  if (canSpeak()) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""))
}

export function stopSpeech() {
  if (canSpeak()) window.speechSynthesis.cancel()
}
