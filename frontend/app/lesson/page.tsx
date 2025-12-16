"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Header from "../../components/header"
import { useState, useEffect, useRef } from "react"

// Định nghĩa kiểu dữ liệu cho Question
interface Question {
  type: string;
  question: string;
  choices: string[];
  answer: number;
  correct_index: number;
  correct_text: string;
}

// Định nghĩa kiểu dữ liệu cho Lesson
interface LessonData {
  id: string;
  story: string;
  audio_url?: string;
  questions: Question[];
  score: number;
}

type PlaybackSpeed = 0.75 | 1 | 1.25;

export default function LessonPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)

  // Lấy ID từ URL
  const lessonId = searchParams.get("id") || "1"

  // State
  const [lesson, setLesson] = useState<LessonData | null>(null) 
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [audioLoading, setAudioLoading] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  
  // State cho questions
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<{[key: number]: number}>({})
  const [showResults, setShowResults] = useState(false)

  // Gọi API khi component được mount
  useEffect(() => {
    const fetchLessonData = async () => {
      try {
        setLoading(true)
        setAudioLoading(true)
        
        const response = await fetch(
          `http://localhost:8000/api/lessons/${lessonId}`
        )
        
        if (!response.ok) {
          throw new Error("Không thể lấy dữ liệu bài học")
        }

        const data = await response.json()
        setLesson(data)
        setAudioLoading(false)
      } catch (err) {
        console.error(err)
        setError("Có lỗi xảy ra khi tải bài học.")
        setAudioLoading(false)
      } finally {
        setLoading(false)
      }
    }

    if (lessonId) {
      fetchLessonData()
    }
  }, [lessonId])

  // Handle playback speed change
  const handleSpeedChange = (speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed)
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }

  // Xử lý chọn answer
  const handleSelectAnswer = (questionIndex: number, answerIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }))
  }

  // Tính điểm
  const calculateScore = () => {
    if (!lesson) return 0
    let correct = 0
    lesson.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_index) {
        correct++
      }
    })
    return correct
  }

  // Save progress to backend
  const saveProgressToBackend = async (lessonId: string, score: number) => {
    try {
      const token = localStorage.getItem('token')
      
      if (!token) {
        console.log('⚠️ No auth token, cannot save progress')
        return
      }

      console.log('💾 Saving progress to backend:', { lessonId, score })

      const response = await fetch('http://localhost:8000/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          score: score
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Progress saved to backend:', data)
      } else {
        const errorText = await response.text()
        console.error('❌ Failed to save progress:', response.status, errorText)
      }
    } catch (error) {
      console.error('❌ Error saving progress:', error)
    }
  }

  // Xử lý next question
  const handleNext = () => {
    if (currentQuestionIndex < (lesson?.questions.length || 0) - 1) {
      // Chuyển sang câu hỏi tiếp theo
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      // Câu hỏi cuối cùng - Submit quiz
      console.log('🎯 Submitting quiz...')
      
      // Tính điểm
      const score = calculateScore()
      console.log('📊 Score:', score, 'out of', lesson?.questions.length)
      console.log('📝 Lesson ID:', lesson?.id)
      
      // Gọi popup + save DB
      if (typeof window !== 'undefined' && lesson?.id) {
        // Try to call global function from ListenTab first
        if ((window as any).handleQuizComplete) {
          console.log('✅ Calling handleQuizComplete from ListenTab')
          ;(window as any).handleQuizComplete(lesson.id, score, lesson.questions.length)
        } else {
          // Fallback: Save directly if ListenTab not mounted
          console.log('⚠️ handleQuizComplete not found, saving directly...')
          saveProgressToBackend(lesson.id, score)
        }
      }
      
      // Show results sau 1.5s (để user xem popup trước)
      setTimeout(() => {
        console.log('📋 Showing results...')
        setShowResults(true)
      }, 1500)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  // Reset quiz
  const handleRetry = () => {
    setSelectedAnswers({})
    setCurrentQuestionIndex(0)
    setShowResults(false)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 animate-pulse mb-4">
            🎵 Loading Lesson...
          </div>
          <div className="text-lg text-gray-600">
            Please wait while we prepare your lesson
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">😢</div>
          <div className="text-red-500 font-bold text-xl mb-4">
            {error || "Lesson not found"}
          </div>
          <button 
            onClick={() => router.back()} 
            className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition"
          >
            ← Back to Lessons
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = lesson.questions[currentQuestionIndex]
  const totalQuestions = lesson.questions.length
  const score = calculateScore()
  const percentage = Math.round((score / totalQuestions) * 100)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" />

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-2 border-gray-300"
          >
            ← Back to Lessons
          </button>

          {/* Audio Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  🎧 Listening Practice
                </h1>
              </div>
            </div>
            
            {/* Audio Player */}
            {audioLoading ? (
              <div className="p-6 bg-blue-50 rounded-lg text-center">
                <p className="text-sm font-semibold text-gray-600 animate-pulse">
                  🎵 Generating audio...
                </p>
              </div>
            ) : lesson.audio_url ? (
              <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <span className="text-3xl mr-3">🎧</span>
                    <div>
                      <p className="text-lg font-bold text-gray-800">
                        Listen to the story
                      </p>
                      <p className="text-sm text-gray-600">
                        Answer the questions based on what you hear
                      </p>
                    </div>
                  </div>
                </div>

                {/* Audio Element */}
                <audio 
                  ref={audioRef}
                  controls 
                  className="w-full mb-4"
                  src={`http://localhost:8000${lesson.audio_url}`}
                  preload="metadata"
                  onLoadedMetadata={() => {
                    if (audioRef.current) {
                      audioRef.current.playbackRate = playbackSpeed
                    }
                  }}
                >
                  Your browser does not support the audio element.
                </audio>

                {/* Playback Speed Controls */}
                <div className="flex items-center justify-center gap-3 pt-4 border-t border-blue-200">
                  <span className="text-sm font-semibold text-gray-700 mr-2">
                    ⚡ Speed:
                  </span>
                  <button
                    onClick={() => handleSpeedChange(0.75)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      playbackSpeed === 0.75
                        ? "bg-blue-500 text-white shadow-md scale-105"
                        : "bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-300"
                    }`}
                  >
                    🐢 Slow (0.75x)
                  </button>
                  <button
                    onClick={() => handleSpeedChange(1)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      playbackSpeed === 1
                        ? "bg-blue-500 text-white shadow-md scale-105"
                        : "bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-300"
                    }`}
                  >
                    ▶️ Normal (1x)
                  </button>
                  <button
                    onClick={() => handleSpeedChange(1.25)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                      playbackSpeed === 1.25
                        ? "bg-blue-500 text-white shadow-md scale-105"
                        : "bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-300"
                    }`}
                  >
                    🚀 Fast (1.25x)
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                <p className="text-sm text-yellow-700">
                  ⚠️ Audio not available for this lesson
                </p>
              </div>
            )}

            {/* Listening Tips */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <p className="text-sm font-semibold text-blue-800 mb-2">
                💡 Listening Tips:
              </p>
              <ul className="text-sm text-gray-700 space-y-1 ml-4 list-disc">
                <li>Listen to the audio 2-3 times before answering</li>
                <li>Use slow speed if you need more time to understand</li>
                <li>Focus on key information that answers the questions</li>
                <li>Take notes if needed!</li>
              </ul>
            </div>
          </div>

          {/* Questions Section */}
          {!showResults ? (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  📝 Question {currentQuestionIndex + 1} of {totalQuestions}
                </h2>
                <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
                  Answered: {Object.keys(selectedAnswers).length}/{totalQuestions}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Question */}
              <div className="mb-6">
                <div className="bg-blue-50 rounded-lg p-4 mb-4 border-l-4 border-blue-500">
                  <p className="text-xl font-semibold text-gray-800">
                    {currentQuestion.question}
                  </p>
                </div>

                {/* Answer Choices */}
                <div className="space-y-3">
                  {currentQuestion.choices.map((choice, idx) => {
                    const isSelected = selectedAnswers[currentQuestionIndex] === idx
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectAnswer(currentQuestionIndex, idx)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 shadow-md scale-105"
                            : "border-gray-300 hover:border-blue-300 bg-white hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center">
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                            isSelected 
                              ? "bg-blue-500 text-white" 
                              : "bg-gray-200 text-gray-700"
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-gray-800">{choice}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center mt-8">
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    currentQuestionIndex === 0
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-gray-300 text-gray-700 hover:bg-gray-400 hover:shadow-md"
                  }`}
                >
                  ← Previous
                </button>

                <button
                  onClick={handleNext}
                  disabled={selectedAnswers[currentQuestionIndex] === undefined}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    selectedAnswers[currentQuestionIndex] === undefined
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : currentQuestionIndex === totalQuestions - 1
                      ? "bg-green-500 text-white hover:bg-green-600 hover:shadow-md"
                      : "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md"
                  }`}
                >
                  {currentQuestionIndex === totalQuestions - 1 ? "Submit ✓" : "Next →"}
                </button>
              </div>
            </div>
          ) : (
            /* Results Section */
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
                🎯 Quiz Results
              </h2>
              
              <div className="text-center mb-8 p-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
                <div className="text-7xl font-bold text-blue-600 mb-2">
                  {score}/{totalQuestions}
                </div>
                <div className="text-3xl font-semibold text-gray-700 mb-2">
                  {percentage}%
                </div>
                <p className="text-xl text-gray-600">
                  {percentage === 100 
                    ? "Perfect Listening! 🎉🏆" 
                    : percentage >= 70 
                    ? "Great listening skills! 👏✨" 
                    : percentage >= 50
                    ? "Good effort! Keep practicing! 💪📚"
                    : "Try listening again! 🎧💫"}
                </p>
              </div>

              {/* Review Answers */}
              <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Review Your Answers:</h3>
              <div className="space-y-4 mb-8">
                {lesson.questions.map((q, idx) => {
                  const userAnswer = selectedAnswers[idx]
                  const isCorrect = userAnswer === q.correct_index
                  
                  return (
                    <div 
                      key={idx}
                      className={`p-5 rounded-lg border-2 ${
                        isCorrect 
                          ? "border-green-500 bg-green-50" 
                          : "border-red-500 bg-red-50"
                      }`}
                    >
                      <div className="flex items-start">
                        <span className="text-2xl mr-3">
                          {isCorrect ? "✅" : "❌"}
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 mb-2">
                            {idx + 1}. {q.question}
                          </p>
                          <div className="space-y-1 text-sm">
                            <p className={`${isCorrect ? "text-green-700" : "text-red-700"} font-medium`}>
                              Your answer: {q.choices[userAnswer]}
                            </p>
                            {!isCorrect && (
                              <p className="text-green-700 font-medium">
                                ✓ Correct answer: {q.correct_text}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600 transition shadow-md"
                >
                  🔄 Try Again
                </button>
                <button
                  onClick={() => router.back()}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition shadow-md"
                >
                  ← Back to Lessons
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}