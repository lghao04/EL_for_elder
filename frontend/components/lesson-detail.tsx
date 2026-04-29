"use client"

import { useState, useEffect, useRef } from "react"
import { Headphones, Volume2, Info } from "lucide-react"

interface Question {
  id: number
  question: string
  options: string[]
  correctAnswer: number
  type: "mcq" | "trueFalse" | "fillBlank"
}

interface LessonDetailProps {
  lesson: {
    id: string | number
    topic: string
    title: string
    difficulty: "easy" | "medium" | "hard"
    audioUrl?: string
    text?: string
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
  const [playbackSpeed, setPlaybackSpeed] = useState<"slow" | "normal" | "fast">("normal")
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [showScorePopup, setShowScorePopup] = useState(false)
  const [audioTime, setAudioTime] = useState("0:00")
  const [audioDuration, setAudioDuration] = useState("0:00")
  const [audioError, setAudioError] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  // Load audio với debug logs
  useEffect(() => {
    if (!lesson.audioUrl) {
      console.warn("⚠️ No audio URL provided")
      setAudioError("No audio URL available")
      return
    }

    console.log("🎵 Loading audio from:", lesson.audioUrl)
    setAudioLoading(true)
    setAudioError(null)

    if (audioRef.current) {
      const audio = audioRef.current

      // Error handler
      const handleError = (e: Event) => {
        console.error("❌ Audio load error:", e)
        console.error("Audio error details:", audio.error)
        setAudioError(`Failed to load audio: ${audio.error?.message || 'Unknown error'}`)
        setAudioLoading(false)
      }

      // Load success
      const handleLoadedMetadata = () => {
        console.log("✅ Audio metadata loaded")
        console.log("Duration:", audio.duration)
        const duration = audio.duration
        const minutes = Math.floor(duration / 60)
        const seconds = Math.floor(duration % 60)
        setAudioDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        setAudioLoading(false)
      }

      // Can play
      const handleCanPlay = () => {
        console.log("✅ Audio can play")
        setAudioLoading(false)
      }

      // Time update
      const handleTimeUpdate = () => {
        const current = audio.currentTime
        const minutes = Math.floor(current / 60)
        const seconds = Math.floor(current % 60)
        setAudioTime(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }

      // Ended
      const handleEnded = () => {
        console.log("🎵 Audio ended")
        setIsPlaying(false)
      }

      // Add event listeners
      audio.addEventListener('error', handleError)
      audio.addEventListener('loadedmetadata', handleLoadedMetadata)
      audio.addEventListener('canplay', handleCanPlay)
      audio.addEventListener('timeupdate', handleTimeUpdate)
      audio.addEventListener('ended', handleEnded)

      // Set source and load
      audio.src = lesson.audioUrl
      audio.load()

      // Cleanup
      return () => {
        audio.removeEventListener('error', handleError)
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
        audio.removeEventListener('canplay', handleCanPlay)
        audio.removeEventListener('timeupdate', handleTimeUpdate)
        audio.removeEventListener('ended', handleEnded)
      }
    }
  }, [lesson.audioUrl])

  // Apply playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = 
        playbackSpeed === "slow" ? 0.75 : 
        playbackSpeed === "fast" ? 1.25 : 
        1.0
    }
  }, [playbackSpeed])

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
      setShowScorePopup(true)
      setShowResults(true)
    }
  }

  const handlePlayAudio = async () => {
    if (!audioRef.current) {
      console.error("❌ Audio ref not available")
      return
    }

    try {
      if (isPlaying) {
        console.log("⏸️ Pausing audio")
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        console.log("▶️ Playing audio")
        await audioRef.current.play()
        setIsPlaying(true)
        console.log("✅ Audio playing")
      }
    } catch (error) {
      console.error("❌ Play error:", error)
      setAudioError(`Failed to play audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsPlaying(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && showScorePopup) {
        setShowScorePopup(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showScorePopup])

  const correctCount = Object.entries(selectedAnswers).filter(
    ([id, answer]) => sampleQuestions.find((q) => q.id === Number.parseInt(id))?.correctAnswer === answer,
  ).length

  if (showResults) {
    // ... giữ nguyên results UI
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-200 to-pink-100 p-6">
        {/* ... same as before ... */}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <audio 
        ref={audioRef} 
        className="hidden"
        crossOrigin="anonymous" 
      />

   
      {/* Listening Practice Header */}
      <div className="bg-white rounded-3xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <Headphones className="w-8 h-8 text-orange-600" />
          <h1 className="text-3xl font-bold text-orange-600">Listening Practice</h1>
        </div>
        <p className="text-gray-600">Lesson ID: {lesson.id}</p>
        {lesson.text && (
          <p className="text-sm text-gray-500 mt-2">
            Text preview: {lesson.text.substring(0, 100)}...
          </p>
        )}
      </div>

      {/* Audio Player Card */}
      <div className="bg-white rounded-3xl p-8 shadow-lg">
        <div className="space-y-6">
          {/* Audio Description */}
          <div className="bg-pink-100 border-2 border-pink-300 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <Headphones className="w-6 h-6 text-pink-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-gray-800">Listen to the story</h3>
                <p className="text-sm text-gray-700 mt-1">Answer the questions based on what you hear</p>
              </div>
            </div>

            {/* Error message */}
            {audioError && (
              <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 mb-4">
                <p className="text-red-700 font-semibold">❌ {audioError}</p>
                <p className="text-xs text-red-600 mt-1">
                  Try refreshing the page or contact support if the issue persists.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {/* Play/Pause Button */}
              <div className="flex justify-center">
                <button
                  onClick={handlePlayAudio}
                  disabled={!lesson.audioUrl || audioLoading}
                  className={`px-8 py-4 rounded-full font-bold text-lg transition shadow-lg ${
                    !lesson.audioUrl || audioLoading
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : isPlaying
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  }`}
                >
                  {audioLoading 
                    ? "⏳ Loading..." 
                    : isPlaying 
                    ? "⏸️ " 
                    : "▶️ "}
                </button>
              </div>

              {/* Time Display */}
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span className="font-semibold">{audioTime} / {audioDuration}</span>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Speed Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setPlaybackSpeed("slow")}
              disabled={!lesson.audioUrl}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition ${
                playbackSpeed === "slow"
                  ? "bg-pink-200 text-pink-700 border-2 border-pink-400"
                  : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200 disabled:opacity-50"
              }`}
            >
              🐢 Slow (0.75x)
            </button>
            <button
              onClick={() => setPlaybackSpeed("normal")}
              disabled={!lesson.audioUrl}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition ${
                playbackSpeed === "normal"
                  ? "bg-orange-500 text-white border-2 border-orange-600"
                  : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200 disabled:opacity-50"
              }`}
            >
              ▶ Normal (1x)
            </button>
            <button
              onClick={() => setPlaybackSpeed("fast")}
              disabled={!lesson.audioUrl}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition ${
                playbackSpeed === "fast"
                  ? "bg-pink-200 text-pink-700 border-2 border-pink-400"
                  : "bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200 disabled:opacity-50"
              }`}
            >
              ⚡ Fast (1.25x)
            </button>
          </div>
        </div>
      </div>

      {/* Questions - giữ nguyên */}
      <div className="space-y-4">
        <div className="bg-white rounded-3xl p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Question {currentQuestionIndex + 1} of {sampleQuestions.length}
            </h2>
            <span className="text-sm text-gray-600 font-semibold">
              Answered: {Object.keys(selectedAnswers).length}/{sampleQuestions.length}
            </span>
          </div>

          <p className="text-xl text-gray-800 font-semibold mb-6">{currentQuestion.question}</p>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(index)}
                className={`w-full p-4 rounded-2xl text-lg font-semibold text-left transition ${
                  selectedAnswers[currentQuestion.id] === index
                    ? "bg-pink-500 text-white shadow-lg scale-105"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-2 border-gray-200"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={selectedAnswers[currentQuestion.id] === undefined}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition shadow-lg ${
            selectedAnswers[currentQuestion.id] === undefined
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-orange-500 hover:bg-orange-600 text-white transform hover:scale-105"
          }`}
        >
          {currentQuestionIndex === sampleQuestions.length - 1 ? "Finish" : "Next Question"}
        </button>
      </div>
    </div>
  )
}