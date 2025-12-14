"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface SpeakTabProps {
  difficulty: string
}

export default function SpeakTab({ difficulty }: SpeakTabProps) {
  const router = useRouter()
  const [isRecording, setIsRecording] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [isPlayingSample, setIsPlayingSample] = useState(false)

  const handleRecording = () => {
    setIsRecording(!isRecording)
    if (!isRecording) {
      // Simulate recording and scoring
      setTimeout(() => {
        setIsRecording(false)
        setScore(Math.floor(Math.random() * 40 + 60))
      }, 3000)
    }
  }

  const handlePlaySample = () => {
    setIsPlayingSample(true)
    // Simulate audio playback
    setTimeout(() => {
      setIsPlayingSample(false)
    }, 2000)
  }

  const handleStartPractice = () => {
    router.push("/speak")
  }

  return (

    
    <div className="flex items-center justify-center min-h-96">
      <button
        onClick={handleStartPractice}
        className="bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white font-bold text-4xl px-16 py-12 rounded-3xl shadow-2xl transform hover:scale-110 transition-all border-4 border-white"
      >
        🎤 START
      </button>
    </div>
  )
}
