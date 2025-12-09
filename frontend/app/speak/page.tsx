"use client"

import { useRouter } from "next/navigation"
import Header from "../../components/header"
import AIChat from "../../components/ai-chat"
import { useState } from "react"

export default function SpeakPage() {
  const router = useRouter()
  const [currentLanguage, setCurrentLanguage] = useState("en")

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100 flex flex-col">
      <Header userAvatar="👧" onLanguageChange={setCurrentLanguage} currentLanguage={currentLanguage} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4">
          <button
            onClick={() => router.back()}
            className="bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-gray-300"
          >
            ← Back
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <AIChat />
        </div>
      </div>
    </div>
  )
}
