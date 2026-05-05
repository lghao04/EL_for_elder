"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Headphones, Volume2, Play, Pause, RotateCcw, ChevronRight } from "lucide-react"
import Header from "@/components/header"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

const SPEEDS = [
  { label: "🐢 Slow", value: 0.75 },
  { label: "▶ Normal", value: 1 },
  { label: "⚡ Fast", value: 1.25 },
]

interface GeneratedQuestion {
  question: string
  options: string[]
  answer: string
}

export interface ListeningItem {
  id: string
  title: string
  level: string
  topic: string
  audio_url: string
  questions: string[]
  source_url: string
  generated_questions?: GeneratedQuestion[]
}

interface ListeningDetailProps {
  item: ListeningItem
  genLoading: boolean
}

export default function ListeningDetail({ item, genLoading }: ListeningDetailProps) {
  const router = useRouter()

  // ── Audio ────────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)

  // ── Quiz ─────────────────────────────────────────────────────────────────
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [showScorePopup, setShowScorePopup] = useState(false)

  const gqs = item.generated_questions ?? []
  const currentQuestion = gqs[currentQuestionIndex]

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null }
  }, [])
  useEffect(() => {
  if (showScorePopup && audioRef.current) {
    audioRef.current.pause()
    setIsPlaying(false)
  }
}, [showScorePopup])

    const stopAudio = () => {
    if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
    }
    setIsPlaying(false)
    }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && showScorePopup) setShowScorePopup(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [showScorePopup])

  // ── Audio helpers ─────────────────────────────────────────────────────────
  const proxyUrl = (url: string) =>
    `${API}/listen/audio-proxy?url=${encodeURIComponent(url)}`

  const initAudio = (url: string) => {
    const audio = new Audio(proxyUrl(url))
    audio.playbackRate = playbackRate
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration))
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime))
    audio.addEventListener("ended", () => { setIsPlaying(false); setCurrentTime(0) })
    audio.addEventListener("error", () => { setAudioError("❌ Không phát được audio."); setIsPlaying(false) })
    audioRef.current = audio
    return audio
  }

  const handlePlay = () => {
    if (!item.audio_url) return
    setAudioError(null)
    if (!audioRef.current) {
      const audio = initAudio(item.audio_url)
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => { setAudioError("❌ Không phát được audio."); setIsPlaying(false) })
      return
    }
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false) }
    else { audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setAudioError("❌ Không phát được audio.")) }
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed)
    if (audioRef.current) audioRef.current.playbackRate = speed
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const newTime = Math.max(0, Math.min(ratio * duration, duration))
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00"
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  // ── Quiz helpers ──────────────────────────────────────────────────────────
  const handleSelect = (option: string) => {
    if (submitted) return
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: option }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < gqs.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
        // ✅ STOP AUDIO HERE
        if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0 // optional: reset về đầu
        }
        setIsPlaying(false)

        setSubmitted(true)
        setShowScorePopup(true)
    }
    }
  

  const handleRetry = () => {
    setSelectedAnswers({})
    setSubmitted(false)
    setShowScorePopup(false)
    setCurrentQuestionIndex(0)
  }

  const getScore = () =>
    gqs.filter((q, i) => selectedAnswers[i]?.charAt(0) === q.answer).length

  const score = submitted ? getScore() : 0

  const getOptionStyle = (qi: number, option: string, correctAnswer: string) => {
    const letter = option.charAt(0)
    const selected = selectedAnswers[qi]?.charAt(0)
    const isCorrect = letter === correctAnswer
    const isSelected = letter === selected

    if (!submitted) {
      return isSelected
        ? "bg-pink-500 text-white shadow-lg scale-[1.02] border-pink-500"
        : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200 cursor-pointer"
    }
    if (isCorrect) return "bg-green-100 text-green-700 border-green-400 font-semibold"
    if (isSelected && !isCorrect) return "bg-red-100 text-red-600 border-red-400"
    return "bg-gray-50 text-gray-400 border-gray-100"
  }

  // ── Results screen ────────────────────────────────────────────────────────
  

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-orange-50 to-yellow-100">
      <Header userAvatar="👧" />

      {/* Score Popup */}
      {showScorePopup && (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    onClick={() => setShowScorePopup(false)}
  >
    <div
      className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-7xl block mb-6">
        {score === gqs.length ? "🎉" : "👏"}
      </span>

      <h2 className="text-4xl font-bold text-gray-800 mb-4">
        Quiz Complete!
      </h2>

      <p className="text-gray-600 text-xl mb-6">Your Score</p>

      <div className="bg-gradient-to-br from-pink-500 to-orange-500 rounded-2xl p-6 mb-8">
        <p className="text-white text-6xl font-bold">
          {score}/{gqs.length}
        </p>
        <p className="text-white text-2xl mt-2">
          {score === gqs.length
            ? "Perfect!"
            : `${Math.round((score / gqs.length) * 100)}%`}
        </p>
      </div>

      {/* ✅ ACTION BUTTONS */}
      <div className="flex gap-4">
        {/* Try Again */}
        <button
          onClick={() => {
            handleRetry()
          }}
          className="flex-1 bg-white border-2 border-pink-400 text-pink-500 px-6 py-4 rounded-2xl font-bold text-lg hover:bg-pink-50 transition"
        >
          Try Again
        </button>

        {/* Quit */}
        <button
          onClick={() => {
            stopAudio()
            router.back()
          }}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-2xl font-bold text-lg transition"
        >
          Quit
        </button>
      </div>
    </div>
  </div>
)}

      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Back */}
          <button
            onClick={() => {
              stopAudio();
              router.back();
            }}
            className="bg-white px-6 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition shadow-lg border-2 border-orange-200"
          >
            ← Back to Dashboard
          </button>

          {/* Title card */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-pink-100">
            <div className="flex items-center gap-4 mb-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 leading-tight">{item.title}</h1>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
            </div>
          </div>

          {/* Audio Player */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-pink-100">
            <div className="bg-pink-50 border-2 border-pink-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-pink-500" />
                <p className="font-bold text-gray-800 text-sm">Listen to the story</p>
              </div>
             

              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlay}
                  className={`w-14 h-14 flex-shrink-0 rounded-full flex items-center justify-center text-white shadow-lg transition-all
                    ${isPlaying
                      ? "bg-orange-500 scale-110"
                      : "bg-gradient-to-br from-pink-400 to-orange-400 hover:scale-105"}`}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>

                <div className="flex-1 space-y-1">
                  <div
                    ref={progressRef}
                    onClick={handleSeek}
                    className="w-full h-3 bg-pink-200 rounded-full cursor-pointer overflow-hidden"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-pink-400 to-orange-400 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <Volume2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>

              {audioError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-red-500 text-sm">{audioError}</p>
                </div>
              )}
            </div>

            {/* Speed buttons */}
            <div className="flex gap-3 flex-wrap mt-5">
              {SPEEDS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleSpeedChange(s.value)}
                  className={`px-4 py-2 rounded-full font-semibold text-sm transition border-2
                    ${playbackRate === s.value
                      ? s.value === 1
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-pink-200 text-pink-700 border-pink-400"
                      : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"}`}
                >
                  {s.label} ({s.value}x)
                </button>
              ))}
            </div>
          </div>

        

          {/* Quiz */}
          {genLoading && (
            <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-pink-100 text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-pink-400 mx-auto mb-4" />
              <p className="text-gray-400 font-semibold">Generating questions...</p>
            </div>
          )}

          {!genLoading && gqs.length > 0 && !submitted && currentQuestion && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-pink-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    Question {currentQuestionIndex + 1} of {gqs.length}
                  </h2>
                  <span className="text-sm text-gray-500 font-semibold bg-gray-100 px-3 py-1 rounded-full">
                    {Object.keys(selectedAnswers).length}/{gqs.length} answered
                  </span>
                </div>

                <p className="text-xl text-gray-800 font-semibold mb-6">{currentQuestion.question}</p>

                <div className="space-y-3">
                  {currentQuestion.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => handleSelect(opt)}
                      disabled={submitted}
                      className={`w-full p-4 rounded-2xl text-base font-semibold text-left transition-all border-2
                        ${getOptionStyle(currentQuestionIndex, opt, currentQuestion.answer)}`}
                    >
                      <span className="font-bold mr-2">{opt.charAt(0)}.</span>
                      {opt.slice(3)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleNext}
                disabled={!selectedAnswers[currentQuestionIndex]}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition shadow-lg flex items-center justify-center gap-2
                  ${!selectedAnswers[currentQuestionIndex]
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-orange-500 hover:bg-orange-600 text-white hover:scale-[1.02]"}`}
              >
                {currentQuestionIndex === gqs.length - 1
                  ? "Finish 🎉"
                  : <><span>Next Question</span><ChevronRight className="w-5 h-5" /></>}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}