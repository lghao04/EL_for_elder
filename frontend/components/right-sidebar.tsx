"use client"

import { useEffect, useState } from "react"

const STREAK_UPDATED = "STREAK_UPDATED"

interface StreakResponse {
  current_streak: number
  last_active_date?: string
}

export default function RightSidebar() {
  const [streak, setStreak] = useState<StreakResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStreak = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(
        "http://localhost:8000/api/progress/streak",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!res.ok) throw new Error("Failed to fetch streak")

      const data: StreakResponse = await res.json()
      setStreak(data)
    } catch (err) {
      console.error("❌ Fetch streak error:", err)
    } finally {
      setLoading(false)
    }
  }

  // 1️⃣ fetch khi mount
  useEffect(() => {
    fetchStreak()
  }, [])

  // 2️⃣ fetch lại khi hoàn thành bài
  useEffect(() => {
    const handleStreakUpdated = () => {
      console.log("🔥 STREAK_UPDATED received → refetch streak")
      fetchStreak()
    }

    window.addEventListener(STREAK_UPDATED, handleStreakUpdated)
    return () =>
      window.removeEventListener(STREAK_UPDATED, handleStreakUpdated)
  }, [])

  return (
    <div className="w-80 flex flex-col gap-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Your Progress
        </h3>

        <div className="space-y-3">
          {/* Total Points (để sau) */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-gray-600">⭐ Total Points</p>
            <p className="text-3xl font-bold text-gray-900">1,250</p>
          </div>

          {/* Badges (để sau) */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600">🏅 Badges Earned</p>
            <p className="text-3xl font-bold text-gray-900">12</p>
          </div>

          {/* 🔥 STREAK */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <p className="text-sm text-gray-600">🔥 Current Streak</p>

            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : (
              <p className="text-3xl font-bold text-gray-900">
                {streak?.current_streak ?? 0} days
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
