"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { STREAK_UPDATED } from "../../constants/events"


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||  "http://localhost:8000/api";


interface Lesson {
  id: string
}

interface Progress {
  lesson_id: string
  completion_count: number
  total_attempts: number
  last_score: number
  best_score: number
}

interface ProgressMap {
  [lessonId: string]: Progress
}

export default function ListenTab() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progressMap, setProgressMap] = useState<ProgressMap>({})
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedLessons: 0,
    totalAttempts: 0,
    averageBestScore: 0,
    totalPoints: 0
  })
  const [showScorePopup, setShowScorePopup] = useState(false)
  const [currentScore, setCurrentScore] = useState({ score: 0, total: 4 })

  // Fetch lessons from API
  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/lessons`)

        if (!res.ok) {
          throw new Error("Không thể tải danh sách lesson")
        }

        const data = await res.json()
        console.log('📚 Fetched lessons:', data.lessons)
        
        setLessons(data.lessons)
        setStats(prev => ({ ...prev, totalLessons: data.lessons.length }))
      } catch (err) {
        console.error(err)
        setError("Không thể tải bài học")
      } finally {
        setLoading(false)
      }
    }

    fetchLessons()
  }, [])

  // Fetch user progress from backend
  const fetchProgress = async () => {
    try {
      const token = localStorage.getItem('token')
      
      if (!token) {
        console.log('No auth token, skipping progress fetch')
        return
      }

      const response = await fetch(`${API_BASE_URL}/progress/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()

       
        
        const map: ProgressMap = {}
        let totalAttempts = 0
        let totalPoints = 0
        
        data.progress.forEach((p: Progress) => {
          map[p.lesson_id] = p
          totalAttempts += p.total_attempts
          totalPoints += p.best_score // Tổng điểm = tổng best_score của tất cả lessons
        })
        
        setProgressMap(map)
        setStats(prev => ({
          ...prev,
          completedLessons: data.progress.length,
          totalAttempts: totalAttempts,
          averageBestScore: data.stats.average_best_score,
          totalPoints: totalPoints
        }))
      } else {
        console.error('Failed to fetch progress:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching progress:', error)
    }
  }

  useEffect(() => {
    fetchProgress()
  }, [])

  // Refresh progress when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        await fetchProgress()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Function to save progress to backend
  const saveProgress = async (lessonId: string, score: number) => {
    try {
      const token = localStorage.getItem("access_token")

      
      if (!token) {
        console.log('No auth token, cannot save progress')
        return
      }

      console.log('💾 Saving progress:', { lessonId, score })

      const response = await fetch(`${API_BASE_URL}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          score: score
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Progress saved successfully:', data)
        
        // Refresh progress data
        await fetchProgress()
        
        // 🔥 Fetch streak data và dispatch event
        try {
          const streakResponse = await fetch(`${API_BASE_URL}/progress/streak`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          
          if (streakResponse.ok) {
            const streakData = await streakResponse.json()
            console.log('🔥 Streak data fetched:', streakData)
            
            // 🔥 Dispatch custom event để notify các component khác
            const event = new CustomEvent(STREAK_UPDATED, { 
              detail: streakData 
            })
            window.dispatchEvent(event)
            console.log('📡 STREAK_UPDATED event dispatched')
          }
        } catch (streakError) {
          console.error('Error fetching streak:', streakError)
        }

      } else {
        const errorText = await response.text()
        console.error('Failed to save progress:', response.status, errorText)
      }
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  // Function to show score popup (call this after quiz submission)
  const handleQuizComplete = (lessonId: string, score: number, totalQuestions: number = 4) => {
    console.log('🎯 Quiz completed:', { lessonId, score, totalQuestions })
    setCurrentScore({ score, total: totalQuestions })
    setShowScorePopup(true)
    
    // Save to backend
    saveProgress(lessonId, score)
  }

  // Expose function to window for use in other components
  useEffect(() => {
    (window as any).handleQuizComplete = handleQuizComplete
    console.log('✅ handleQuizComplete registered on window')
    return () => {
      delete (window as any).handleQuizComplete
      console.log('🗑️ handleQuizComplete removed from window')
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-xl font-bold text-blue-600 animate-pulse">
          📚 Loading lessons...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-500 font-semibold">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {lessons.map((lesson, index) => {
          const progress = progressMap[lesson.id]
          const completionCount = progress?.completion_count || 0
          const hasCompleted = completionCount > 0
          const bestScore = progress?.best_score || 0
          const lastScore = progress?.last_score || 0
          const totalAttempts = progress?.total_attempts || 0
          const hasProgress = !!progress
          
          return (
            <Link
              key={lesson.id}
              href={`/lesson?id=${lesson.id}`}
            >
              <button className="w-full bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition border-4 border-blue-200 flex flex-col hover:scale-105 cursor-pointer relative">
                {/* Completion Badge */}
                {hasCompleted && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full px-4 py-2 shadow-lg border-2 border-white flex items-center gap-2 z-10">
                    <span className="text-lg">✓</span>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-semibold">Perfect</span>
                      <span className="text-sm font-bold">{completionCount}x</span>
                    </div>
                  </div>
                )}

                {/* Main Content */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex-1 text-left">
                    <h3 className="text-2xl font-bold text-gray-800">
                      Lesson {index + 1}
                    </h3>

                    {/* Progress Info */}
                    {hasProgress ? (
                      <div className="mt-3 space-y-2">
                        {/* Scores */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-green-600">
                              🏆 Best: {bestScore}/4
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-blue-600">
                              📊 Last: {lastScore}/4
                            </span>
                          </div>
                        </div>
                        
                        {/* Attempts & Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>{totalAttempts} attempt{totalAttempts > 1 ? 's' : ''}</span>
                            <span>{Math.round((bestScore / 4) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                bestScore === 4 ? 'bg-green-500' :
                                bestScore === 3 ? 'bg-blue-500' :
                                bestScore === 2 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${(bestScore / 4) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500">Not started yet</p>
                    )}
                  </div>

                  {/* Play Button */}
                  {/* <div className="flex gap-4 ml-4">
                    <button className="bg-green-400 hover:bg-green-500 text-white rounded-full p-6 transition shadow-lg transform hover:scale-110">
                      <span className="text-4xl">▶️</span>
                    </button>
                  </div> */}
                </div>
              </button>
            </Link>
          )
        })}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.9);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}