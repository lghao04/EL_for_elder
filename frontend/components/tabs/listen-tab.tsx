"use client"

import Link from "next/link"
import { useState, useEffect } from "react"

interface ListeningItem {
  id: string
  title: string
}

export default function ListenTab() {
  const [items, setItems] = useState<ListeningItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/listen/?level=easy&skip=0&limit=20")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch")
        return res.json()
      })
      .then((data) => {
        setItems(data.data || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // ── Loading ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">❌ Lỗi tải dữ liệu</p>
        <p className="text-sm text-red-500 mt-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, index) => (
          <Link key={item.id} href={`/listen?id=${item.id}`} className="block">
            <div className="w-full bg-white rounded-2xl p-5 shadow-lg border-4 border-orange-200 flex items-center gap-4 hover:shadow-xl hover:scale-105 transition-all cursor-pointer">

              {/* Index */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                {index + 1}
              </div>

              {/* Topic as title */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-orange-700 truncate">
                  {item.title || `Bài ${index + 1}`}
                </h3>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 text-orange-400 text-xl">›</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}