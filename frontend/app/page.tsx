// app/page.tsx
// xừ lí login và đăng ký
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card } from "../components/ui/card"
import { loginUser, registerUser } from "../lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      let response;

      if (isLogin) {
        // Login
        response = await loginUser(email, password)
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 bg-white shadow-lg">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-blue-600 text-white rounded-lg px-3 py-2 font-bold text-lg">SF</div>
            <h1 className="text-3xl font-bold text-gray-900">SpeakFlow</h1>
          </div>
          <p className="text-gray-500">Master English Today</p>
        </div>

        <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => {
              setIsLogin(true)
              setError("")
            }}
            className={`flex-1 py-2 px-4 rounded-md transition ${
              isLogin ? "bg-white shadow-sm font-medium" : "text-gray-600"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setIsLogin(false)
              setError("")
            }}
            className={`flex-1 py-2 px-4 rounded-md transition ${
              !isLogin ? "bg-white shadow-sm font-medium" : "text-gray-600"
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <Input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
                className="w-full text-lg py-6"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full text-lg py-6"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full text-lg py-6"
              disabled={loading}
              minLength={6}
            />
            {!isLogin && (
              <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {isLogin ? "Logging in..." : "Creating account..."}
              </span>
            ) : (
              isLogin ? "Login" : "Create Account"
            )}
          </Button>
        </form>

        {isLogin && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                onClick={() => setIsLogin(false)}
                className="text-blue-600 hover:underline font-medium"
              >
                Register here
              </button>
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}