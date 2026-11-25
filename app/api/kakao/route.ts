// KakaoTalk channel chatbot skill (Kakao i Open Builder).
// Open Builder POSTs each message here; we answer with 뽀식이's reply and a pose picture.
// Rule based and instant: no AI service is called, so it costs nothing and fits Kakao's 5-second limit.
import { dogReply, type DogPose } from "@/lib/dog-brain"

const DOG_NAME = "뽀식이"

const QUICK_REPLIES = ["안녕!", "앉아", "손", "빵!", "얼굴!", "하이파이브", "간식 줄까?", "산책 가자", "사랑해", "잘 자"]

const POSE_ALT: Record<DogPose, string> = {
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
}

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
        { simpleImage: { imageUrl: `${origin}/ppo/kakao/${reply.pose}.jpg`, altText: POSE_ALT[reply.pose] } },
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
