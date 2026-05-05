// app/profile/page.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { isAuthenticated, getToken, uploadProfileImage, updateProfile } from "@/lib/api"

export default function ProfilePage() {
  const router = useRouter()

  const [user, setUser] = useState<{
    username: string
    email: string
    account_name?: string
    profile_image?: string
  } | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [accountName, setAccountName] = useState("")
  const [previewImage, setPreviewImage] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/"); return }
    const userData = localStorage.getItem("user")
    if (!userData) { router.push("/"); return }
    const parsed = JSON.parse(userData)
    setUser(parsed)
    setAccountName(parsed.account_name || "")
    setPreviewImage(parsed.profile_image || "")
  }, [router])

  useEffect(() => {
    return () => {
      if (previewImage.startsWith("blob:")) URL.revokeObjectURL(previewImage)
    }
  }, [previewImage])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Chỉ chấp nhận ảnh jpg/png/webp"); return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Ảnh không được vượt quá 2MB"); return
    }
    setPendingFile(file)
    setPreviewImage(URL.createObjectURL(file))
    setError(null)
  }

  const handleSave = async () => {
    const token = getToken()
    if (!token) { router.push("/"); return }

    setIsSaving(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const payload: { account_name?: string; profile_image?: string } = {}

      if (accountName !== (user?.account_name || "")) payload.account_name = accountName

      if (pendingFile) {
        const cloudinaryUrl = await uploadProfileImage(token, pendingFile)
        payload.profile_image = cloudinaryUrl
      }

      if (Object.keys(payload).length === 0) { setIsEditing(false); return }

      await updateProfile(token, payload)

      const updatedUser = {
        ...user,
        account_name: accountName,
        profile_image: payload.profile_image ?? user?.profile_image ?? "",
      }
      localStorage.setItem("user", JSON.stringify(updatedUser))

      window.dispatchEvent(new CustomEvent("user-profile-updated", {
        detail: {
          account_name: accountName,
          profile_image: payload.profile_image ?? user?.profile_image ?? "",
        }
      }))

      setUser(updatedUser)
      setPreviewImage(updatedUser.profile_image || "")
      setPendingFile(null)
      setIsEditing(false)
      setSuccessMsg("Cập nhật profile thành công!")
      setTimeout(() => setSuccessMsg(null), 3000)

    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra, thử lại sau")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setAccountName(user?.account_name || "")
    setPreviewImage(user?.profile_image || "")
    setPendingFile(null)
    setError(null)
    setIsEditing(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-200 to-pink-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-200 to-pink-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-pink-600 text-white rounded-lg px-3 py-2 font-bold text-lg">STO</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ZerotoOne</h1>
              <p className="text-sm text-gray-500">Master English Today</p>
            </div>
          </div>
          <Button onClick={() => router.push("/dashboard")} variant="outline"
            className="bg-pink-200 text-pink-700 hover:bg-pink-300 transition-colors">
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 mt-8">
        <Card className="p-10 bg-pink-100 shadow-lg rounded-3xl border-0">
          <h2 className="text-3xl font-bold text-pink-600 mb-8">ACCOUNT INFORMATION</h2>

          {successMsg && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-green-100 text-green-700 font-medium">
              ✅ {successMsg}
            </div>
          )}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-100 text-red-700 font-medium">
              ❌ {error}
            </div>
          )}

          <div className="flex gap-10 items-start">
            {/* LEFT */}
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-pink-700 mb-1">Username:</label>
                <p className="text-2xl text-pink-600 font-bold">{user.username}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-pink-700 mb-1">Full Name:</label>
                {isEditing ? (
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Enter your full name"
                    className="text-pink-700 font-semibold text-lg border-0 bg-transparent px-0 focus:ring-0"
                    maxLength={100}
                  />
                ) : (
                  <p className="text-2xl text-pink-600 font-bold">
                    {user.account_name || "Not set"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-pink-700 mb-1">Email:</label>
                <p className="text-2xl text-pink-600 font-bold">{user.email}</p>
              </div>
            </div>

            {/* RIGHT — Avatar */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2">
              <div className="relative group">
                <div className="w-40 h-40 bg-pink-400 rounded-full shadow-lg flex items-center justify-center overflow-hidden border-4 border-pink-300">
                  {previewImage ? (
                    <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl">👤</span>
                  )}
                </div>

                {isEditing && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <span className="text-3xl">✏️</span>
                  </button>
                )}
              </div>

              {isEditing && (
                <p className="text-xs text-pink-400">jpg/png/webp · tối đa 2MB</p>
              )}
              {pendingFile && (
                <p className="text-xs text-pink-500 font-medium">⏳ Ảnh mới chưa lưu</p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center pt-10 mt-8 border-t border-pink-300">
            {isEditing ? (
              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-10 py-3 rounded-full font-bold text-lg disabled:opacity-60"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      {pendingFile ? "Đang upload ảnh..." : "Đang lưu..."}
                    </span>
                  ) : "Save Changes"}
                </Button>

                <Button
                  onClick={handleCancel}
                  disabled={isSaving}
                  variant="outline"
                  className="px-10 py-3 rounded-full font-bold text-lg border-pink-300 text-pink-600 hover:bg-pink-50"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-pink-600 hover:bg-pink-700 text-white px-10 py-3 rounded-full font-bold text-lg flex items-center gap-2"
              >
                ✏️ EDIT PROFILE
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}