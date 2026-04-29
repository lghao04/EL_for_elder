

"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

interface ListeningExercise {
  id: string
  preview: string
}

// Mock progress data (giữ tạm)
const progressMap: Record<string, { best_score: number; total_attempts: number }> = {}

export default function ListenTab() {
  const [exercises, setExercises] = useState<ListeningExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/listening?skip=0&limit=20")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch exercises")
        return res.json()
      })
      .then((data) => {
        setExercises(data.exercises || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error fetching listening exercises:", err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">❌ Error loading exercises</p>
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

  if (exercises.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
        <p className="text-gray-600 text-lg">🎧 No listening exercises available yet</p>
        <p className="text-sm text-gray-500 mt-2">Check back later for new content!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {exercises.map((exercise, index) => {
          const progress = progressMap[exercise.id]
          const bestScore = progress?.best_score || 0
          const totalAttempts = progress?.total_attempts || 0
          const hasProgress = !!progress && totalAttempts > 0
          const hasCompleted = bestScore === 4

          return (
            <Link
              key={exercise.id}
              href={`/listen?id=${exercise.id}`}
              className="block w-full"
            >
              <div className="w-full bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition border-4 border-orange-200 flex flex-col hover:scale-105 cursor-pointer relative">

                {/* Completion Badge */}
                {hasCompleted && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full px-4 py-2 shadow-lg border-2 border-white flex items-center gap-2 z-10">
                    <span className="text-lg">✓</span>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">Perfect</span>
                      <span className="text-sm font-bold">4/4</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between w-full">
                  <div className="flex-1 text-left">
                    
                    {/*  Lesson title */}
                    <h3 className="text-2xl font-bold text-orange-700">
                      Lesson {index + 1}
                    </h3>

              
                   
                    {/* Progress */}
                    {hasProgress ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-semibold text-orange-600">
                            🏆 Best: {bestScore}/4
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-orange-600">
                            <span>
                              {totalAttempts} attempt{totalAttempts > 1 ? "s" : ""}
                            </span>
                            <span>{Math.round((bestScore / 4) * 100)}%</span>
                          </div>

                          <div className="w-full bg-orange-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-orange-400 transition-all duration-300"
                              style={{ width: `${(bestScore / 4) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-orange-500">Not started yet</p>
                    )}
                  </div>

                  {/* Play Button */}
                  <div className="ml-4 flex-shrink-0">
                    <button className="bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-full p-4 transition shadow-lg">
                      🎧
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}