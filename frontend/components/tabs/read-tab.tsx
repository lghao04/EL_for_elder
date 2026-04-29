"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

interface ReadingLesson {
  id: string
  completed?: boolean
}

interface Progress {
  lesson_id: string
  best_score: number
  total_attempts: number
}

interface ProgressMap {
  [lessonId: string]: Progress
}

export default function ReadTab() {
  const [lessons, setLessons] = useState<ReadingLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ✅ thêm progress state
  const [progressMap, setProgressMap] = useState<ProgressMap>({})

  // 🔥 giữ nguyên fetch lessons
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/lessons")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch lessons")
        return res.json()
      })
      .then((data) => {
        setLessons(data.lessons || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error fetching lessons:", err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // ✅ thêm fetch progress (copy từ listening, rút gọn)
  const fetchProgress = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const res = await fetch(`${API_BASE_URL}/progress/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()

        const map: ProgressMap = {}
        data.progress.forEach((p: Progress) => {
          map[p.lesson_id] = p
        })

        setProgressMap(map)
      }
    } catch (err) {
      console.error("Error fetching progress:", err)
    }
  }

  useEffect(() => {
    fetchProgress()
  }, [])

  // 🔥 refresh khi quay lại tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchProgress()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // ===== UI =====

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">❌ Error loading lessons</p>
        <p className="text-sm text-red-500 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (lessons.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-600 text-lg">📚 No lessons available yet</p>
        <p className="text-sm text-gray-500 mt-2">Check back later for new content!</p>
      </div>
    )
  }

  return (
  <div className="space-y-4">
    <div className="space-y-3">
      {lessons.map((lesson, index) => {
        const progress = progressMap[lesson.id]

        const bestScore = progress?.best_score || 0
        const totalAttempts = progress?.total_attempts || 0
        const hasProgress = !!progress
        const hasCompleted = bestScore === 4 // hoặc giữ lesson.completed nếu bạn muốn

        return (
          <Link key={lesson.id} href={`/read?id=${lesson.id}`}>
            <button className="w-full bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition border-4 border-orange-200 flex flex-col hover:scale-105 cursor-pointer relative">

              {/* ✅ Badge giống Listening */}
              {hasCompleted && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full px-4 py-2 shadow-lg border-2 border-white flex items-center gap-2 z-10">
                  <span className="text-lg">✓</span>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-semibold">Perfect</span>
                    <span className="text-sm font-bold">4/4</span>
                  </div>
                </div>
              )}

              {/* MAIN */}
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 text-left">
                  <h3 className="text-2xl font-bold text-orange-700">
                    Lesson {index + 1}
                  </h3>

                  {/* Progress */}
                  {hasProgress ? (
                    <div className="mt-3 space-y-2">

                      {/* Score */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-semibold text-orange-600">
                          🏆 Best: {bestScore}/4
                        </span>
                      </div>

                      {/* Attempts + Progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-orange-600">
                          <span>
                            {totalAttempts} attempt{totalAttempts > 1 ? "s" : ""}
                          </span>
                          <span>{Math.round((bestScore / 4) * 100)}%</span>
                        </div>

                        <div className="w-full bg-orange-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              bestScore === 4
                                ? "bg-orange-500"
                                : bestScore === 3
                                ? "bg-orange-400"
                                : bestScore === 2
                                ? "bg-yellow-400"
                                : "bg-red-400"
                            }`}
                            style={{ width: `${(bestScore / 4) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-orange-500">
                      Not started yet
                    </p>
                  )}
                </div>
              </div>
            </button>
          </Link>
        )
      })}
    </div>
  </div>
)
}