"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import Header from "@/components/header"
import ListeningDetail, { type ListeningItem } from "@/components/listening-detail"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

function ListenContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id")

  const [item, setItem] = useState<ListeningItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [genLoading, setGenLoading] = useState(false)

  useEffect(() => {
    if (!id) { setError("No lesson ID provided"); setLoading(false); return }

    fetch(`${API}/listen/${id}`)
      .then((res) => { if (!res.ok) throw new Error(`Lỗi ${res.status}`); return res.json() })
      .then(async (data) => {
        if (data.generated_questions?.length > 0) {
          setItem(data)
          setLoading(false)
        } else {
          setItem(data)
          setLoading(false)
          setGenLoading(true)
          const res = await fetch(`${API}/listen/${data.id}/generate-questions`, { method: "POST" })
          if (!res.ok) throw new Error(`Lỗi generate ${res.status}`)
          const full = await res.json()
          setItem(full)
          setGenLoading(false)
        }
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
        setGenLoading(false)
      })
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" />
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Đang tải bài học...</p>
        </div>
      </div>
    </div>
  )

  if (error || !item) return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-100 to-pink-100">
      <Header userAvatar="👧" />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-12 text-center">
          <p className="text-red-600 font-bold text-2xl mb-2">❌ Lỗi</p>
          <p className="text-red-500">{error || "Không tìm thấy bài học"}</p>
        </div>
      </div>
    </div>
  )

  return <ListeningDetail item={item} genLoading={genLoading} />
}

export default function ListenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-yellow-100 to-pink-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600" />
      </div>
    }>
      <ListenContent />
    </Suspense>
  )
}