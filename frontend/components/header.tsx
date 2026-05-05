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
  userAvatar?: string
}

interface UserState {
  username: string
  email: string
  account_name?: string
  profile_image?: string
}

export default function Header({ userAvatar }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<UserState | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) setUser(JSON.parse(userData))

    const handleProfileUpdated = (e: Event) => {
      const { account_name, profile_image } = (e as CustomEvent).detail
      setUser(prev => prev ? { ...prev, account_name, profile_image } : prev)
    }

    const handleStorageChange = () => {
      const userData = localStorage.getItem("user")
      if (userData) setUser(JSON.parse(userData))
    }

    window.addEventListener("user-profile-updated", handleProfileUpdated)
    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("user-profile-updated", handleProfileUpdated)
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [])

  const handleLogout = () => {
    logoutUser()
    setUser(null)
    router.push("/")
  }

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Logo and App Name */}
        <div className="flex items-center gap-3">
          <div className="bg-pink-600 text-white rounded-lg px-3 py-2 font-bold text-lg">STO</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ZerotoOne</h1>
            <p className="text-sm text-gray-500">Master English Today</p>
          </div>
        </div>

        {/* Right section: Avatar */}
        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-pink-200 to-orange-200 text-pink-700 font-bold text-base px-4 py-2 rounded-full shadow-md hover:from-pink-300 hover:to-orange-300 transition cursor-default">
                {user.account_name || user.username}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="bg-pink-200 rounded-full p-3 text-xl hover:bg-pink-300 transition shadow-md focus:outline-none overflow-hidden">
                  {user.profile_image ? (
                    <img src={user.profile_image} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    "👤"
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-pink-50">
                  <DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="cursor-pointer text-base py-3 text-gray-800 hover:bg-pink-300 hover:text-pink-700"
                  >
                    View Account Information
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-base py-3 text-red-600 hover:bg-red-300 hover:text-red-700"
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <button
              onClick={() => router.push("/")}
              className="bg-pink-600 text-white rounded-lg px-6 py-2 font-medium hover:bg-pink-700 transition shadow-md"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  )
}