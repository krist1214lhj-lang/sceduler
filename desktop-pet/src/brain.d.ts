// Types for brain.js, so the web app (lib/dog-brain.ts) can import the same brain.
export type DogBrainContext = { name: string; ownerName?: string; hungry?: boolean }
export type DogBrainReply = {
  text: string
  action?: string
  hearts?: boolean
  remember?: { ownerName?: string }
}
export function reply(raw: string, ctx: DogBrainContext): DogBrainReply
