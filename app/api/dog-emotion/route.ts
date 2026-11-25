import Anthropic from "@anthropic-ai/sdk"

export const maxDuration = 30

const anthropic = new Anthropic()

const EMOTIONS = ["Happy", "Relaxed", "Curious", "Anxious", "Sad", "Angry", "Sleepy"] as const

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dog_found", "label", "reason"],
  properties: {
    dog_found: { type: "boolean" },
    label: { type: "string", enum: [...EMOTIONS] },
    reason: { type: "string" },
  },
}

const SYSTEM = `You read dog body language for the dog's owner, from one photo.

Judge from the dog's visible signals, not from how the breed looks: droopy eyes, wrinkles or a flat face (basset, shar-pei, pug, bulldog) are not sadness, and pricked ears are normal for some breeds. Look at:
- ears: relaxed, forward, pinned back
- eyes: soft or squinting, wide, whites showing (whale eye), half closed
- mouth: loose and open, tongue out, closed tight, lip licking, yawning, teeth showing, wrinkled muzzle
- head and body: tilted head, play bow, loose, stiff, cowering, lying down
- tail if visible, and the setting (playing, in bed, at the vet)

Labels:
- Happy: playful or excited — loose open mouth, soft eyes, wagging, play bow
- Relaxed: calm and content — loose body, soft face, resting comfortably
- Curious: interested in something — ears forward, head tilt, focused gaze
- Anxious: worried or scared — ears back, whale eye, lip licking, tucked tail, cowering
- Sad: low and withdrawn — head down, little energy, looking up from under the brow
- Angry: tense or warning — stiff body, hard stare, wrinkled muzzle, bared teeth
- Sleepy: tired — eyes closing, yawning while relaxed, curled up

Pick the single closest label even when signals are mixed. In "reason", write one or two short, friendly Korean sentences in polite speech (존댓말) naming the specific signs you saw, and say so if the face is hard to see. If there is no dog in the photo, set dog_found to false.`

export async function POST(request: Request) {
  try {
    const { image, quick } = (await request.json()) as { image: string; quick?: boolean }

    const match = image.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/)
    if (!match) {
      return Response.json({ error: "지원하지 않는 이미지 형식입니다." }, { status: 400 })
    }
    const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp"

    const message = await anthropic.messages.create({
      // Automatic readings every 15s use Haiku (~0.3원 each); a deliberate check uses Opus (~17원).
      model: quick ? "claude-haiku-5-5" : "claude-opus-5-5",
      max_tokens: 4096,
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: match[2] } },
            { type: "text", text: "이 강아지의 지금 감정을 알려주세요." },
          ],
        },
      ],
    })

    if (message.stop_reason !== "end_turn") {
      return Response.json({ error: "감정 분석에 실패했습니다. 다시 시도해 주세요." }, { status: 502 })
    }
    const text = message.content.find((b) => b.type === "text")?.text ?? ""
    const result = JSON.parse(text) as { dog_found: boolean; label: string; reason: string }

    if (!result.dog_found) {
      return Response.json(
        { error: "사진에서 강아지를 찾지 못했어요. 강아지 얼굴이 잘 보이게 다시 찍어주세요." },
        { status: 422 },
      )
    }

    return Response.json({ label: result.label, reason: result.reason })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
