import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "뽀식이 놀이터",
  description: "강아지가 화면을 뛰어다니며 놀아요. 링크만 있으면 누구나 자기 강아지 사진으로 쓸 수 있어요.",
}

export default function DogPlayLayout({ children }: { children: React.ReactNode }) {
  return children
}
