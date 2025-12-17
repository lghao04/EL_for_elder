"use client"

import { useEffect, useState } from "react"
import { STREAK_UPDATED } from "../constants/events"

interface StreakResponse {
  current_streak: number
  longest_streak: number
  last_active_date?: string
  total_active_days: number
}

export default function RightSidebar() {
  const [streak, setStreak] = useState<StreakResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStreakAnimation, setShowStreakAnimation] = useState(false)

  const fetchStreak = async () => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("token")
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
      console.log("🔥 Streak fetched:", data)
      setStreak(data)
    } catch (err) {
      console.error("❌ Fetch streak error:", err)
    } finally {
      setLoading(false)
    }
  }

  // 1️⃣ Fetch khi mount
  useEffect(() => {
    fetchStreak()
  }, [])

  // 2️⃣ Listen to STREAK_UPDATED event
  useEffect(() => {
    const handleStreakUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<StreakResponse>
      console.log("🔥 STREAK_UPDATED received:", customEvent.detail)
      
      // Check if streak increased
      if (streak && customEvent.detail.current_streak > streak.current_streak) {
        setShowStreakAnimation(true)
        setTimeout(() => setShowStreakAnimation(false), 2000)
      }
      
      // Update streak with event data (no need to refetch)
      setStreak(customEvent.detail)
    }

    window.addEventListener(STREAK_UPDATED, handleStreakUpdated)
    return () =>
      window.removeEventListener(STREAK_UPDATED, handleStreakUpdated)
  }, [streak])

  // Calculate streak status
  const getStreakStatus = () => {
    if (!streak) return { icon: "💤", message: "No streak yet" }
    
    const current = streak.current_streak
    
    if (current === 0) return { icon: "💤", message: "Start your journey!" }
    if (current < 3) return { icon: "🔥", message: "Getting started!" }
    if (current < 7) return { icon: "🔥🔥", message: "Building momentum!" }
    if (current < 14) return { icon: "🔥🔥🔥", message: "On fire!" }
    if (current < 30) return { icon: "⚡", message: "Blazing fast!" }
    if (current < 100) return { icon: "🌟", message: "Legendary!" }
    return { icon: "👑", message: "Master!" }
  }

  const status = getStreakStatus()

  return (
    <div className="w-80 flex flex-col gap-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Your Progress
        </h3>

        <div className="space-y-3">
          {/* Total Points (để sau) */}
          {/* <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-gray-600">⭐ Total Points</p>
            <p className="text-3xl font-bold text-gray-900">1,250</p>
          </div> */}

          {/* Badges (để sau) */}
          {/* <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600">🏅 Badges Earned</p>
            <p className="text-3xl font-bold text-gray-900">12</p>
          </div> */}

          {/* 🔥 STREAK - Enhanced */}
          <div className={`bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border-2 border-red-200 relative overflow-hidden transition-all ${
            showStreakAnimation ? 'shadow-lg scale-105' : ''
          }`}>
            {/* Animation overlay */}
            {showStreakAnimation && (
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300 opacity-30 animate-pulse"></div>
            )}

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600 font-semibold">
                  {status.icon} Current Streak
                </p>
                {streak && streak.current_streak > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                    {status.message}
                  </span>
                )}
              </div>

              {/* Main Streak Display */}
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-10 bg-gray-200 rounded w-24"></div>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <p className={`text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600 ${
                      showStreakAnimation ? 'animate-bounce' : ''
                    }`}>
                      {streak?.current_streak ?? 0}
                    </p>
                    <span className="text-sm text-gray-600">
                      day{(streak?.current_streak ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Stats Row */}
                  {streak && (
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <span>🏆</span>
                        <span>Best: {streak.longest_streak}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span>📅</span>
                        <span>Total: {streak.total_active_days}</span>
                      </span>
                    </div>
                  )}

                  {/* Progress to next milestone */}
                  {streak && streak.current_streak > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Next milestone</span>
                        <span className="font-semibold">
                          {streak.current_streak < 7 
                            ? `${7 - streak.current_streak} to 7 🎯`
                            : streak.current_streak < 14
                            ? `${14 - streak.current_streak} to 14 🏅`
                            : streak.current_streak < 30
                            ? `${30 - streak.current_streak} to 30 ⚡`
                            : streak.current_streak < 100
                            ? `${100 - streak.current_streak} to 100 👑`
                            : 'Legend! 🌟'}
                        </span>
                      </div>
                      <div className="w-full bg-red-200 rounded-full h-1.5">
                        <div 
                          className="bg-gradient-to-r from-red-500 to-orange-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${
                              streak.current_streak < 7 
                                ? (streak.current_streak / 7) * 100
                                : streak.current_streak < 14
                                ? ((streak.current_streak - 7) / 7) * 100
                                : streak.current_streak < 30
                                ? ((streak.current_streak - 14) / 16) * 100
                                : streak.current_streak < 100
                                ? ((streak.current_streak - 30) / 70) * 100
                                : 100
                            }%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Motivational message */}
                  {streak && streak.current_streak === 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Complete a lesson today to start your streak! 🚀
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Celebration confetti when streak increases */}
            {showStreakAnimation && (
              <div className="absolute top-2 right-2 text-2xl animate-ping">
                🎉
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-bounce {
          animation: bounce 0.5s ease-in-out 3;
        }
      `}</style>
    </div>
  )
}