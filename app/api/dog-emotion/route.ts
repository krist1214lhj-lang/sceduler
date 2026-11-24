import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

const EMOTIONS = ["Happy", "Sad", "Angry", "Relaxed"]

export async function POST(request: Request) {
  try {
    const { image } = (await request.json()) as { image: string }

    const match = image.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/)
    if (!match) {
      return Response.json({ error: "지원하지 않는 이미지 형식입니다." }, { status: 400 })
    }
    const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp"

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: match[2] } },
            {
              type: "text",
              text: `사진 속 강아지의 표정과 몸짓을 보고 감정을 하나 골라줘.
다른 말 없이 JSON 한 줄로만 답해: {"label": "Happy|Sad|Angry|Relaxed 중 하나", "score": 0~1 사이 확신도}
강아지가 없으면 {"label": "none", "score": 0}`,
            },
          ],
        },
      ],
    })

    const text = message.content[0]?.type === "text" ? message.content[0].text : ""
    const json = text.match(/\{[\s\S]*\}/)
    const result = json ? (JSON.parse(json[0]) as { label: string; score: number }) : null

    if (!result || result.label === "none") {
      return Response.json(
        { error: "사진에서 강아지를 찾지 못했어요. 강아지 얼굴이 잘 보이게 다시 찍어주세요." },
        { status: 422 },
      )
    }
    if (!EMOTIONS.includes(result.label)) {
      return Response.json({ error: "감정 분석에 실패했습니다." }, { status: 500 })
    }

    return Response.json({ label: result.label, score: Number(result.score) || 0.5 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
