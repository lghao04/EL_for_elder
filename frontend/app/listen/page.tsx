"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import Header from "@/components/header"
import LessonDetail from "@/components/lesson-detail"

interface Exercise {
  id: string
  text: string
  audio: {
    src: string
    type: string
    sampling_rate: number
  }
}

function ListenContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentLanguage, setCurrentLanguage] = useState("en")
  
  // State cho exercise data
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const exerciseId = searchParams.get("id")

  // Fetch exercise data từ API
  useEffect(() => {
    if (!exerciseId) {
      setError("No exercise ID provided")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`http://127.0.0.1:8000/api/listening/${exerciseId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch exercise: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        console.log("✅ Exercise loaded:", data)
         data.audio.src = `http://127.0.0.1:8000/api/listening/audio-proxy?url=${encodeURIComponent(data.audio.src)}`
          setExercise(data)
          setLoading(false)
      })
      .catch((err) => {
        console.error("❌ Error fetching exercise:", err)
        setError(err.message)
        setLoading(false)
      })
  }, [exerciseId])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-100 to-pink-100">
        <Header userAvatar="👧" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-semibold">Loading exercise...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !exercise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-pink-100 to-pink-100">
        <Header userAvatar="👧" />
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => router.back()}
              className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-gray-300"
            >
              ← Back to Lessons
            </button>
            <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-12 text-center">
              <p className="text-red-600 font-bold text-2xl mb-4">❌ Error</p>
              <p className="text-red-500 text-lg mb-6">
                {error || "Exercise not found"}
              </p>
              <button
                onClick={() => router.back()}
                className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Create lesson object từ exercise data
  const lesson = {
    id: exercise.id,
    title: `Listening Exercise`,
    topic: "Listening Practice",
    difficulty: "medium" as const,
    audioUrl: exercise.audio.src,
    text: exercise.text
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" />

      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-gray-300"
          >
            ← Back to Lessons
          </button>
          
          <LessonDetail lesson={lesson} />
        </div>
      </div>
    </div>
  )
}

export default function ListenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600"></div>
      </div>
    }>
      <ListenContent />
    </Suspense>
  )
}