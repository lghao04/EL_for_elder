"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"

interface SpeakTabProps {
  difficulty: string
}

export default function SpeakTab({ difficulty }: SpeakTabProps) {
  const router = useRouter()

  // ✅ giữ nguyên logic cũ
  const handleStartPractice = () => {
    router.push("/speak")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-200 via-pink-100 to-orange-100 rounded-3xl p-8 md:p-12 relative overflow-hidden flex flex-col items-center justify-center">
      
      {/* Decorative elements */}
      <div className="absolute top-8 left-6 text-4xl animate-bounce pointer-events-none">💖</div>
      <div className="absolute top-20 right-8 text-3xl animate-pulse pointer-events-none">✨</div>
      <div className="absolute top-12 right-1/3 text-3xl pointer-events-none">✦</div>
      <div className="absolute bottom-32 left-8 text-3xl animate-pulse pointer-events-none">💖</div>
      <div className="absolute bottom-20 right-6 text-4xl pointer-events-none">💖</div>
      <div className="absolute top-1/2 right-12 text-2xl animate-bounce pointer-events-none" style={{ animationDelay: "0.3s" }}>✨</div>
      <div className="absolute bottom-40 left-1/4 text-2xl animate-pulse pointer-events-none">✦</div>
      <div className="absolute top-1/3 left-10 text-3xl pointer-events-none">✨</div>
      <div className="absolute bottom-1/4 right-1/4 text-2xl animate-bounce pointer-events-none" style={{ animationDelay: "0.5s" }}>✦</div>

      <div className="relative z-10 text-center max-w-2xl">
        
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl md:text-5xl font-bold text-pink-600 flex items-center justify-center gap-3">
            <span className="text-4xl">🎤</span>
            <span>ENGLISH SPEAKING PRACTICE</span>
          </h2>
          <p className="text-lg text-pink-700 font-semibold mt-3">
            Chat with AI to practice your English speaking! 😊
          </p>
        </div>

        {/* Robot */}
        <div className="mb-10 flex justify-center">
          <Image
            src="/img/robot.png"
            alt="Friendly AI robot"
            width={280}
            height={280}
            className="drop-shadow-lg"
            priority
          />
        </div>

        {/* Speech Bubble */}
        <div className="mb-10 relative">
          <div className="bg-white rounded-3xl px-8 py-6 shadow-lg relative">
            <div className="absolute -bottom-6 left-12 w-0 h-0 border-l-8 border-r-0 border-t-8 border-l-transparent border-t-white"></div>
            <p className="text-lg md:text-xl text-pink-600 font-bold">
              Let's talk in
              <br />
              English!
              <span className="ml-2 text-2xl">💬</span>
            </p>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={handleStartPractice} 
          className="relative z-20 bg-gradient-to-r from-pink-400 to-orange-400 hover:from-pink-500 hover:to-orange-500 text-white font-bold text-3xl md:text-4xl py-6 px-16 rounded-full shadow-xl hover:shadow-2xl transform hover:scale-110 transition-all duration-300 inline-flex items-center justify-center gap-3"
        >
          <span>START CHAT</span>
        </button>
      </div>
    </div>
  )
}