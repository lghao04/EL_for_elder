"use client"

import { useState } from "react"

interface Question {
  id: number
  question: string
  options: string[]
  correctAnswer: number
  type: "mcq" | "trueFalse" | "fillBlank"
}

interface LessonDetailProps {
  lesson: {
    id: number
    topic: string
    title: string
    difficulty: "easy" | "medium" | "hard"
  }
}

const sampleQuestions: Question[] = [
  {
    id: 1,
    question: "What does the speaker say first?",
    options: ["Good morning", "Hello friend", "Nice to meet you", "How are you"],
    correctAnswer: 0,
    type: "mcq",
  },
  {
    id: 2,
    question: "Is the greeting formal?",
    options: ["True", "False"],
    correctAnswer: 0,
    type: "trueFalse",
  },
  {
    id: 3,
    question: "The speaker says '___ to meet you'",
    options: ["glad", "nice", "happy", "good"],
    correctAnswer: 1,
    type: "fillBlank",
  },
]

export default function LessonDetail({ lesson }: LessonDetailProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<"slow" | "normal" | "fast">("slow")
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)

  const currentQuestion = sampleQuestions[currentQuestionIndex]

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIndex,
    }))
  }

  const handleNext = () => {
    if (currentQuestionIndex < sampleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      setShowResults(true)
    }
  }

  const handlePlayAudio = () => {
    setIsPlaying(!isPlaying)
    if (!isPlaying) {
      setTimeout(() => setIsPlaying(false), 3000)
    }
  }

  const correctCount = Object.entries(selectedAnswers).filter(
    ([id, answer]) => sampleQuestions.find((q) => q.id === Number.parseInt(id))?.correctAnswer === answer,
  ).length

  if (showResults) {
    return (
      <div className="space-y-8">
        {/* Results */}
        <div className="bg-gradient-to-br from-yellow-300 to-orange-400 rounded-3xl p-12 text-center shadow-2xl">
          <p className="text-white text-3xl mb-4">Great Job!</p>
          <h2 className="text-7xl font-bold text-white mb-6">
            {correctCount}/{sampleQuestions.length}
          </h2>
          <p className="text-white text-2xl mb-8">
            {correctCount === sampleQuestions.length
              ? "Perfect Score!"
              : `${Math.round((correctCount / sampleQuestions.length) * 100)}% Correct`}
          </p>
          <button
            onClick={() => {
              setCurrentQuestionIndex(0)
              setSelectedAnswers({})
              setShowResults(false)
              setIsPlaying(false)
            }}
            className="bg-white text-orange-500 px-8 py-4 rounded-2xl font-bold text-2xl hover:bg-orange-50 transition shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Lesson Info */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border-4 border-blue-200">
        <h2 className="text-4xl font-bold text-gray-800 mb-2">{lesson.title}</h2>
        <p className="text-2xl text-gray-600">{lesson.topic}</p>
        <span className="inline-block mt-4 text-lg px-6 py-2 rounded-full bg-blue-100 text-blue-600 font-bold">
          {lesson.difficulty}
        </span>
      </div>

      {/* Recording/Audio Section */}
      <div className="bg-gradient-to-br from-green-300 to-green-400 rounded-3xl p-12 shadow-2xl">
        <div className="text-center space-y-6">
          <p className="text-white text-3xl font-bold">Listen to the Recording</p>

          {/* Speed Control Buttons */}
          <div className="flex justify-center gap-3 flex-wrap">
            {(["slow", "normal", "fast"] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-6 py-3 rounded-2xl font-bold text-lg transition transform ${
                  playbackSpeed === speed
                    ? "bg-white text-green-600 shadow-lg scale-110"
                    : "bg-green-200 text-white hover:bg-green-100"
                }`}
              >
                {speed === "slow" ? "🐢 Slow" : speed === "normal" ? "▶️ Normal" : "🚀 Fast"}
              </button>
            ))}
          </div>

          {/* Play Button */}
          <button
            onClick={handlePlayAudio}
            className={`mx-auto rounded-full p-12 transition-all transform shadow-xl ${
              isPlaying ? "bg-red-500 hover:bg-red-600 scale-110" : "bg-white hover:scale-105"
            }`}
          >
            <span className="text-7xl block">{isPlaying ? "⏹️" : "▶️"}</span>
          </button>

          {/* Audio Playing Indicator */}
          {isPlaying && (
            <div className="flex justify-center gap-1">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-full animate-pulse"
                  style={{
                    width: "8px",
                    height: `${Math.random() * 40 + 10}px`,
                    animationDelay: `${i * 0.08}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Questions Section */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-4 border-purple-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-3xl font-bold text-gray-800">
              Question {currentQuestionIndex + 1}/{sampleQuestions.length}
            </h3>
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(((currentQuestionIndex + 1) / sampleQuestions.length) * 100)}%
            </div>
          </div>

          {/* Question Text */}
          <p className="text-2xl text-gray-700 mb-8 font-semibold">{currentQuestion.question}</p>

          {/* Answer Options */}
          <div className="space-y-4">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                className={`w-full p-6 rounded-2xl text-2xl font-bold transition transform hover:scale-105 ${
                  selectedAnswers[currentQuestion.id] === index
                    ? "bg-purple-500 text-white shadow-lg scale-105"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Next/Submit Button */}
        <button
          onClick={handleNext}
          disabled={selectedAnswers[currentQuestion.id] === undefined}
          className={`w-full py-6 rounded-2xl text-2xl font-bold transition shadow-lg ${
            selectedAnswers[currentQuestion.id] === undefined
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600 text-white transform hover:scale-105"
          }`}
        >
          {currentQuestionIndex === sampleQuestions.length - 1 ? "Finish" : "Next Question"}
        </button>
      </div>
    </div>
  )
}
