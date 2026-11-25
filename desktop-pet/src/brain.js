// 뽀식이의 대화 두뇌 - free, offline, rule based. No AI service is called.
// window.dogBrain.reply(text, ctx) -> { text, action?, remember? }
;(function () {
  const pick = (list) => list[Math.floor(Math.random() * list.length)]

  function owner(ctx) {
    return ctx.ownerName ? `${ctx.ownerName}님` : "주인님"
  }

  // Each rule: words to look for, then a reply (string list or function) and an optional action.
  const RULES = [
    {
      test: /(내|제)\s*이름은\s*([가-힣A-Za-z0-9]{1,10})/,
      reply: (ctx, m) => {
        const n = m[2].replace(/(이야|야|예요|이에요|입니다|이라고|라고|요)$/, "")
        return { text: `${n}님! 이제 기억했어요! 왈왈! ${ctx.name}는 ${n}님이 제일 좋아요~`, action: "happy", remember: { ownerName: n } }
      },
    },
    {
      test: /(내\s*이름|나\s*누구)/,
      reply: (ctx) =>
        ctx.ownerName
          ? { text: `${ctx.ownerName}님이잖아요! 내가 제일 좋아하는 사람! 멍!`, action: "wag" }
          : { text: `음… 아직 몰라요! "내 이름은 ○○야"라고 알려주세요~`, action: "sit" },
    },
    {
      test: /(너|네)\s*(이름|누구)|이름이\s*뭐/,
      reply: (ctx) => ({ text: pick([`저는 ${ctx.name}예요! 왈!`, `${ctx.name}! ${ctx.name}라고 불러주세요~`]), action: "wag" }),
    },
    { test: /(몇\s*살|나이)/, reply: () => ({ text: pick(["강아지 나이는 비밀이에요~ 헤헤", "마음은 영원한 아기 강아지예요!"]), action: "wag" }) },
    { test: /(무슨\s*종|품종|견종)/, reply: () => ({ text: "살구색 토이푸들이에요! 곱슬곱슬 털 예쁘죠?", action: "spin" }) },

    { test: /^(앉아|앉자|sit)|앉아/, reply: () => ({ text: pick(["앉았어요! 착하죠?", "얌전히 앉았어요~ 간식 주실 거죠?"]), action: "sit" }) },
    { test: /(빵|bang)/i, reply: () => ({ text: pick(["으악! 당했다… 꼴깍", "빵! …(죽은 척 중이에요)"]), action: "bang" }) },
    { test: /(얼굴|부끄|가려|숨어)/, reply: () => ({ text: pick(["부끄부끄~ (얼굴 가림)", "아잉 몰라요~"]), action: "shy" }) },
    { test: /(하이\s*파이브|하이5|짝)/, reply: () => ({ text: pick(["하이파이브! 짝!", "손바닥 짝! 왈!"]), action: "highfive" }) },
    { test: /(애교|주세요|부탁|두\s*발|서\s*봐)/, reply: () => ({ text: pick(["주세요~ 주세요~ (두 발로 서기)", "애교 발사! 헤헤"]), action: "beg" }) },
    { test: /(뒹굴|구르|배\s*(보여|만져|쓰담|긁)|배꼽)/, reply: () => ({ text: pick(["배 쓰담쓰담 해주세요~", "뒹굴뒹굴~ 기분 좋다!"]), action: "belly" }) },
    { test: /(우다다|달려|뛰어\s*놀)/, reply: () => ({ text: "우다다다다!! 신난다!!", action: "zoomies" }) },
    { test: /(꼬리)/, reply: () => ({ text: "꼬리 잡을 거야! 빙글빙글~", action: "chase" }) },
    { test: /(숨바꼭질|빼꼼|숨어\s*봐)/, reply: () => ({ text: "숨바꼭질! 나 찾아봐라~", action: "peek" }) },
    { test: /(하품|아함|하아암)/, reply: () => ({ text: "하아암~ 저도 하품 나와요…", action: "yawn" }) },
    { test: /^손|손\s*(줘|!)|악수/, reply: () => ({ text: pick(["손! 여기요~", "자, 손! 멍!"]), action: "paw" }) },
    { test: /(엎드려|누워|코\s*자|낮잠|자자|자러|잘\s*자|굿\s*나잇|졸려)/, reply: () => ({ text: pick(["네에… 새근새근… zzz", "잘 자요~ 저도 잘게요… zzz"]), action: "sleep" }) },
    { test: /(점프|뛰어)/, reply: () => ({ text: pick(["점프! 왈왈!", "높이 뛰었죠?!"]), action: "jump" }) },
    { test: /(돌아|빙글|회전)/, reply: () => ({ text: "빙글빙글~ 어지러워요 헤헤", action: "spin" }) },
    { test: /(이리\s*와|와\s*봐|컴온|come)/i, reply: (ctx) => ({ text: `${owner(ctx)}! 달려가요~!`, action: "come" }) },
    { test: /(산책|나가자|걷자)/, reply: () => ({ text: pick(["산책?! 신난다! 킁킁~", "산책 좋아요! 총총총~"]), action: "walk" }) },
    { test: /(공\s*놀이|공\s*던|공\s*줄|공놀이|공\s*가져)/, reply: () => ({ text: "공이다!! 던져주세요! 왈왈!", action: "ball" }) },
    { test: /(간식|밥|먹자|맘마|까까|껌)/, reply: () => ({ text: pick(["간식!!! 최고예요!", "냠냠 할 시간이다! 꼬리 붕붕~"]), action: "treat" }) },
    { test: /(놀자|놀아|심심)/, reply: () => ({ text: pick(["좋아요! 놀아요 놀아요!", "같이 놀아요! (쭉 기지개)"]), action: "bow" }) },
    { test: /(기지개|스트레칭)/, reply: () => ({ text: "쭈욱~ 기지개! 주인님도 같이 해요!", action: "bow" }) },

    { test: /(사랑해|좋아해|러브|love)/i, reply: (ctx) => ({ text: pick([`저도 ${owner(ctx)} 사랑해요! 💗`, "저도요저도요! 세상에서 제일 많이!", "헤헤 꼬리가 멈추질 않아요~"]), action: "happy", hearts: true }) },
    { test: /(귀여|예쁘|이뻐|이쁘|최고|멋있|착하|잘했)/, reply: () => ({ text: pick(["헤헤 칭찬 좋아요!", "부끄러워요~ 꼬리 살랑살랑", "칭찬 받으니 간식도 받고 싶어요!"]), action: "wag", hearts: true }) },
    { test: /(쓰담|쓰다듬|만져)/, reply: () => ({ text: "쓰담쓰담 최고예요~ 더 해주세요!", action: "happy", hearts: true }) },
    { test: /(바보|멍청|미워|싫어|저리\s*가|나빠)/, reply: () => ({ text: pick(["힝… 삐졌어요…", "그런 말 하면 슬퍼요… 낑낑"]), action: "sit" }) },
    { test: /(미안|죄송)/, reply: () => ({ text: "괜찮아요! 금방 다 잊었어요~ 왈!", action: "wag" }) },
    { test: /(고마워|고맙|땡큐|감사)/, reply: () => ({ text: pick(["저도 고마워요! 멍!", "헤헤 언제든지요~"]), action: "wag" }) },

    { test: /(힘들|피곤|지쳤|지친|우울|슬퍼|슬프|속상|외로|짜증|스트레스|울고)/, reply: (ctx) => ({ text: pick([`${owner(ctx)}, 오늘 많이 힘들었구나… 제가 옆에 있을게요.`, "토닥토닥… 잠깐 쉬어요. 제가 지켜줄게요!", "힘내요! 제가 꼬리 흔들어 줄게요~ 살랑살랑"]), action: "come" }) },
    { test: /(배고|배\s*고)/, reply: () => ({ text: "저도 배고파요! 같이 간식 먹어요!", action: "treat" }) },
    { test: /(기분|컨디션).*(어때|좋아|어떠)|잘\s*지내/, reply: (ctx) => ({ text: ctx.hungry ? "좋은데… 배가 조금 고파요! 간식…?" : pick(["완전 좋아요! 왈왈!", "주인님이랑 있어서 행복해요~"]), action: "wag" }) },
    { test: /(뭐\s*해|뭐하|뭐\s*하)/, reply: () => ({ text: pick(["주인님 구경하고 있었어요!", "화면 위 산책 중이에요~", "꼬리 잡기 연습 중이에요!"]), action: "wag" }) },

    {
      test: /(몇\s*시|시간)/,
      reply: () => {
        const d = new Date()
        const h = d.getHours()
        const ap = h < 12 ? "오전" : "오후"
        return { text: `지금은 ${ap} ${h % 12 || 12}시 ${d.getMinutes()}분이에요! 멍!`, action: "sit" }
      },
    },
    {
      test: /(며칠|날짜|무슨\s*요일|요일|오늘\s*몇)/,
      reply: () => {
        const d = new Date()
        const day = "일월화수목금토"[d.getDay()]
        return { text: `오늘은 ${d.getMonth() + 1}월 ${d.getDate()}일 ${day}요일이에요!`, action: "sit" }
      },
    },
    { test: /(날씨|비\s*와|더워|추워)/, reply: () => ({ text: "창밖은 못 보지만… 따뜻하게 입어요! 저처럼 스웨터!", action: "spin" }) },

    {
      test: /(안녕|하이|hello|hi\b|반가)/i,
      reply: (ctx) => {
        const h = new Date().getHours()
        const greet = h < 11 ? "좋은 아침이에요" : h < 18 ? "안녕하세요" : "좋은 저녁이에요"
        return { text: `${greet}, ${owner(ctx)}! 왈왈!`, action: "happy" }
      },
    },
    { test: /(잘\s*가|바이|bye|나중에|이따)/i, reply: () => ({ text: "금방 와요! 기다리고 있을게요~", action: "sit" }) },
    { test: /(멍|왈|월)/, reply: () => ({ text: pick(["멍멍! 왈왈!", "왈! (주인님도 강아지 말 할 줄 아네요!)"]), action: "jump" }) },
  ]

  const FALLBACK = [
    (t) => `"${t}"? 킁킁… 그게 뭐예요? 맛있는 거예요?`,
    () => "음… 잘 모르겠지만 주인님 말은 다 좋아요! 왈!",
    () => "고개 갸웃~? 다시 말해줄래요?",
    () => "왈왈! (무슨 말인지는 몰라도 꼬리는 흔들어요)",
    () => `"앉아", "손", "간식", "산책", "사랑해" 같은 말을 해보세요!`,
  ]

  function reply(raw, ctx) {
    const text = String(raw || "").trim()
    if (!text) return { text: "왈?", action: "wag" }
    if (ctx.name && text.replace(/[!~?.\s]/g, "") === ctx.name.replace(/\s/g, "")) {
      return { text: pick(["네! 불렀어요?", "왈! 여기 있어요!"]), action: "come" }
    }
    for (const rule of RULES) {
      const m = text.match(rule.test)
      if (m) return rule.reply(ctx, m)
    }
    const short = text.length > 12 ? `${text.slice(0, 12)}…` : text
    return { text: pick(FALLBACK)(short), action: "wag" }
  }

  window.dogBrain = { reply }
})()
