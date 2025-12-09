import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "EL for Elder",
  description: "Learning app for elders",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
