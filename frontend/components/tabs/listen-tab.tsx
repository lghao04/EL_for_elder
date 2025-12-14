"use client"
import { useState, useEffect } from "react"
import Link from "next/link"

interface Lesson {
  id: string
  topic: string
  title: string
  difficulty: "easy" | "medium" | "hard"
}

export default function ListenTab() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/lessons")

        if (!res.ok) {
          throw new Error("Không thể tải danh sách lesson")
        }

        const data = await res.json()
        setLessons(data.lessons)
      } catch (err) {
        console.error(err)
        setError("Không thể tải bài học")
      } finally {
        setLoading(false)
      }
    }

    fetchLessons()
  }, [])

  if (loading) return <p>Đang tải...</p>
  if (error) return <p className="text-red-500">{error}</p>

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {lessons.map((lesson, index) => (
  <Link
    key={lesson.id}
    href={`/lesson?id=${lesson.id}&title=${encodeURIComponent(lesson.title)}&topic=${encodeURIComponent(lesson.topic)}`}
  >
    <button className="w-full bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition border-4 border-blue-200 flex items-center justify-between hover:scale-105 cursor-pointer">
      <div className="flex-1 text-left">

        {/* Đây là chỗ hiển thị Lesson 1, 2, 3 */}
        <h3 className="text-2xl font-bold text-gray-800">
          Lesson {index + 1} {lesson.title}
        </h3>

        <p className="text-lg text-gray-600">{lesson.topic}</p>
      </div>

      <div className="flex gap-4 ml-4">
        <button className="bg-green-400 hover:bg-green-500 text-white rounded-full p-6 transition shadow-lg transform hover:scale-110">
          <span className="text-4xl">▶️</span>
        </button>
      </div>
    </button>
  </Link>
))}

      </div>
    </div>
  )
}
