// app/dashboard/page.tsx 
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/header"
import MainContent from "../../components/main-content"
import RightSidebar from "../../components/right-sidebar"
import { useLanguage } from "../../hooks/use-language"
import { isAuthenticated, getCurrentUser, getToken } from "../../lib/api"

export default function Dashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("listen")
  const [difficulty, setDifficulty] = useState("normal")
  const { language, setLanguage } = useLanguage()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      router.push("/")
      return
    }

    // Verify token and load user data
    const verifyAuth = async () => {
      const token = getToken()
      if (token) {
        const userData = await getCurrentUser(token)
        if (userData) {
          // Update user data in localStorage
          localStorage.setItem('user', JSON.stringify(userData))
          setLoading(false)
        } else {
          // Token invalid or expired, redirect to login
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          router.push("/")
        }
      } else {
        // No token, redirect to login
        router.push("/")
      }
    }

    verifyAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userAvatar="👤" />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Left/Center - Main Content */}
        <div className="flex-1 min-w-0">
          <MainContent activeTab={activeTab} setActiveTab={setActiveTab} difficulty={difficulty} />
        </div>

        {/* Right Sidebar - Progress Stats */}
        <RightSidebar />
      </div>
    </div>
  )
}