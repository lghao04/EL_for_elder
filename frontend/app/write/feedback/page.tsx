"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { FeedbackData, HighlightSpan } from "@/lib/feedback-scoring"

// ─── Tooltip component ────────────────────────────────────────────────────────

function HighlightTooltip({
  span,
  text,
}: {
  span: HighlightSpan
  text: string
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  const borderColor = span.type === "spelling" ? "border-red-400" : "border-orange-400"
  const bgColor     = span.type === "spelling" ? "bg-red-100 text-red-900" : "bg-orange-100 text-orange-900"
  const dotColor    = span.type === "spelling" ? "bg-red-400" : "bg-orange-400"

  return (
    <span className="relative inline" ref={ref}>
      {/* The underlined / highlighted word */}
      <span
        className={`${bgColor} px-0.5 rounded cursor-pointer border-b-2 ${borderColor} transition-colors hover:brightness-95`}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        tabIndex={0}
        aria-label={`Error: ${text}. Suggestion: ${span.corrected}`}
      >
        {text}
      </span>

      {/* Tooltip bubble */}
      {visible && (
        <span
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 pointer-events-none"
          role="tooltip"
        >
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />

          <span className="flex flex-col gap-1.5 bg-gray-800 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl">
            {/* Type badge */}
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
              <span className="uppercase tracking-wide font-bold text-gray-300 text-[10px]">
                {span.type}
              </span>
            </span>

            {/* Original → Corrected */}
            <span className="flex flex-col gap-0.5">
              <span>
                <span className="text-red-400 line-through">{span.original}</span>
                {" → "}
                <span className="text-green-400 font-semibold">{span.corrected}</span>
              </span>
            </span>

            {/* Explanation */}
            <span className="text-gray-300 leading-snug">{span.explanation}</span>
          </span>
        </span>
      )}
    </span>
  )
}

// ─── Essay renderer using char-offset spans ───────────────────────────────────

function EssayWithHighlights({
  essay,
  highlights,
}: {
  essay: string
  highlights: HighlightSpan[]
}) {
  // Sort just in case backend sends them out of order
  const sorted = [...highlights].sort((a, b) => a.start - b.start)

  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const span of sorted) {
    // Guard against overlapping or out-of-range spans
    if (span.start < cursor || span.end > essay.length) continue

    // Plain text before this span
    if (span.start > cursor) {
      parts.push(
        <span key={`plain-${cursor}`}>{essay.slice(cursor, span.start)}</span>
      )
    }

    // Highlighted span with tooltip
    const spanText = essay.slice(span.start, span.end)
    parts.push(
      <HighlightTooltip key={`hl-${span.start}`} span={span} text={spanText} />
    )

    cursor = span.end
  }

  // Remaining plain text
  if (cursor < essay.length) {
    parts.push(<span key={`plain-end`}>{essay.slice(cursor)}</span>)
  }

  return (
    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
      {parts}
    </p>
  )
}

// ─── Star rating row ──────────────────────────────────────────────────────────

