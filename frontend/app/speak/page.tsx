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
      <Header userAvatar=""  />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => router.back()}
            className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-orange-300 w-fit"
          >
           ← Back to Dashboard
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <AIChat />
        </div>
      </div>
    </div>
  )
}
