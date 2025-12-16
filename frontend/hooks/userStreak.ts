// hooks/useStreak.ts
import { useState } from "react"

export function useStreak() {
  const [streak, setStreak] = useState(0)

  const refresh = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) return

    const res = await fetch("http://localhost:8000/api/progress/streak", {
      headers: { Authorization: `Bearer ${token}` }
    })

    const data = await res.json()
    setStreak(data.current_streak)
  }

  return { streak, refresh }
}
