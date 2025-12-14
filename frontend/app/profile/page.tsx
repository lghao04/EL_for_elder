// app/profile/page.tsx 
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/ui/button"
import { Card } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { isAuthenticated } from "../../lib/api"

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ username: string; email: string } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      router.push("/")
      return
    }

    const userData = localStorage.getItem("user")
    if (!userData) {
      router.push("/")
      return
    }
    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    setUsername(parsedUser.username)
    setEmail(parsedUser.email)
  }, [router])

  const handleSave = () => {
    const updatedUser = { username, email }
    localStorage.setItem("user", JSON.stringify(updatedUser))
    setUser(updatedUser)
    setIsEditing(false)
    // TODO: Call API to update user profile on backend
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white rounded-lg px-3 py-2 font-bold text-lg">SF</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SpeakFlow</h1>
              <p className="text-sm text-gray-500">Master English Today</p>
            </div>
          </div>
          <Button onClick={() => router.push("/dashboard")} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6 mt-8">
        <Card className="p-8 bg-white shadow-lg">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Account Information</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              {isEditing ? (
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full text-lg py-6"
                />
              ) : (
                <p className="text-xl text-gray-900 font-medium">{user.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              {isEditing ? (
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-lg py-6"
                />
              ) : (
                <p className="text-xl text-gray-900 font-medium">{user.email}</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
                    Save Changes
                  </Button>
                  <Button onClick={() => setIsEditing(false)} variant="outline" className="px-8 py-6 text-lg">
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg"
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
