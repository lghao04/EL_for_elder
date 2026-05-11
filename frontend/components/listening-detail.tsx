"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Headphones, Volume2, Play, Pause, ChevronRight, Trophy, Lock } from "lucide-react"
import Header from "@/components/header"
import { STREAK_UPDATED } from "@/constants/events"

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

// ── Kiểu dữ liệu từ API backend ──────────────────────────────────────────────

interface AttemptRecord {
  total_attempts: number
  counted_attempts: number
  max_counted_attempts: number
  best_score: number
  best_raw: number
  last_score: number
  score_locked: boolean
  first_attempt_at: string | null
  last_attempt_at: string | null
}

interface SubmitResult {
  status: string
  skill: string
  score: {
    normalized: number
    raw: number
    max_raw: number
    details: Record<string, number>
    attempt_number: number
    score_counted: boolean
    message: string
  }
  record: AttemptRecord
  streak: {
    counted: boolean
    current: number | null
    is_new_day: boolean | null
  }
  streak_bonus: {
    awarded: boolean
    points: number
    new_total: number | null
  }
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

  // ── Submit state ──────────────────────────────────────────────────────────
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && showScorePopup) setShowScorePopup(false)
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [showScorePopup])

  // ── Audio helpers ─────────────────────────────────────────────────────────
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsPlaying(false)
  }

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

  const getScore = () =>
    gqs.filter((q, i) => selectedAnswers[i]?.charAt(0) === q.answer).length

  // ── Submit to backend ─────────────────────────────────────────────────────
  const submitToBackend = async (correctCount: number) => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token")
    if (!token) return  // không có auth thì bỏ qua

    setSubmitLoading(true)
    setSubmitError(null)

    try {
      const res = await fetch(`${API}/listen/${item.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: getUserIdFromToken(token),
          correct_answers: correctCount,
          total_questions: gqs.length,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Submit thất bại")
      }

      const data: SubmitResult = await res.json()
      setSubmitResult(data)

      // Dispatch STREAK_UPDATED nếu streak có thay đổi
      if (data.streak.counted && data.streak.current !== null) {
        window.dispatchEvent(
          new CustomEvent(STREAK_UPDATED, {
            detail: {
              current_streak: data.streak.current,
              // RightSidebar sẽ fetch lại longest/total nếu cần
            },
          })
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định"
      setSubmitError(msg)
      console.error("❌ Submit error:", msg)
    } finally {
      setSubmitLoading(false)
    }
  }

  /** Lấy user_id từ JWT payload (base64 decode phần 2) */
  const getUserIdFromToken = (token: string): string => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      return payload.sub || payload.user_id || payload.id || ""
    } catch {
      return ""
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < gqs.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // Câu cuối → dừng audio, tính điểm, gọi API
      stopAudio()
      const correctCount = getScore()  // tính trước khi set submitted
      setSubmitted(true)
      setShowScorePopup(true)
      submitToBackend(correctCount)
    }
  }

  const handleRetry = () => {
    setSelectedAnswers({})
    setSubmitted(false)
    setShowScorePopup(false)
    setCurrentQuestionIndex(0)
    setSubmitResult(null)
    setSubmitError(null)
  }

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

  // ── Score Popup content ───────────────────────────────────────────────────
  const renderScorePopup = () => {
    const record = submitResult?.record
    const scoreInfo = submitResult?.score
    const streakInfo = submitResult?.streak
    const bonusInfo = submitResult?.streak_bonus

    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={() => setShowScorePopup(false)}
      >
        <div
          className="bg-white rounded-3xl p-8 md:p-10 max-w-md w-full text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-7xl block mb-4">
            {score === gqs.length ? "🎉" : "👏"}
          </span>

          <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>

          {/* Điểm bài này */}
          <div className="bg-gradient-to-br from-pink-500 to-orange-500 rounded-2xl p-5 mb-4">
            <p className="text-white text-5xl font-bold">{score}/{gqs.length}</p>
            <p className="text-white/90 text-xl mt-1">
              {score === gqs.length ? "Perfect!" : `${Math.round((score / gqs.length) * 100)}%`}
            </p>
          </div>

          {/* Thông tin attempt từ backend */}
          {submitLoading && (
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-400" />
              <span>Đang lưu kết quả...</span>
            </div>
          )}

          {submitError && (
            <p className="text-red-400 text-sm mb-4">⚠️ {submitError}</p>
          )}

          {record && !submitLoading && (
            <div className="space-y-3 mb-5 text-left">

              {/* Thông báo attempt */}
              <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2
                ${scoreInfo?.score_counted
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-orange-50 text-orange-700 border border-orange-200"}`}
              >
                <span className="mt-0.5">{scoreInfo?.score_counted ? "✅" : "ℹ️"}</span>
                <span>{scoreInfo?.message}</span>
              </div>

              {/* Best score + attempts */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Best Score</p>
                  <p className="text-xl font-bold text-gray-800">{record.best_score.toFixed(0)}%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Attempts</p>
                  <p className="text-xl font-bold text-gray-800">{record.total_attempts}</p>
                </div>
                <div className={`rounded-xl p-3 text-center border
                  ${record.score_locked
                    ? "bg-red-50 border-red-200"
                    : "bg-blue-50 border-blue-100"}`}
                >
                  <p className="text-xs text-gray-500 mb-1">Scored</p>
                  <p className="text-xl font-bold text-gray-800">
                    {record.counted_attempts}/{record.max_counted_attempts}
                  </p>
                </div>
              </div>

              {/* Score locked badge */}
              {record.score_locked && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  <span>Điểm đã khoá — bài này không còn tính điểm nữa</span>
                </div>
              )}

              {/* Streak info */}
              {streakInfo?.counted && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-sm text-orange-700">
                  <span>🔥</span>
                  <span>
                    Streak: <strong>{streakInfo.current} ngày</strong>
                    {streakInfo.is_new_day && " — ngày mới!"}
                  </span>
                </div>
              )}

              {/* Streak bonus */}
              {bonusInfo?.awarded && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2 text-sm text-yellow-700 font-semibold">
                  <Trophy className="w-4 h-4 flex-shrink-0" />
                  <span>+{bonusInfo.points} điểm thưởng streak! 🎊</span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              disabled={record?.score_locked}
              className={`flex-1 border-2 px-5 py-3 rounded-2xl font-bold text-base transition
                ${record?.score_locked
                  ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50"
                  : "border-pink-400 text-pink-500 hover:bg-pink-50 bg-white"}`}
            >
              {record?.score_locked ? "🔒 Locked" : "Try Again"}
            </button>
            <button
              onClick={() => { stopAudio(); router.back() }}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-2xl font-bold text-base transition"
            >
              Quit
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-orange-50 to-yellow-100">
      <Header userAvatar="👧" />

      {showScorePopup && renderScorePopup()}

      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Back */}
          <button
            onClick={() => { stopAudio(); router.back() }}
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