"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

interface ListeningItem {
  id: string
  title: string
}

interface ExerciseRecord {
  exercise_id: string
  total_attempts: number
  counted_attempts: number
  best_score: number
  best_raw: number
  score_locked: boolean
}

interface RecordMap {
  [exerciseId: string]: ExerciseRecord
}

function getToken(): string | null {
  return localStorage.getItem("access_token") || localStorage.getItem("token")
}

export default function ListenTab() {
  const [items, setItems] = useState<ListeningItem[]>([])
  const [recordMap, setRecordMap] = useState<RecordMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch danh sách bài listening ────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE_URL}/listen/?level=easy&skip=0&limit=100`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch")
        return res.json()
      })
      .then((data) => {
        setItems(data.data || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // ── Fetch records ─────────────────────────────────────────────────────────
  const fetchRecords = async () => {
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/users/me/records?skill=listening`, {
        headers: { Authorization: `Bearer ${token}` },
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

  // ── Loading ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">❌ Lỗi tải dữ liệu</p>
        <p className="text-sm text-red-500 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, index) => {
          const record      = recordMap[item.id]
          const hasProgress = !!record && record.total_attempts > 0
          const bestPct     = record?.best_score ?? 0
          const attempts    = record?.total_attempts ?? 0
          const scoreLocked = record?.score_locked ?? false
          const isPerfect   = bestPct >= 100

          return (
            <Link key={item.id} href={`/listen?id=${item.id}`} className="block">
              <div className="w-full bg-white rounded-2xl p-5 shadow-lg border-4 border-orange-200 flex items-center gap-4 hover:shadow-xl hover:scale-105 transition-all cursor-pointer relative">

                {/* Perfect badge */}
                {isPerfect && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full px-3 py-1.5 shadow-lg border-2 border-white flex items-center gap-1.5 z-10">
                    <span>✓</span>
                    <div className="flex flex-col items-start leading-none">
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

                {/* Index */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-orange-700 truncate">
                    {item.title || `Bài ${index + 1}`}
                  </h3>

                  {hasProgress ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-semibold text-orange-600">
                          🏆 Best: {bestPct.toFixed(0)}%
                        </span>
                        {scoreLocked && (
                          <span className="text-xs text-gray-400">(điểm đã khoá)</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-orange-500">
                        <span>{attempts} attempt{attempts > 1 ? "s" : ""}</span>
                        <span>{record.counted_attempts}/3 scored</span>
                      </div>
                      <div className="w-full bg-orange-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            bestPct >= 100 ? "bg-orange-500"
                            : bestPct >= 75  ? "bg-orange-400"
                            : bestPct >= 50  ? "bg-yellow-400"
                            : "bg-red-400"
                          }`}
                          style={{ width: `${bestPct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-orange-400">Not started yet</p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-orange-400 text-xl">›</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}