"use client"

import { useState } from "react"

export default function SpeakingPractice() {
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

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Target Text and Play Sample */}
      <div className="bg-gradient-to-r from-pink-300 to-red-300 rounded-3xl p-8 shadow-lg text-center">
        <p className="text-xl text-white mb-2">Listen and repeat:</p>
        <h2 className="text-6xl font-bold text-white mb-6">Hello</h2>
        <p className="text-2xl text-white mb-6">Xin chào</p>

        <button
          onClick={handlePlaySample}
          disabled={isPlayingSample}
          className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-xl transition-all transform ${
            isPlayingSample
              ? "bg-white text-red-500 scale-95"
              : "bg-white text-red-500 hover:bg-yellow-100 hover:scale-105"
          } shadow-lg`}
        >
          <span className="text-3xl">{isPlayingSample ? "🔊" : "🔉"}</span>
          {isPlayingSample ? "Playing..." : "Play Sample"}
        </button>
      </div>

      {/* Recording Button */}
      <div className="flex justify-center">
        <button
          onClick={handleRecording}
          className={`rounded-full p-12 text-7xl transition-all transform ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 scale-110 animate-pulse"
              : "bg-green-400 hover:bg-green-500 hover:scale-105"
          } shadow-2xl`}
        >
          {isRecording ? "⏹️" : "🎤"}
        </button>
      </div>

      {/* Waveform Display */}
      {isRecording && (
        <div className="bg-white rounded-2xl p-6 flex items-center justify-center gap-1 shadow-lg h-24">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="bg-blue-400 rounded-full animate-pulse"
              style={{
                width: "8px",
                height: `${Math.random() * 60 + 20}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Score Display */}
      {score !== null && (
        <div className="bg-gradient-to-r from-yellow-300 to-orange-300 rounded-3xl p-8 shadow-lg text-center border-4 border-yellow-400">
          <p className="text-2xl text-white mb-2">Your Score:</p>
          <h3 className="text-7xl font-bold text-white">{score}%</h3>
          <p className="text-xl text-white mt-4">Great job! Keep practicing!</p>
          <button
            onClick={() => setScore(null)}
            className="mt-6 bg-white text-orange-500 px-8 py-4 rounded-xl font-bold text-xl hover:bg-orange-50 transition shadow-lg"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
