import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "뽀식이 놀이터",
  description: "강아지가 화면을 뛰어다니며 놀아요. 링크만 있으면 누구나 자기 강아지 사진으로 쓸 수 있어요.",
  manifest: "/dog-play.webmanifest",
  icons: {
    icon: "/ppo/play-icon-192.png",
    apple: "/ppo/play-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "뽀식이 놀이터",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  themeColor: "#f8dfc2",
  // Lets the page draw under the iPhone notch; the toolbar pads itself with safe-area insets.
  viewportFit: "cover",
}

export default function DogPlayLayout({ children }: { children: React.ReactNode }) {
  return children
}
