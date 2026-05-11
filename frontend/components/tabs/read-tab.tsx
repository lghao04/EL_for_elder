"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

interface ReadingLesson {
  id: string
}

interface ExerciseRecord {
  exercise_id: string
  total_attempts: number
  counted_attempts: number
  best_score: number       // 0-100 (normalized)
  best_raw: number         // số câu đúng thực tế
  score_locked: boolean
}

interface RecordMap {
  [exerciseId: string]: ExerciseRecord
}

function getToken(): string | null {
  return localStorage.getItem("access_token") || localStorage.getItem("token")
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export default function ReadTab() {
  const [lessons, setLessons]       = useState<ReadingLesson[]>([])
  const [recordMap, setRecordMap]   = useState<RecordMap>({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  // ── Fetch danh sách lesson (giữ nguyên) ──────────────────────────────────
  useEffect(() => {
    fetch(`${API}/lessons`)
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

  // ── Fetch records mới (thay thế /progress/all) ────────────────────────────
  const fetchRecords = async () => {
    const token = getToken()
    if (!token) return
    try {
      // GET /api/users/me/records?skill=reading — lấy tất cả bài reading 1 lần
      const res = await fetch(`${API}/users/me/records?skill=reading`, {
        headers: authHeader(token),
      })
      if (!res.ok) return

      const data = await res.json()
      const map: RecordMap = {}
      ;(data.records || []).forEach((r: ExerciseRecord) => {
        map[r.exercise_id] = r
      })
      setRecordMap(map)
    } catch (err) {
      console.error("Error fetching records:", err)
    }
  }

  useEffect(() => { fetchRecords() }, [])

  // Refresh khi user quay lại tab
  useEffect(() => {
    const handler = () => { if (!document.hidden) fetchRecords() }
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])

  // ── UI states ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">❌ Error loading lessons</p>
        <p className="text-sm text-red-500 mt-2">{error}</p>
        <button onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
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

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {lessons.map((lesson, index) => {
          const record       = recordMap[lesson.id]
          const hasProgress  = !!record && record.total_attempts > 0
          // best_score là 0-100, dùng trực tiếp để hiển thị %
          const bestPct      = record?.best_score ?? 0
          // best_raw = số câu đúng thực tế (từ ScoreService)
          const bestRaw      = record?.best_raw ?? 0
          const attempts     = record?.total_attempts ?? 0
          const scoreLocked  = record?.score_locked ?? false
          // Coi là "hoàn thành" khi đạt 100%
          const isPerfect    = bestPct >= 100

          return (
            <Link key={lesson.id} href={`/read?id=${lesson.id}`}>
              <button className="w-full bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition border-4 border-orange-200 flex flex-col hover:scale-105 cursor-pointer relative">

                {/* Perfect badge */}
                {isPerfect && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full px-4 py-2 shadow-lg border-2 border-white flex items-center gap-2 z-10">
                    <span className="text-lg">✓</span>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">Perfect</span>
                      <span className="text-sm font-bold">100%</span>
                    </div>
                  </div>
                )}

                {/* Score locked badge */}
                {scoreLocked && !isPerfect && (
                  <div className="absolute -top-2 -right-2 bg-gray-400 text-white rounded-full px-3 py-1.5 shadow-lg border-2 border-white text-xs font-semibold z-10">
                    🔒 Locked
                  </div>
                )}

                <div className="flex items-center justify-between w-full">
                  <div className="flex-1 text-left">
                    <h3 className="text-2xl font-bold text-orange-700">
                      Lesson {index + 1}
                    </h3>

                    {hasProgress ? (
                      <div className="mt-3 space-y-2">
                        {/* Score */}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-semibold text-orange-600">
                            🏆 Best: {bestPct.toFixed(0)}%
                          </span>
                          {scoreLocked && (
                            <span className="text-xs text-gray-400">
                              (điểm đã khoá)
                            </span>
                          )}
                        </div>

                        {/* Attempts + progress bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-orange-600">
                            <span>{attempts} attempt{attempts > 1 ? "s" : ""}</span>
                            <span>{record.counted_attempts}/3 scored</span>
                          </div>
                          <div className="w-full bg-orange-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                bestPct >= 100 ? "bg-orange-500"
                                : bestPct >= 75  ? "bg-orange-400"
                                : bestPct >= 50  ? "bg-yellow-400"
                                : "bg-red-400"
                              }`}
                              style={{ width: `${bestPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-orange-500">Not started yet</p>
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