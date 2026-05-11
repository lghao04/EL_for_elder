"use client"

import { useEffect, useState } from "react"
import { STREAK_UPDATED } from "../constants/events"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkillScore {
  accumulated: number
  attempts: number
  best_single: number
  average: number
}

interface DashboardData {
  user_id: string
  total_score: number
  streak_bonus_total: number
  rank: number | null
  streak: {
    current: number
    longest: number
    total_active_days: number
    last_active_date: string | null
  }
  skill_scores: {
    listening: SkillScore
    reading: SkillScore
    writing: SkillScore
  }
}

interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  profile_image: string | null
  total_score: number
  streak_bonus_total: number
  skill_scores: { listening: number; reading: number; writing: number }
  last_activity: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("access_token") || localStorage.getItem("token")
}

function getUsernameFromToken(token: string): string {
  try {
    const p = JSON.parse(atob(token.split(".")[1]))
    return p.username || p.name || p.email?.split("@")[0] || p.sub || "You"
  } catch { return "You" }
}

function getUserIdFromToken(token: string): string {
  try {
    const p = JSON.parse(atob(token.split(".")[1]))
    return p.sub || p.user_id || p.id || ""
  } catch { return "" }
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RightSidebar() {
  const [dashboard, setDashboard]     = useState<DashboardData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [loading, setLoading]         = useState(true)
  const [showStreakAnim, setShowStreakAnim] = useState(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchDashboard = async (): Promise<DashboardData | null> => {
    const token = getToken()
    if (!token) return null
    try {
      // ✅ GET /api/users/me/dashboard — dùng JWT Bearer, không cần user_id trong URL
      const res = await fetch(`${API}/users/me/dashboard`, {
        headers: authHeader(token),
      })
      if (!res.ok) { console.error("Dashboard:", res.status, await res.text()); return null }
      return res.json()
    } catch (e) { console.error("Dashboard error:", e); return null }
  }

  const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    const token = getToken()
    // ✅ GET /api/users/leaderboard — không cần auth
    try {
      const res = await fetch(`${API}/users/leaderboard?limit=5`, {
        headers: token ? authHeader(token) : {},
      })
      if (!res.ok) { console.error("Leaderboard:", res.status); return [] }
      const data = await res.json()
      return Array.isArray(data) ? data : []
    } catch (e) { console.error("Leaderboard error:", e); return [] }
  }

  const fetchAll = async (prevStreak?: number) => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    setCurrentUserId(getUserIdFromToken(token))

    const [dash, lb] = await Promise.all([fetchDashboard(), fetchLeaderboard()])

    if (dash) {
      if (prevStreak !== undefined && dash.streak.current > prevStreak) {
        setShowStreakAnim(true)
        setTimeout(() => setShowStreakAnim(false), 2000)
      }
      setDashboard(dash)
    }
    setLeaderboard(lb)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  // Lắng nghe STREAK_UPDATED sau mỗi lần submit bài
  useEffect(() => {
    const handler = () => fetchAll(dashboard?.streak.current)
    window.addEventListener(STREAK_UPDATED, handler)
    return () => window.removeEventListener(STREAK_UPDATED, handler)
  }, [dashboard])

  // ── Streak helpers ────────────────────────────────────────────────────────

  const getStreakStatus = (n: number) => {
    if (n === 0)   return { icon: "💤", msg: "Start your journey!" }
    if (n < 3)     return { icon: "🔥", msg: "Getting started!" }
    if (n < 7)     return { icon: "🔥🔥", msg: "Building momentum!" }
    if (n < 14)    return { icon: "🔥🔥🔥", msg: "On fire!" }
    if (n < 30)    return { icon: "⚡", msg: "Blazing fast!" }
    if (n < 100)   return { icon: "🌟", msg: "Legendary!" }
    return { icon: "👑", msg: "Master!" }
  }

  const getMilestone = (n: number) => {
    if (n < 7)   return { pct: (n / 7) * 100,           label: `${7   - n} to 7 🎯`   }
    if (n < 14)  return { pct: ((n - 7) / 7) * 100,     label: `${14  - n} to 14 🏅`  }
    if (n < 30)  return { pct: ((n - 14) / 16) * 100,   label: `${30  - n} to 30 ⚡`  }
    if (n < 100) return { pct: ((n - 30) / 70) * 100,   label: `${100 - n} to 100 👑` }
    return { pct: 100, label: "Legend! 🌟" }
  }

  // ── Leaderboard helpers ───────────────────────────────────────────────────

  const badgeClass = (r: number) =>
    r === 1 ? "bg-yellow-400 text-yellow-900"
    : r === 2 ? "bg-gray-300 text-gray-700"
    : r === 3 ? "bg-orange-400 text-orange-900"
    : "bg-gray-100 text-gray-600"

  const medal = (r: number) =>
    r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null

  const streakN = dashboard?.streak.current ?? 0
  const status  = getStreakStatus(streakN)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-80 flex flex-col gap-6">

      {/* ── Streak ── */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Your Progress</h3>

        <div className={`bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border-2 border-red-200 relative overflow-hidden transition-all ${showStreakAnim ? "shadow-lg scale-105" : ""}`}>
          {showStreakAnim && <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 via-orange-300 to-red-300 opacity-30 animate-pulse pointer-events-none" />}

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600 font-semibold">{status.icon} Current Streak</p>
              {streakN > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">{status.msg}</span>
              )}
            </div>

            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 bg-gray-200 rounded w-24" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-3">
                  <p className={`text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600 ${showStreakAnim ? "animate-bounce" : ""}`}>
                    {streakN}
                  </p>
                  <span className="text-sm text-gray-600">day{streakN !== 1 ? "s" : ""}</span>
                </div>

                {dashboard && (
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span className="flex items-center gap-1">🏆 Best: {dashboard.streak.longest}</span>
                    <span className="flex items-center gap-1">📅 Total: {dashboard.streak.total_active_days}</span>
                  </div>
                )}

                {streakN > 0 && (() => {
                  const m = getMilestone(streakN)
                  return (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Next milestone</span>
                        <span className="font-semibold">{m.label}</span>
                      </div>
                      <div className="w-full bg-red-200 rounded-full h-1.5">
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  )
                })()}

                {streakN === 0 && <p className="text-xs text-gray-500 mt-2">Complete a lesson today to start your streak! 🚀</p>}
              </>
            )}
          </div>

          {showStreakAnim && <div className="absolute top-2 right-2 text-2xl animate-ping pointer-events-none">🎉</div>}
        </div>
      </div>

      {/* ── Score ── */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Your Score</h3>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600 font-semibold">Total Points</span>
            {dashboard?.rank != null && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Rank #{dashboard.rank}</span>
            )}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-10 bg-gray-200 rounded w-28" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  {(dashboard?.total_score ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <span className="text-sm text-gray-600">pts</span>
              </div>

              {(dashboard?.streak_bonus_total ?? 0) > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-600 mb-3">
                  <span>🔥</span>
                  <span>Includes <strong>+{dashboard!.streak_bonus_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> streak bonus</span>
                </div>
              )}

              {dashboard && (
                <div className="mt-2 pt-3 border-t border-blue-100 space-y-1.5">
                  {(["listening", "reading", "writing"] as const).map((skill) => {
                    const s = dashboard.skill_scores[skill]
                    const emoji = skill === "listening" ? "🎧" : skill === "reading" ? "📖" : "✍️"
                    return (
                      <div key={skill} className="flex items-center justify-between text-xs text-gray-600">
                        <span>{emoji} {skill.charAt(0).toUpperCase() + skill.slice(1)}</span>
                        <span className="font-medium text-gray-800">
                          {s.accumulated.toLocaleString(undefined, { maximumFractionDigits: 0 })} pts
                          <span className="text-gray-400 font-normal ml-1">({s.attempts} tries)</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {dashboard?.rank != null ? (
                <div className="flex items-center gap-1 text-xs text-gray-600 mt-3">
                  <span>🏅</span>
                  <span>Ranked <span className="font-semibold text-blue-600">#{dashboard.rank}</span> overall</span>
                </div>
              ) : !loading && (
                <p className="text-xs text-gray-500 mt-2">Complete a lesson to get ranked! 🎯</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Leaderboard ── */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Top 5 Players</h3>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No players yet. Be the first! 🚀</p>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((player) => {
              const isMe = player.user_id === currentUserId
              // Nếu là user hiện tại, lấy account_name từ localStorage cho chắc
              const localUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}") } catch { return {} } })()
              const displayName = isMe
                ? (localUser.account_name || localUser.username || player.display_name)
                : player.display_name
              const avatar = isMe
                ? (localUser.profile_image || player.profile_image)
                : player.profile_image

              return (
                <div key={player.rank} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isMe ? "bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200" : "bg-gray-50 hover:bg-gray-100"}`}>
                  {/* Rank badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${badgeClass(player.rank)}`}>
                    {player.rank}
                  </div>
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden">
                    {avatar ? (
                      <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#e85a2c] to-orange-400 flex items-center justify-center text-white text-sm font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? "text-orange-700 font-semibold" : "text-gray-800"}`}>
                      {displayName}
                      {isMe && <span className="text-xs font-normal ml-1 text-orange-500">(you)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {player.total_score.toLocaleString(undefined, { maximumFractionDigits: 0 })} pts
                    </p>
                  </div>
                  {medal(player.rank) && <span className="text-lg">{medal(player.rank)}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-bounce { animation: bounce 0.5s ease-in-out 3; }
      `}</style>
    </div>
  )
}