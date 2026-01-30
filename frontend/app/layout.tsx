import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Zero to One",
  description: "Learning together",
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
