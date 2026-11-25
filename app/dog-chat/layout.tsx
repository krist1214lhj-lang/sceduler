import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "뽀식이와 대화",
  description: "카메라로 강아지 표정을 읽고 강아지와 대화해요.",
  manifest: "/dog-chat.webmanifest",
  icons: {
    icon: "/dog-chat-icon-192.png",
    apple: "/dog-chat-apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "뽀식이",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  themeColor: "#fcd34d",
}

export default function DogChatLayout({ children }: { children: React.ReactNode }) {
  return children
}
