// 뽀식이의 대화 두뇌 - free, rule based, no AI service. Used by the KakaoTalk channel bot.
// (The desktop pet has the same rules in desktop-pet/src/brain.js.)

export type DogPose =
  | "front" | "walk" | "run" | "sit" | "sleep" | "jump" | "bow" | "paw" | "eat"
  | "bang" | "shy" | "highfive" | "beg" | "belly" | "yawn"
export type DogReply = { text: string; pose: DogPose }
export type DogContext = { name: string; ownerName?: string }

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

// Server clocks run in UTC; the dog lives in Korea.
function koreaNow() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return { month: d.getUTCMonth() + 1, date: d.getUTCDate(), day: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }
}

const owner = (ctx: DogContext) => (ctx.ownerName ? `${ctx.ownerName}님` : "주인님")

type Rule = { test: RegExp; reply: (ctx: DogContext, m: RegExpMatchArray) => DogReply }

const RULES: Rule[] = [
  {
    test: /(내|제)\s*이름은\s*([가-힣A-Za-z0-9]{1,10})/,
    reply: (ctx, m) => {
      const n = m[2].replace(/(이야|야|예요|이에요|입니다|이라고|라고|요)$/, "")
      return { text: `${n}님! 반가워요! 왈왈! ${ctx.name}는 ${n}님이 벌써 좋아요~`, pose: "jump" }
    },
  },
  {
    test: /(너|네)\s*(이름|누구)|이름이\s*뭐/,
    reply: (ctx) => ({ text: pick([`저는 ${ctx.name}예요! 왈!`, `${ctx.name}! ${ctx.name}라고 불러주세요~`]), pose: "front" }),
  },
  { test: /(몇\s*살|나이)/, reply: () => ({ text: pick(["강아지 나이는 비밀이에요~ 헤헤", "마음은 영원한 아기 강아지예요!"]), pose: "sit" }) },
  { test: /(무슨\s*종|품종|견종)/, reply: () => ({ text: "살구색 토이푸들이에요! 곱슬곱슬 털 예쁘죠?", pose: "front" }) },

  { test: /앉아|앉자/, reply: () => ({ text: pick(["앉았어요! 착하죠?", "얌전히 앉았어요~ 간식 주실 거죠?"]), pose: "sit" }) },
  { test: /(빵|bang)/i, reply: () => ({ text: pick(["으악! 당했다… 꼴깍", "빵! …(죽은 척 중이에요)"]), pose: "bang" }) },
  { test: /(얼굴|부끄|가려|숨어)/, reply: () => ({ text: pick(["부끄부끄~ (얼굴 가림)", "아잉 몰라요~"]), pose: "shy" }) },
  { test: /(하이\s*파이브|하이5|짝)/, reply: () => ({ text: pick(["하이파이브! 짝!", "손바닥 짝! 왈!"]), pose: "highfive" }) },
  { test: /(애교|주세요|부탁|두\s*발|서\s*봐)/, reply: () => ({ text: pick(["주세요~ 주세요~ (두 발로 서기)", "애교 발사! 헤헤"]), pose: "beg" }) },
  { test: /(뒹굴|구르|배\s*(보여|만져|쓰담|긁)|배꼽)/, reply: () => ({ text: pick(["배 쓰담쓰담 해주세요~", "뒹굴뒹굴~ 기분 좋다!"]), pose: "belly" }) },
  { test: /(하품|아함|하아암)/, reply: () => ({ text: "하아암~ 저도 하품 나와요…", pose: "yawn" }) },
  { test: /^손|손\s*(줘|!)|악수/, reply: () => ({ text: pick(["손! 여기요~", "자, 손! 멍!"]), pose: "paw" }) },
  { test: /(엎드려|누워|코\s*자|낮잠|자자|자러|잘\s*자|굿\s*나잇|졸려)/, reply: () => ({ text: pick(["네에… 새근새근… zzz", "잘 자요~ 저도 잘게요… zzz"]), pose: "sleep" }) },
  { test: /(점프|뛰어)/, reply: () => ({ text: pick(["점프! 왈왈!", "높이 뛰었죠?!"]), pose: "jump" }) },
  { test: /(돌아|빙글|회전)/, reply: () => ({ text: "빙글빙글~ 어지러워요 헤헤", pose: "run" }) },
  { test: /(이리\s*와|와\s*봐|컴온|come)/i, reply: (ctx) => ({ text: `${owner(ctx)}! 달려가요~!`, pose: "run" }) },
  { test: /(산책|나가자|걷자)/, reply: () => ({ text: pick(["산책?! 신난다! 킁킁~", "산책 좋아요! 총총총~"]), pose: "walk" }) },
  { test: /(공\s*놀이|공\s*던|공\s*줄|공놀이|공\s*가져)/, reply: () => ({ text: "공이다!! 던져주세요! 우다다다!", pose: "run" }) },
  { test: /(간식|밥|먹자|맘마|까까|껌)/, reply: () => ({ text: pick(["간식!!! 냠냠 최고예요!", "냠냠 할 시간이다! 꼬리 붕붕~"]), pose: "eat" }) },
  { test: /(놀자|놀아|심심)/, reply: () => ({ text: pick(["좋아요! 놀아요 놀아요!", "같이 놀아요! (엉덩이 번쩍)"]), pose: "bow" }) },
  { test: /(기지개|스트레칭)/, reply: () => ({ text: "쭈욱~ 기지개! 같이 해요!", pose: "bow" }) },

  { test: /(사랑해|좋아해|러브|love)/i, reply: (ctx) => ({ text: pick([`저도 ${owner(ctx)} 사랑해요! 💗`, "저도요저도요! 세상에서 제일 많이!", "헤헤 꼬리가 멈추질 않아요~"]), pose: "jump" }) },
  { test: /(귀여|예쁘|이뻐|이쁘|최고|멋있|착하|잘했)/, reply: () => ({ text: pick(["헤헤 칭찬 좋아요!", "부끄러워요~ 꼬리 살랑살랑", "칭찬 받으니 간식도 받고 싶어요!"]), pose: "front" }) },
  { test: /(쓰담|쓰다듬|만져)/, reply: () => ({ text: "쓰담쓰담 최고예요~ 더 해주세요!", pose: "front" }) },
  { test: /(바보|멍청|미워|싫어|저리\s*가|나빠)/, reply: () => ({ text: pick(["힝… 삐졌어요…", "그런 말 하면 슬퍼요… 낑낑"]), pose: "sleep" }) },
  { test: /(미안|죄송)/, reply: () => ({ text: "괜찮아요! 금방 다 잊었어요~ 왈!", pose: "front" }) },
  { test: /(고마워|고맙|땡큐|감사)/, reply: () => ({ text: pick(["저도 고마워요! 멍!", "헤헤 언제든지요~"]), pose: "sit" }) },

  { test: /(힘들|피곤|지쳤|지친|우울|슬퍼|슬프|속상|외로|짜증|스트레스|울고)/, reply: (ctx) => ({ text: pick([`${owner(ctx)}, 오늘 많이 힘들었구나… 제가 옆에 있을게요.`, "토닥토닥… 잠깐 쉬어요. 제가 지켜줄게요!", "힘내요! 제가 꼬리 흔들어 줄게요~ 살랑살랑"]), pose: "sit" }) },
  { test: /(배고|배\s*고)/, reply: () => ({ text: "저도 배고파요! 같이 간식 먹어요!", pose: "eat" }) },
  { test: /(기분|컨디션).*(어때|좋아|어떠)|잘\s*지내/, reply: () => ({ text: pick(["완전 좋아요! 왈왈!", "주인님이랑 얘기해서 행복해요~"]), pose: "jump" }) },
  { test: /(뭐\s*해|뭐하|뭐\s*하)/, reply: () => ({ text: pick(["주인님 기다리고 있었어요!", "산책 갈 생각 중이에요~", "꼬리 잡기 연습 중이에요!"]), pose: "walk" }) },

  {
    test: /(몇\s*시|시간)/,
    reply: () => {
      const t = koreaNow()
      const ap = t.hour < 12 ? "오전" : "오후"
      return { text: `지금은 ${ap} ${t.hour % 12 || 12}시 ${t.minute}분이에요! 멍!`, pose: "sit" }
    },
  },
  {
    test: /(며칠|날짜|요일|오늘\s*몇)/,
    reply: () => {
      const t = koreaNow()
      return { text: `오늘은 ${t.month}월 ${t.date}일 ${"일월화수목금토"[t.day]}요일이에요!`, pose: "sit" }
    },
  },
  { test: /(날씨|비\s*와|더워|추워)/, reply: () => ({ text: "창밖은 못 보지만… 따뜻하게 입어요! 저처럼 스웨터!", pose: "front" }) },

  {
    test: /(안녕|하이|hello|hi\b|반가)/i,
    reply: (ctx) => {
      const h = koreaNow().hour
      const greet = h < 11 ? "좋은 아침이에요" : h < 18 ? "안녕하세요" : "좋은 저녁이에요"
      return { text: `${greet}, ${owner(ctx)}! 왈왈! 저는 ${ctx.name}예요!`, pose: "front" }
    },
  },
  { test: /(잘\s*가|바이|bye|나중에|이따)/i, reply: () => ({ text: "또 와요! 기다리고 있을게요~", pose: "sit" }) },
  { test: /(멍|왈|월)/, reply: () => ({ text: pick(["멍멍! 왈왈!", "왈! (강아지 말 할 줄 아네요!)"]), pose: "jump" }) },
]

const FALLBACK: ((t: string) => string)[] = [
  (t) => `"${t}"? 킁킁… 그게 뭐예요? 맛있는 거예요?`,
  () => "음… 잘 모르겠지만 다 좋아요! 왈!",
  () => "고개 갸웃~? 다시 말해줄래요?",
  () => "왈왈! (무슨 말인지는 몰라도 꼬리는 흔들어요)",
  () => `"앉아", "손", "간식", "산책", "사랑해" 같은 말을 해보세요!`,
]

export function dogReply(raw: string, ctx: DogContext): DogReply {
  const text = raw.trim()
  if (!text) return { text: "왈?", pose: "front" }
  if (text.replace(/[!~?.\s]/g, "") === ctx.name.replace(/\s/g, "")) {
    return { text: pick(["네! 불렀어요?", "왈! 여기 있어요!"]), pose: "run" }
  }
  for (const rule of RULES) {
    const m = text.match(rule.test)
    if (m) return rule.reply(ctx, m)
  }
  const short = text.length > 12 ? `${text.slice(0, 12)}…` : text
  return { text: pick(FALLBACK)(short), pose: "front" }
}
