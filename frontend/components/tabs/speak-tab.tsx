"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { MessageCircle, Mic } from "lucide-react"

interface SpeakTabProps {
  difficulty: string
}

export default function SpeakTab({ difficulty }: SpeakTabProps) {
  const router = useRouter()
  const [isRecording, setIsRecording] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [isPlayingSample, setIsPlayingSample] = useState(false)


  const handleStartPractice = () => {
    router.push("/speak")
  }

  return (
    <div className="flex items-center justify-center min-h-[500px] p-8">
      <div className="text-center max-w-2xl">
        <div className="mb-12 space-y-4">
          <h2 className="text-5xl font-bold text-gray-800">Let's chat with the AI!</h2>
          <p className="text-2xl text-gray-600">Practice speaking English naturally with our AI conversation partner</p>
        </div>

        <button
          onClick={handleStartPractice}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-3xl px-20 py-10 rounded-3xl shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center gap-4 mx-auto group"
        >
          <MessageCircle className="w-10 h-10 group-hover:animate-bounce" />
          <span>START CONVERSATION</span>
          <Mic className="w-10 h-10 group-hover:animate-pulse" />
        </button>

        
      </div>
    </div>
  )
}
