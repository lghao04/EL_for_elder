// components/header.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "./ui/dropdown-menu"
import { logoutUser } from "../lib/api"

interface HeaderProps {
  userAvatar: string
}

export default function Header({ userAvatar }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<{ username: string; email: string } | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleLogout = () => {
    logoutUser() // Clear token and user from localStorage
    setUser(null)
    router.push("/")
  }

  const handleViewProfile = () => {
    router.push("/profile")
  }

  const handleLoginRedirect = () => {
    router.push("/")
  }

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo and App Name */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white rounded-lg px-3 py-2 font-bold text-lg">SF</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SpeakFlow</h1>
            <p className="text-sm text-gray-500">Master English Today</p>
          </div>
        </div>

        {/* Right section: Avatar with dropdown */}
        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-gray-900 font-medium text-base">{user.username}</span>
              <DropdownMenu>
                <DropdownMenuTrigger className="bg-orange-400 rounded-full p-3 text-xl hover:bg-orange-500 transition shadow-md focus:outline-none">
                  👤
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleViewProfile} className="cursor-pointer text-base py-3">
                    View Account Information
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-base py-3 text-red-600">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <button
              onClick={handleLoginRedirect}
              className="bg-blue-600 text-white rounded-lg px-6 py-2 font-medium hover:bg-blue-700 transition shadow-md"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  )
}