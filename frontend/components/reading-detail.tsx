"use client"

import { useState, useEffect } from "react"

interface ReadingDetailProps {
  lesson: {
    id: number
    topic?: string
    title?: string
    difficulty: "easy" | "medium" | "hard"
  }
  data: any
}

export default function ReadingDetail({ lesson, data }: ReadingDetailProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [showScorePopup, setShowScorePopup] = useState(false)

  const questions = data?.questions || []
  const currentQuestion = questions[currentQuestionIndex]

  // chọn đáp án
  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionIndex,
    }))
  }

  // next
  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    } else {
      setShowScorePopup(true)
      setShowResults(true)
    }
  }

  // close popup bằng Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && showScorePopup) {
        setShowScorePopup(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showScorePopup])

  // tính điểm
  const correctCount = Object.entries(selectedAnswers).filter(
    ([idx, answer]) =>
      questions[Number(idx)]?.correct_index === answer
  ).length

  // tránh crash
  if (!data || questions.length === 0) {
    return (
      <div className="p-10 text-center text-xl font-semibold">
        Loading reading lesson...
      </div>
    )
  }

  // ================= RESULT =================
  if (showResults) {
    const percentage = Math.round((correctCount / questions.length) * 100)

    return (
      <div className="space-y-8">
        {/* Popup */}
        {showScorePopup && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowScorePopup(false)}
          >
            <div
              className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 text-7xl">
                {percentage === 100 ? "🎉" : "👏"}
              </div>

              <h2 className="text-3xl font-bold mb-4">Quiz Complete!</h2>

              <div className="bg-gradient-to-br from-orange-400 to-rose-400 rounded-2xl p-6 text-white">
                <p className="text-5xl font-bold">
                  {correctCount}/{questions.length}
                </p>
                <p className="text-xl mt-2">{percentage}%</p>
              </div>

              <button
                onClick={() => setShowScorePopup(false)}
                className="mt-6 bg-orange-400 hover:bg-orange-500 text-white px-6 py-3 rounded-xl w-full"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Result UI */}
        <div className="bg-gradient-to-br from-orange-300 to-rose-400 rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="text-6xl font-bold text-white mb-4">
            {correctCount}/{questions.length}
          </h2>

          <p className="text-white text-2xl mb-6">
            {percentage >= 80
              ? "Excellent!"
              : percentage >= 50
              ? "Good job!"
              : "Try again!"}
          </p>

          <button
            onClick={() => {
              setCurrentQuestionIndex(0)
              setSelectedAnswers({})
              setShowResults(false)
            }}
            className="bg-white text-orange-500 px-8 py-4 rounded-2xl font-bold text-xl hover:bg-orange-50"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ================= MAIN =================
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* STORY */}
        <div className="bg-gradient-to-br from-orange-100 to-rose-100 rounded-3xl p-8 shadow-lg border-4 border-orange-200">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-3xl">📖</span>
            <h3 className="text-3xl font-bold text-orange-900">
              Reading Passage
            </h3>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md max-h-96 overflow-y-auto">
            <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
              {data.story}
            </p>
          </div>
        </div>

        {/* QUESTIONS */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border-4 border-orange-200">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-3xl">❓</span>
            <h3 className="text-3xl font-bold text-orange-900">
              Practice Questions
            </h3>
          </div>

          {/* progress */}
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="font-bold">
                Question {currentQuestionIndex + 1}/{questions.length}
              </span>
              <span className="text-orange-600 font-bold">
                {Math.round(
                  ((currentQuestionIndex + 1) / questions.length) * 100
                )}
                %
              </span>
            </div>

            <div className="w-full bg-gray-200 h-3 rounded-full">
              <div
                className="bg-orange-400 h-3 rounded-full"
                style={{
                  width: `${
                    ((currentQuestionIndex + 1) / questions.length) * 100
                  }%`,
                }}
              />
            </div>
          </div>

          {/* question */}
          <p className="text-xl font-semibold mb-4">
            {currentQuestion.question}
          </p>

          {/* choices */}
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

          {/* next */}
          <button
            onClick={handleNext}
            disabled={selectedAnswers[currentQuestionIndex] === undefined}
            className={`w-full mt-6 py-4 rounded-2xl text-xl font-bold ${
              selectedAnswers[currentQuestionIndex] === undefined
                ? "bg-gray-300 text-gray-500"
                : "bg-orange-400 hover:bg-orange-500 text-white"
            }`}
          >
            {currentQuestionIndex === questions.length - 1
              ? "Finish"
              : "Next Question"}
          </button>
        </div>
      </div>
    </div>
  )
}