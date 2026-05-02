"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/header"
import { FeedbackData } from "@/lib/feedback-scoring"

// ─── Loading overlay ──────────────────────────────────────────────────────────

function LoadingOverlay() {
  const messages = [
    "Reading your essay...",
    "Checking grammar...",
    "Finding improvements...",
    "Almost done!",
  ]
  const [msgIdx, setMsgIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length)
    }, 1800)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-pink-100/80 backdrop-blur-sm">
      {/* Spinner */}
      <div className="w-16 h-16 mb-6 rounded-full border-4 border-pink-300 border-t-pink-600 animate-spin" />
      <p className="text-pink-700 font-bold text-xl animate-pulse">{messages[msgIdx]}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WritingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [essay, setEssay] = useState("")
  const [fontSize, setFontSize] = useState(16)
  const [lineHeight, setLineHeight] = useState(1.5)
  const [fontFamily, setFontFamily] = useState("sans")
  const [timeRemaining, setTimeRemaining] = useState(20 * 60)
  const [isTimeUp, setIsTimeUp] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Ref to prevent double-submit from auto-submit + manual click race
  const hasSubmitted = useRef(false)

  const essayPrompt =
    searchParams.get("topic") ??
    "Write about anything you'd like. Express your thoughts freely!"

  // ── Timer ──
  useEffect(() => {
    if (isTimeUp) return
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) { setIsTimeUp(true); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isTimeUp])

  // ── Auto-submit when time is up ──
  useEffect(() => {
    if (isTimeUp && essay.trim()) handleSubmit()
  }, [isTimeUp])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // ── Submit → call backend API ──
  const handleSubmit = async () => {
    if (!essay.trim() || hasSubmitted.current) return
    hasSubmitted.current = true
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/writing/feedback/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: essayPrompt, essay }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail ?? `Server error ${res.status}`)
      }

      const { data } = await res.json()

      // Merge essay into the payload — backend doesn't echo it back
      const feedbackData: FeedbackData = { essay, topic: essayPrompt, ...data }
      sessionStorage.setItem("writingFeedback", JSON.stringify(feedbackData))

      router.push("/write/feedback")
    } catch (err: any) {
      console.error("Submit error:", err)
      setSubmitError(err?.message ?? "Something went wrong. Please try again.")
      hasSubmitted.current = false   // allow retry
      setIsSubmitting(false)
    }
  }

  const fontFamilyMap = { sans: "font-sans", serif: "font-serif", mono: "font-mono" }
  const characterCount = essay.length
  const wordCount = essay.split(/\s+/).filter((w) => w).length

  // Timer colour: red when < 2 min
  const timerColor = timeRemaining < 120 ? "text-red-600 animate-pulse" : "text-pink-700"

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-rose-100 to-pink-100">
      {isSubmitting && <LoadingOverlay />}

      <Header userAvatar="👧" />

      <div className="p-6 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex flex-col">

          <button
            onClick={() => router.back()}
            className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-orange-300 w-fit"
          >
            ← Back
          </button>

          <div className="text-center mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-pink-600">
              Writing Practice
            </h1>
          </div>

          {/* Error banner */}
          {submitError && (
            <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-2xl px-6 py-4 flex items-center justify-between">
              <p className="text-red-700 font-medium">⚠️ {submitError}</p>
              <button
                onClick={() => setSubmitError(null)}
                className="text-red-400 hover:text-red-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex-1 flex flex-col gap-6">

            {/* Topic + timer row */}
            <div className="flex gap-4 items-stretch">
              {/* Topic */}
              <div className="flex-1 bg-white/90 backdrop-blur rounded-3xl p-6 shadow-lg border-4 border-pink-200">
                <h2 className="text-xl font-bold text-pink-600 mb-2">Topic:</h2>
                <p className="text-gray-800 leading-relaxed font-medium">{essayPrompt}</p>
              </div>

              {/* Timer */}
              <div className="bg-white/90 backdrop-blur rounded-3xl px-8 py-6 shadow-lg border-4 border-pink-200 flex flex-col items-center justify-center min-w-[140px]">
                <p className="text-sm font-bold text-pink-400 mb-1 uppercase tracking-wide">Time left</p>
                <p className={`text-4xl font-mono font-bold tabular-nums ${timerColor}`}>
                  {formatTime(timeRemaining)}
                </p>
                {isTimeUp && (
                  <p className="text-xs text-red-500 font-semibold mt-1">Time's up!</p>
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col">
              <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200 flex flex-col h-full">

                {/* Toolbar */}
                <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b-2 border-pink-200">
                  <div>
                    <label className="block text-sm font-bold text-pink-700 mb-2">Font Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min="12" max="24" value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="flex-1 cursor-pointer accent-pink-500"
                      />
                      <span className="text-xs font-bold text-pink-700 w-8">{fontSize}px</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-pink-700 mb-2">Font Family</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-pink-300 rounded-lg bg-white text-pink-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="sans">Sans Serif</option>
                      <option value="serif">Serif</option>
                      <option value="mono">Monospace</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-pink-700 mb-2">Line Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min="1" max="3" step="0.5" value={lineHeight}
                        onChange={(e) => setLineHeight(Number(e.target.value))}
                        className="flex-1 cursor-pointer accent-pink-500"
                      />
                      <span className="text-xs font-bold text-pink-700 w-8">{lineHeight}</span>
                    </div>
                  </div>
                </div>

                {/* Textarea */}
                <div className="flex-1 mb-4 min-h-96">
                  <textarea
                    value={essay}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setEssay(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    className={`w-full p-6 border-2 border-pink-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none bg-pink-50/50 text-gray-800 placeholder:text-pink-300 ${fontFamilyMap[fontFamily as keyof typeof fontFamilyMap]} disabled:opacity-60`}
                    style={{ fontSize: `${fontSize}px`, lineHeight }}
                    placeholder="Start writing your essay here..."
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t-2 border-pink-200">
                  <div className="text-sm font-semibold text-pink-700">
                    {characterCount} characters · {wordCount} words
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!essay.trim() || isSubmitting}
                    className={`px-8 py-3 rounded-full font-bold text-white text-lg transition-all ${
                      essay.trim() && !isSubmitting
                        ? "bg-gradient-to-r from-pink-400 to-pink-500 hover:scale-105"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {isSubmitting ? "Grading…" : "Submit Essay"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}