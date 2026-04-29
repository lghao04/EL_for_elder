// app/page.tsx
// xừ lí login và đăng ký
"use client"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { loginUser, registerUser } from "../lib/api"
import { Heart, Lock, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let response;

      if (isLogin) {
        // Login
        response = await loginUser(username, password)
      } else {
        // Register
        if (!username) {
          setError("Username is required")
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters")
          setLoading(false)
          return
        }
        response = await registerUser(email, username, password)
      }

      if (response.success && response.data) {
        // Save token and user info
        localStorage.setItem('token', response.data.token)
        localStorage.setItem('user', JSON.stringify({
          user_id: response.data.user_id,
          email: response.data.email,
          username: response.data.username,
        }))

        // Redirect to dashboard
        router.push("/dashboard")
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

 return (
    <div className="min-h-screen bg-gradient-to-b from-rose-200 to-rose-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative clouds */}
      <div className="absolute top-8 left-12 w-20 h-12 bg-white rounded-full shadow-sm opacity-70"></div>
      <div className="absolute top-24 right-16 w-24 h-14 bg-white rounded-full shadow-sm opacity-70"></div>
      <div className="absolute bottom-32 left-8 w-28 h-16 bg-white rounded-full shadow-sm opacity-70"></div>
      <div className="absolute bottom-20 right-12 w-24 h-14 bg-white rounded-full shadow-sm opacity-70"></div>

      {/* Decorative paw prints */}
      <div className="absolute top-16 right-20 text-rose-400 text-3xl opacity-50">🐾</div>
      <div className="absolute top-40 left-10 text-rose-400 text-4xl opacity-50">🐾</div>
      <div className="absolute bottom-40 right-24 text-rose-400 text-3xl opacity-50">🐾</div>
      <div className="absolute bottom-24 left-16 text-rose-400 text-4xl opacity-50">🐾</div>

      <div className="w-full max-w-md p-8 space-y-8 bg-white/90 rounded-3xl shadow-2xl backdrop-blur-sm relative z-10">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-400 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
              <span className="text-white font-bold text-3xl">ZTO</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-rose-900">ZeroToOne</h1>
            <p className="text-rose-600 text-sm font-medium mt-1">Master Your Skills</p>
          </div>
        </div>

        {/* Login/Register Toggle */}
        <div className="flex gap-2 bg-rose-100 rounded-full p-1.5">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2.5 px-4 rounded-full transition font-semibold ${
              isLogin
                ? "bg-white text-rose-900 shadow-md"
                : "text-rose-700 hover:text-rose-900"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2.5 px-4 rounded-full transition font-semibold ${
              !isLogin
                ? "bg-white text-rose-900 shadow-md"
                : "text-rose-700 hover:text-rose-900"
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="flex items-center gap-2 text-rose-900 font-semibold mb-3">
              <Heart className="w-5 h-5 fill-rose-400 text-rose-400" />
              Username:
            </label>
            <Input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full text-base py-3 rounded-full bg-rose-50 border-2 border-rose-200 focus:border-rose-400 focus:ring-0 placeholder:text-rose-300"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="flex items-center gap-2 text-rose-900 font-semibold mb-3">
                <Heart className="w-5 h-5 fill-rose-400 text-rose-400" />
                Email:
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!isLogin}
                className="w-full text-base py-3 rounded-full bg-rose-50 border-2 border-rose-200 focus:border-rose-400 focus:ring-0 placeholder:text-rose-300"
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-rose-900 font-semibold mb-3">
              <Lock className="w-5 h-5 text-rose-400" />
              Password:
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full text-base py-3 rounded-full bg-rose-50 border-2 border-rose-200 focus:border-rose-400 focus:ring-0 placeholder:text-rose-300 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-rose-400 hover:text-rose-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-rose-400 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white py-3 text-lg font-bold rounded-full shadow-lg transform hover:scale-105 transition-all"
          >
            <span className="text-xl mr-2">✨</span>
            {isLogin ? "LOGIN" : "CREATE ACCOUNT"}
            <span className="text-xl ml-2">✨</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
