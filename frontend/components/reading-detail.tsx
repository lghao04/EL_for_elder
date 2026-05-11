"use client"

import { useState, useEffect } from "react"
import { Lock, Trophy } from "lucide-react"
import { STREAK_UPDATED } from "@/constants/events"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface ReadingDetailProps {
  lesson: {
    id: string
    topic?: string
    title?: string
    difficulty: "easy" | "medium" | "hard"
  }
  data: any
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("access_token") || localStorage.getItem("token")
}

function getUserIdFromToken(token: string): string {
  try {
    const p = JSON.parse(atob(token.split(".")[1]))
    return p.sub || p.user_id || p.id || ""
  } catch { return "" }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReadingDetail({ lesson, data }: ReadingDetailProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers]           = useState<Record<number, number>>({})
  const [showResults, setShowResults]                   = useState(false)
  const [showScorePopup, setShowScorePopup]             = useState(false)

  // submit state
  const [submitResult, setSubmitResult]   = useState<SubmitResult | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError]     = useState<string | null>(null)

  const questions      = data?.questions || []
  const currentQuestion = questions[currentQuestionIndex]

  // ── Keyboard shortcut ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && showScorePopup) setShowScorePopup(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showScorePopup])

  // ── Quiz logic ────────────────────────────────────────────────────────────
  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIndex]: optionIndex }))
  }

  const correctCount = Object.entries(selectedAnswers).filter(
    ([idx, answer]) => questions[Number(idx)]?.correct_index === answer
  ).length

  // ── Submit to backend ─────────────────────────────────────────────────────
  const submitToBackend = async (correct: number) => {
    const token = getToken()
    if (!token) return

    setSubmitLoading(true)
    setSubmitError(null)

    try {
      const res = await fetch(`${API}/lessons/${lesson.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id:         getUserIdFromToken(token),
          correct_answers: correct,
          total_questions: questions.length,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Submit thất bại")
      }

      const result: SubmitResult = await res.json()
      setSubmitResult(result)

      // Dispatch STREAK_UPDATED để RightSidebar refresh
      if (result.streak.counted && result.streak.current !== null) {
        window.dispatchEvent(
          new CustomEvent(STREAK_UPDATED, {
            detail: { current_streak: result.streak.current },
          })
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định"
      setSubmitError(msg)
      console.error("❌ Submit reading error:", msg)
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    } else {
      // Câu cuối → tính điểm trước khi set state
      const correct = Object.entries(selectedAnswers).filter(
        ([idx, answer]) => questions[Number(idx)]?.correct_index === answer
      ).length
      setShowResults(true)
      setShowScorePopup(true)
      submitToBackend(correct)
    }
  }

  const handleRetry = () => {
    setSelectedAnswers({})
    setShowResults(false)
    setShowScorePopup(false)
    setCurrentQuestionIndex(0)
    setSubmitResult(null)
    setSubmitError(null)
  }

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!data || questions.length === 0) {
    return (
      <div className="p-10 text-center text-xl font-semibold">
        Loading reading lesson...
      </div>
    )
  }

  const percentage = Math.round((correctCount / questions.length) * 100)
  const record     = submitResult?.record
  const scoreInfo  = submitResult?.score
  const streakInfo = submitResult?.streak
  const bonusInfo  = submitResult?.streak_bonus

  // ── Score Popup ───────────────────────────────────────────────────────────
  const renderScorePopup = () => (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setShowScorePopup(false)}
    >
      <div
        className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-7xl block mb-4">
          {correctCount === questions.length ? "🎉" : "👏"}
        </span>

        <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Complete!</h2>

        {/* Điểm bài này */}
        <div className="bg-gradient-to-br from-orange-400 to-rose-400 rounded-2xl p-5 mb-4">
          <p className="text-white text-5xl font-bold">{correctCount}/{questions.length}</p>
          <p className="text-white/90 text-xl mt-1">
            {correctCount === questions.length ? "Perfect!" : `${percentage}%`}
          </p>
        </div>

        {/* Loading */}
        {submitLoading && (
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-400" />
            <span>Đang lưu kết quả...</span>
          </div>
        )}

        {/* Error */}
        {submitError && (
          <p className="text-red-400 text-sm mb-4">⚠️ {submitError}</p>
        )}

        {/* Record info từ backend */}
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

            {/* Stats grid */}
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
                ${record.score_locked ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-100"}`}
              >
                <p className="text-xs text-gray-500 mb-1">Scored</p>
                <p className="text-xl font-bold text-gray-800">
                  {record.counted_attempts}/{record.max_counted_attempts}
                </p>
              </div>
            </div>

            {/* Score locked */}
            {record.score_locked && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-600">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>Điểm đã khoá — bài này không còn tính điểm nữa</span>
              </div>
            )}

            {/* Streak */}
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

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            disabled={record?.score_locked}
            className={`flex-1 border-2 px-5 py-3 rounded-2xl font-bold text-base transition
              ${record?.score_locked
                ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50"
                : "border-orange-400 text-orange-500 hover:bg-orange-50 bg-white"}`}
          >
            {record?.score_locked ? "🔒 Locked" : "Try Again"}
          </button>
          <button
            onClick={() => setShowScorePopup(false)}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-2xl font-bold text-base transition"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )

  // ── Result screen (sau khi đóng popup) ───────────────────────────────────
  if (showResults && !showScorePopup) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-orange-300 to-rose-400 rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="text-6xl font-bold text-white mb-4">
            {correctCount}/{questions.length}
          </h2>
          <p className="text-white text-2xl mb-6">
            {percentage >= 80 ? "Excellent!" : percentage >= 50 ? "Good job!" : "Try again!"}
          </p>
          <button
            onClick={handleRetry}
            disabled={record?.score_locked}
            className={`px-8 py-4 rounded-2xl font-bold text-xl transition
              ${record?.score_locked
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-white text-orange-500 hover:bg-orange-50"}`}
          >
            {record?.score_locked ? "🔒 Score Locked" : "Try Again"}
          </button>
        </div>
      </div>
    )
  }

  // ── Main quiz UI ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {showScorePopup && renderScorePopup()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Story */}
        <div className="bg-gradient-to-br from-orange-100 to-rose-100 rounded-3xl p-8 shadow-lg border-4 border-orange-200">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-3xl">📖</span>
            <h3 className="text-3xl font-bold text-orange-900">Reading Passage</h3>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-md max-h-96 overflow-y-auto">
            <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
              {data.story}
            </p>
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border-4 border-orange-200">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-3xl">❓</span>
            <h3 className="text-3xl font-bold text-orange-900">Practice Questions</h3>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="font-bold">
                Question {currentQuestionIndex + 1}/{questions.length}
              </span>
              <span className="text-orange-600 font-bold">
                {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full">
              <div
                className="bg-orange-400 h-3 rounded-full transition-all"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-xl font-semibold mb-4">{currentQuestion.question}</p>

          <div className="space-y-3">
            {currentQuestion.choices.map((choice: string, index: number) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                className={`w-full p-4 rounded-2xl text-left font-semibold transition ${
                  selectedAnswers[currentQuestionIndex] === index
                    ? "bg-orange-400 text-white"
                    : "bg-orange-50 border-2 border-orange-200 hover:bg-orange-100"
                }`}
              >
                {choice}
              </button>
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={selectedAnswers[currentQuestionIndex] === undefined}
            className={`w-full mt-6 py-4 rounded-2xl text-xl font-bold transition ${
              selectedAnswers[currentQuestionIndex] === undefined
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-orange-400 hover:bg-orange-500 text-white"
            }`}
          >
            {currentQuestionIndex === questions.length - 1 ? "Finish" : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  )
}