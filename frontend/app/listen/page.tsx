"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useRef, Suspense } from "react"
import Header from "@/components/header"

interface GeneratedQuestion {
  question: string
  options: string[]
  answer: string
}

interface ListeningItem {
  id: string
  title: string
  level: string
  topic: string
  audio_url: string
  questions: string[]
  source_url: string
  generated_questions?: GeneratedQuestion[]
}

function ListenContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [item, setItem] = useState<ListeningItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const progressRef = useRef<HTMLDivElement>(null)

  // Quiz state
  const [genLoading, setGenLoading] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const id = searchParams.get("id")
  const BASE = "http://127.0.0.1:8000"
  const SPEEDS = [0.75, 1, 1.25, 1.5]

  useEffect(() => {
    if (!id) { setError("No lesson ID provided"); setLoading(false); return }

    fetch(`${BASE}/api/listen/${id}`)
      .then((res) => { if (!res.ok) throw new Error(`Lỗi ${res.status}`); return res.json() })
      .then(async (data) => {
        if (data.generated_questions?.length > 0) {
          setItem(data)
          setLoading(false)
        } else {
          setItem(data)
          setLoading(false)
          setGenLoading(true)
          const res = await fetch(`${BASE}/api/listen/${data.id}/generate-questions`, { method: "POST" })
          if (!res.ok) throw new Error(`Lỗi generate ${res.status}`)
          const full = await res.json()
          setItem(full)
          setGenLoading(false)
        }
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
        setGenLoading(false)
      })
  }, [id])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const proxyUrl = (url: string) =>
    `${BASE}/api/listen/audio-proxy?url=${encodeURIComponent(url)}`

  const initAudio = (url: string) => {
    const audio = new Audio(proxyUrl(url))
    audio.playbackRate = playbackRate

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration))
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime))
    audio.addEventListener("ended", () => { setIsPlaying(false); setCurrentTime(0) })
    audio.addEventListener("error", () => {
      setAudioError("❌ Không phát được audio.")
      setIsPlaying(false)
    })

    audioRef.current = audio
    return audio
  }

  const handlePlay = () => {
    if (!item?.audio_url) return
    setAudioError(null)

    if (!audioRef.current) {
      const audio = initAudio(item.audio_url)
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => { setAudioError("❌ Không phát được audio."); setIsPlaying(false) })
      return
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setAudioError("❌ Không phát được audio."))
    }
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

  // Quiz handlers
  const handleSelect = (questionIdx: number, option: string) => {
    if (submitted) return
    setSelectedAnswers((prev) => ({ ...prev, [questionIdx]: option }))
  }

  const handleSubmit = () => {
    if (!item?.generated_questions) return
    const allAnswered = item.generated_questions.every((_, i) => selectedAnswers[i])
    if (!allAnswered) { alert("Hãy trả lời tất cả câu hỏi trước khi nộp bài!"); return }
    setSubmitted(true)
  }

  const handleRetry = () => { setSelectedAnswers({}); setSubmitted(false) }

  const getScore = () => {
    if (!item?.generated_questions) return 0
    return item.generated_questions.filter(
      (q, i) => selectedAnswers[i]?.charAt(0) === q.answer
    ).length
  }

  const getOptionStyle = (questionIdx: number, option: string, correctAnswer: string) => {
    const letter = option.charAt(0)
    const selected = selectedAnswers[questionIdx]?.charAt(0)
    const isCorrect = letter === correctAnswer
    const isSelected = letter === selected

    if (!submitted) {
      return isSelected
        ? "border-orange-400 bg-orange-50 text-orange-700 font-semibold"
        : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50 cursor-pointer"
    }
    if (isCorrect) return "border-green-400 bg-green-50 text-green-700 font-semibold"
    if (isSelected && !isCorrect) return "border-red-400 bg-red-50 text-red-600"
    return "border-gray-100 bg-gray-50 text-gray-400"
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Đang tải bài học...</p>
        </div>
      </div>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !item) return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" />
      <div className="p-6 max-w-4xl mx-auto">
        <button onClick={() => router.back()}
          className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition shadow-lg">
          ← Back to Dashboard
        </button>
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-12 text-center">
          <p className="text-red-600 font-bold text-2xl mb-2">❌ Lỗi</p>
          <p className="text-red-500">{error || "Không tìm thấy bài học"}</p>
        </div>
      </div>
    </div>
  )

  const gqs = item.generated_questions ?? []
  const score = submitted ? getScore() : 0

  // ── Detail ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" />

      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Back */}
          <button onClick={() => router.back()}
            className="bg-white px-6 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition shadow-lg">
            ← Quay lại
          </button>

          {/* Card chính */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-orange-200">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-orange-700">{item.title}</h1>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="text-xs bg-orange-100 text-orange-600 px-3 py-1 rounded-full capitalize">
                  {item.level}
                </span>
                {item.topic && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-full">
                    {item.topic}
                  </span>
                )}
              </div>
            </div>

            {/* ── Audio Player ─────────────────────────────────────────── */}
            <div className="bg-orange-50 rounded-2xl p-6 border-2 border-orange-200 space-y-4">
              <p className="text-sm text-gray-500 font-medium text-center">🎧 Bài nghe</p>

              {/* Play button */}
              <div className="flex justify-center">
                <button
                  onClick={handlePlay}
                  className={`w-16 h-16 rounded-full text-3xl text-white shadow-lg transition-all
                    ${isPlaying
                      ? "bg-orange-600 scale-110"
                      : "bg-gradient-to-r from-orange-400 to-orange-500 hover:scale-105"}`}
                >
                  {isPlaying ? "⏸" : "▶️"}
                </button>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div
                  ref={progressRef}
                  onClick={handleSeek}
                  className="w-full h-3 bg-orange-200 rounded-full cursor-pointer relative overflow-hidden"
                >
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Speed controls */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-gray-400 font-medium">Tốc độ:</span>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition
                      ${playbackRate === s
                        ? "bg-orange-500 text-white shadow"
                        : "bg-white text-gray-500 border border-gray-200 hover:border-orange-300"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {audioError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-red-500 text-sm">{audioError}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Quiz Section ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border-4 border-blue-200">
            <h2 className="text-xl font-bold text-blue-700 mb-6">📝 Câu hỏi trắc nghiệm</h2>

            {genLoading && (
              <div className="text-center py-12 text-gray-400">
                <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-400 mx-auto mb-4" />
                <p>Generating questions...</p>
              </div>
            )}

            {!genLoading && gqs.length > 0 && (
              <>
                {submitted && (
                  <div className={`mb-6 rounded-2xl p-5 text-center border-2
                    ${score === gqs.length
                      ? "bg-green-50 border-green-300"
                      : score >= gqs.length / 2
                        ? "bg-yellow-50 border-yellow-300"
                        : "bg-red-50 border-red-300"}`}>
                    <p className="text-4xl mb-1">
                      {score === gqs.length ? "🏆" : score >= gqs.length / 2 ? "👍" : "💪"}
                    </p>
                    <p className="text-2xl font-bold text-gray-700">{score}/{gqs.length} câu đúng</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {score === gqs.length
                        ? "Xuất sắc! Bạn trả lời đúng tất cả!"
                        : score >= gqs.length / 2
                          ? "Tốt lắm! Hãy xem lại những câu sai nhé."
                          : "Hãy nghe lại và thử thêm lần nữa!"}
                    </p>
                  </div>
                )}

                <div className="space-y-6">
                  {gqs.map((q, qi) => (
                    <div key={qi} className="border-2 border-gray-100 rounded-2xl p-5">
                      <p className="font-semibold text-gray-800 mb-4">
                        <span className="text-blue-500 font-bold mr-2">{qi + 1}.</span>
                        {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => handleSelect(qi, opt)}
                            disabled={submitted}
                            className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all
                              ${getOptionStyle(qi, opt, q.answer)}`}
                          >
                            <span className="font-bold mr-2">{opt.charAt(0)}.</span>
                            {opt.slice(3)}
                            {submitted && opt.charAt(0) === q.answer && (
                              <span className="float-right text-green-500 font-bold">✓</span>
                            )}
                            {submitted && opt.charAt(0) === selectedAnswers[qi]?.charAt(0) && opt.charAt(0) !== q.answer && (
                              <span className="float-right text-red-500 font-bold">✗</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-end">
                  {!submitted ? (
                    <button onClick={handleSubmit}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow transition">
                      Submit ✅
                    </button>
                  ) : (
                    <button onClick={handleRetry}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow transition">
                      Try again 🔁
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default function ListenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600" />
      </div>
    }>
      <ListenContent />
    </Suspense>
  )
}