const RATING_LABELS: Record<string, string> = {
  topic: "Topic",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  naturalEnglish: "Natural English",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const router = useRouter()
  const [feedback, setFeedback] = useState<FeedbackData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem("writingFeedback")
    if (stored) {
      setFeedback(JSON.parse(stored))
    }
  }, [])

  if (!feedback) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-200 to-pink-100 p-6 flex items-center justify-center">
        <p className="text-gray-800 text-lg font-semibold">Loading feedback...</p>
      </div>
    )
  }

  const errorCount = feedback.highlights.length

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-200 to-pink-100 p-6 flex flex-col">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-6 w-full flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-pink-600 hover:text-pink-700 font-semibold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-pink-600">Writing Feedback</h1>
        <div className="w-32" />
      </div>

      <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">

        {/* ── Essay with highlights ── */}
        <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-pink-600">Your Essay</h2>

            {/* Legend */}
            {errorCount > 0 && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-red-100 border-b-2 border-red-400" />
                  Spelling
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-orange-100 border-b-2 border-orange-400" />
                  Grammar
                </span>
                <span className="text-gray-400">(hover to see fix)</span>
              </div>
            )}
          </div>

          <div className="bg-pink-50 rounded-2xl p-6 border-2 border-pink-200 min-h-48 max-h-96 overflow-y-auto">
            <EssayWithHighlights
              essay={feedback.essay}
              highlights={feedback.highlights}
            />
          </div>

          {errorCount > 0 && (
            <p className="mt-3 text-sm text-gray-500 text-right">
              {errorCount} issue{errorCount > 1 ? "s" : ""} highlighted
            </p>
          )}
        </div>

        {/* ── Ratings ── */}
        <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200">
          <h3 className="text-xl font-bold text-pink-600 mb-5">Ratings</h3>
          <div className="space-y-4">
            {Object.entries(feedback.ratings).map(([key, value]) => (
              <div key={key} className="flex items-start gap-4">
                {/* Label + comment */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-gray-700">
                    {RATING_LABELS[key] ?? key}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">{value.label}</span>
                  <p className="text-sm text-gray-500 mt-0.5">{value.comment}</p>
                </div>
                {/* Stars */}
                <div className="flex gap-0.5 shrink-0 mt-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-2xl leading-none ${i < value.stars ? "text-yellow-400" : "text-gray-200"}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Overall Feedback ── */}
        <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200">
          <h3 className="text-xl font-bold text-pink-600 mb-3">Overall Feedback</h3>
          <div className="bg-pink-50 rounded-xl p-5 border-2 border-pink-200">
            <p className="text-gray-800">{feedback.overallFeedback}</p>
          </div>
        </div>

        {/* ── Grammar Errors ── */}
        {feedback.grammarErrors.length > 0 && (
          <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200">
            <h3 className="text-xl font-bold text-red-500 mb-5">Grammar Errors</h3>
            <div className="space-y-3">
              {feedback.grammarErrors.slice(0, 5).map((item, idx) => (
                <div key={idx} className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  {/* Original → Corrected */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-red-700 font-medium line-through">{item.original}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-700 font-semibold">{item.corrected}</span>
                  </div>
                  {/* Explanation */}
                  <p className="text-gray-600 text-sm">{item.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rewritten Sentences ── */}
        {feedback.rewrittenSentences.length > 0 && (
          <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200">
            <h3 className="text-xl font-bold text-blue-600 mb-5">Improved Sentences</h3>
            <div className="space-y-4">
              {feedback.rewrittenSentences.slice(0, 3).map((item, idx) => (
                <div key={idx} className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-2">
                  <p className="text-gray-500 text-sm line-through">{item.original}</p>
                  <p className="text-blue-800 font-medium">{item.improved}</p>
                  <p className="text-blue-600 text-sm">💡 {item.tip}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Topic Check ── */}
        <div
          className={`bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 ${
            feedback.topicCheck.isOnTopic ? "border-green-200" : "border-orange-200"
          }`}
        >
          <div
            className={`rounded-xl p-5 border-2 ${
              feedback.topicCheck.isOnTopic
                ? "bg-green-50 border-green-200"
                : "bg-orange-50 border-orange-200"
            }`}
          >
            <p
              className={`font-semibold mb-2 ${
                feedback.topicCheck.isOnTopic ? "text-green-700" : "text-orange-700"
              }`}
            >
              {feedback.topicCheck.isOnTopic ? "✓ On Topic" : "⚠ Topic Check"}
            </p>
            <p className="text-gray-700 text-sm">{feedback.topicCheck.comment}</p>
          </div>
        </div>

        {/* ── Encouragement ── */}
        <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200">
          <div className="bg-gradient-to-r from-pink-100 to-orange-100 rounded-xl p-5 border-2 border-pink-200">
            <p className="text-gray-800 text-center italic">"{feedback.encouragement}"</p>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-4 justify-center pb-8">
          <button
            onClick={() => {
              const dest = feedback.topic
                ? `/write?topic=${encodeURIComponent(feedback.topic)}`
                : "/write"
              router.push(dest)
            }}
            className="px-8 py-3 rounded-full font-bold text-white text-lg bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 shadow-lg hover:shadow-xl transition-all"
          >
            Write Again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-8 py-3 rounded-full font-bold text-white text-lg bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 shadow-lg hover:shadow-xl transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}