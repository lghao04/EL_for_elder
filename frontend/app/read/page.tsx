"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Header from "@/components/header"
import ReadingDetail from "@/components/reading-detail"
import { useState, useEffect } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export default function ReadingPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentLanguage, setCurrentLanguage] = useState("en")

  const lessonId = searchParams.get("id") || "1"
  // const lessonTitle = searchParams.get("title") || "My Little Peach Tree"
  // const lessonTopic = searchParams.get("topic") || "Stories"

  const [lessonData, setLessonData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/lessons/${lessonId}`)
        console.log("API URL:", `${API_BASE_URL}/lessons/${lessonId}`)
        const data = await res.json()

        setLessonData(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchLesson()
  }, [lessonId])

  const lesson = {
    id: Number.parseInt(lessonId),
    // title: lessonTitle,
    // topic: lessonTopic,
    difficulty: "easy" as const,
  }

  if (loading) {
    return <div className="p-10 text-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-rose-100 to-pink-100">
      <Header userAvatar="👧" />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-orange-300"
          >
           ← Back to Dashboard
          </button>

          {/* 👇 truyền BOTH */}
          <ReadingDetail lesson={lesson} data={lessonData} />
        </div>
      </div>
    </div>
  )
}