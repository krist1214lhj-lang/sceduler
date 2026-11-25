// Runs before every web build (npm "prebuild"), so the KakaoTalk bot always matches the desktop pet:
// copies the desktop pet's pose pictures into public/ppo/pose/ and writes lib/pet-poses.json,
// the list of pictures the bot can show (big Kakao cards first, desktop pictures as a fallback).
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const from = join(root, "desktop-pet/src/assets/ppo")
const to = join(root, "public/ppo/pose")
const cardsDir = join(root, "public/ppo/kakao")

mkdirSync(to, { recursive: true })
const sprites = readdirSync(from).filter((f) => f.endsWith(".png"))
for (const f of sprites) copyFileSync(join(from, f), join(to, f))

const names = (list, ext) => list.filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)).sort()
const manifest = { cards: names(readdirSync(cardsDir), ".jpg"), sprites: names(sprites, ".png") }
writeFileSync(join(root, "lib/pet-poses.json"), JSON.stringify(manifest, null, 2) + "\n")
console.log(`pet poses: ${manifest.cards.length} cards, ${manifest.sprites.length} desktop pictures`)
