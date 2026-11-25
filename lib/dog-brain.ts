// 뽀식이의 대화 for the KakaoTalk channel bot.
// The rules live in ONE place, desktop-pet/src/brain.js, shared with the desktop pet:
// change the brain there and both the desktop pet and the Kakao bot answer the new way.
import { reply } from "../desktop-pet/src/brain.js"
import poses from "./pet-poses.json"

export type DogContext = { name: string; ownerName?: string }
export type DogReply = { text: string; image: string; alt: string }

// Desktop actions that have no picture of their own borrow one that looks like them.
const PICTURE_FOR_ACTION: Record<string, string> = {
  wag: "front",
  happy: "jump",
  treat: "eat",
  ball: "run",
  come: "run",
  fetch: "run",
  spin: "run",
  chase: "run",
  nap: "sleep",
}

const ALT: Record<string, string> = {
  front: "웃고 있는 뽀식이",
  walk: "걷고 있는 뽀식이",
  run: "달려오는 뽀식이",
  sit: "앉아 있는 뽀식이",
  sleep: "엎드려 자는 뽀식이",
  jump: "신나서 점프하는 뽀식이",
  bow: "놀자고 엉덩이를 든 뽀식이",
  paw: "손을 내미는 뽀식이",
  eat: "밥 먹는 뽀식이",
  bang: "빵! 죽은 척하는 뽀식이",
  shy: "앞발로 얼굴 가린 뽀식이",
  highfive: "하이파이브 하는 뽀식이",
  beg: "두 발로 서서 애교 부리는 뽀식이",
  belly: "배 보이고 뒹구는 뽀식이",
  yawn: "하품하는 뽀식이",
  zoomies: "우다다 달리는 뽀식이",
  peek: "벽 뒤에서 빼꼼 내다보는 뽀식이",
}

// Big Kakao cards (public/ppo/kakao) look best; a new desktop trick without a card yet
// still gets its desktop picture (public/ppo/pose, copied at build time).
function pictureFor(action: string | undefined, name: string) {
  const pose = action ? (PICTURE_FOR_ACTION[action] ?? action) : "front"
  const alt = ALT[pose] ?? name
  if (poses.cards.includes(pose)) return { image: `/ppo/kakao/${pose}.jpg`, alt }
  if (poses.sprites.includes(pose)) return { image: `/ppo/pose/${pose}.png`, alt }
  return { image: "/ppo/kakao/front.jpg", alt: ALT.front }
}

export function dogReply(raw: string, ctx: DogContext): DogReply {
  const r = reply(raw, ctx)
  return { text: r.text, ...pictureFor(r.action, ctx.name) }
}
