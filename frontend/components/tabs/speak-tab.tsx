"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { useState } from "react"
import { MessageCircle, Mic } from "lucide-react"

interface SpeakTabProps {
  difficulty: string
}

export default function SpeakTab({ difficulty }: SpeakTabProps) {
  const router = useRouter()

  const handleStartPractice = () => {
    router.push("/speak")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-orange-100 rounded-3xl p-8 md:p-12 relative overflow-hidden flex flex-col items-center justify-center">
      {/* Decorative elements */}
      <div className="absolute top-6 right-12 text-2xl opacity-40 animate-bounce">✨</div>
      <div className="absolute bottom-12 left-8 text-xl opacity-30 animate-pulse">✨</div>

      <div className="relative z-10 text-center max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl md:text-5xl font-bold text-blue-900 flex items-center justify-center gap-3">
            <span className="text-4xl">🤖</span>
            1:1 AI Chat
          </h2>
        </div>

        {/* Robot Character */}
        <div className="mb-10 flex justify-center">
          <Image
            src="/images/ai-robot.jpg"
            alt="Friendly AI robot"
            width={200}
            height={200}
            className="drop-shadow-lg"
            priority
          />
        </div>

        {/* Speech Bubble */}
        <div className="mb-10 relative">
          <div className="bg-blue-300 rounded-3xl px-8 py-6 shadow-lg relative">
            <div className="absolute -bottom-6 left-8 w-0 h-0 border-l-8 border-r-0 border-t-8 border-l-transparent border-t-blue-300"></div>
            <p className="text-lg md:text-xl text-gray-800 font-semibold">
              Hi! Let's have a cozy chat
              <span className="ml-2 text-2xl">😊</span>
            </p>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartPractice}
          className="bg-gradient-to-r from-pink-300 to-rose-300 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-2xl md:text-3xl py-6 px-12 rounded-full shadow-xl hover:shadow-2xl transform hover:scale-110 transition-all duration-300 inline-flex items-center justify-center gap-3 group"
        >
          <span className="text-2xl">⭐</span>
          <span>START CHAT</span>
          <span className="text-2xl">⭐</span>
        </button>
      </div>
    </div>
  )
}
