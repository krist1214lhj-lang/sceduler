// KakaoTalk channel chatbot skill (Kakao i Open Builder).
// Open Builder POSTs each message here; we answer with 뽀식이's reply and a pose picture.
// Rule based and instant: no AI service is called, so it costs nothing and fits Kakao's 5-second limit.
// The words and tricks come from the desktop pet's brain (desktop-pet/src/brain.js), so both stay the same.
import { dogReply } from "@/lib/dog-brain"

const DOG_NAME = "뽀식이"

const QUICK_REPLIES = ["안녕!", "앉아", "손", "빵!", "얼굴!", "하이파이브", "우다다", "숨바꼭질", "간식 줄까?", "사랑해"]

type KakaoSkillRequest = {
  userRequest?: { utterance?: string }
}

function siteOrigin(request: Request) {
  // Behind Vercel the public host comes in these headers.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : new URL(request.url).origin
}

export async function POST(request: Request) {
  let utterance = ""
  try {
    const body = (await request.json()) as KakaoSkillRequest
    utterance = String(body.userRequest?.utterance ?? "").slice(0, 300)
  } catch {
    // An unreadable body still gets a friendly answer: Kakao shows an error otherwise.
  }

  const reply = dogReply(utterance, { name: DOG_NAME })
  const origin = siteOrigin(request)

  return Response.json({
    version: "2.0",
    template: {
      outputs: [
        { simpleImage: { imageUrl: `${origin}${reply.image}`, altText: reply.alt } },
        { simpleText: { text: reply.text } },
      ],
      quickReplies: QUICK_REPLIES.map((label) => ({ label, action: "message", messageText: label })),
    },
  })
}

// Opening the address in a browser shows that the skill is deployed.
export function GET() {
  return new Response(`${DOG_NAME} 카카오톡 챗봇 스킬 서버가 켜져 있어요. 왈! (카카오 i 오픈빌더 스킬 URL로 이 주소를 등록하세요)`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
