"use client"

import { useRouter } from "next/navigation"
import Header from "../../components/header"
import AIChat from "../../components/ai-chat"
import { useState } from "react"


export default function SpeakPage() {
  const router = useRouter()
  const [currentLanguage, setCurrentLanguage] = useState("en")

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header userAvatar="👧" onLanguageChange={setCurrentLanguage} currentLanguage={currentLanguage} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => router.back()}
            className="bg-blue-50 px-4 py-2 rounded-lg font-semibold text-sm text-blue-600 hover:bg-blue-100 transition border border-blue-200"
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
