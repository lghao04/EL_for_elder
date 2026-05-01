"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Header from "@/components/header"

export default function WritingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [essay, setEssay] = useState("")
  const [fontSize, setFontSize] = useState(16)
  const [lineHeight, setLineHeight] = useState(1.5)
  const [fontFamily, setFontFamily] = useState("sans")

  // Đọc topic từ URL params — do write-tab.tsx truyền vào
  // Fallback về chuỗi rỗng nếu không có (vd: navigate thẳng vào /write)
  const essayPrompt =
    searchParams.get("topic") ??
    "Write about anything you'd like. Express your thoughts freely!"

  const handleSubmit = () => {
    if (essay.trim()) {
      console.log("Essay submitted:", essay)
      alert("Essay submitted successfully!")
      router.push("/dashboard")
    }
  }

  const fontFamilyMap = {
    sans: "font-sans",
    serif: "font-serif",
    mono: "font-mono",
  }

  const characterCount = essay.length
  const wordCount = essay.split(/\s+/).filter((w) => w).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-rose-100 to-pink-100">
      <Header userAvatar="👧" />

      <div className="p-6 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex flex-col">

          <button
            onClick={() => router.back()}
            className="mb-6 bg-white px-6 py-3 rounded-xl font-bold text-lg text-gray-700 hover:bg-gray-100 transition shadow-lg border-3 border-orange-300 w-fit"
          >
            ← Back
          </button>

          <div className="text-center mb-6">
            <h1 className="text-4xl md:text-5xl font-bold text-pink-600">
              Writing Practice
            </h1>
          </div>

          <div className="flex-1 flex flex-col gap-6">

            {/* Topic */}
            <div className="bg-white/90 backdrop-blur rounded-3xl p-6 shadow-lg border-4 border-pink-200">
              <h2 className="text-xl font-bold text-pink-600 mb-4">Topic:</h2>
              <p className="text-gray-800 leading-relaxed font-medium">{essayPrompt}</p>
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col">
              <div className="bg-white/90 backdrop-blur rounded-3xl p-8 shadow-lg border-4 border-pink-200 flex flex-col h-full">

                {/* Toolbar */}
                <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b-2 border-pink-200">
                  <div>
                    <label className="block text-sm font-bold text-pink-700 mb-2">Font Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min="12" max="24" value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="flex-1 cursor-pointer accent-pink-500"
                      />
                      <span className="text-xs font-bold text-pink-700 w-8">{fontSize}px</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-pink-700 mb-2">Font Family</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-pink-300 rounded-lg bg-white text-pink-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="sans">Sans Serif</option>
                      <option value="serif">Serif</option>
                      <option value="mono">Monospace</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-pink-700 mb-2">Line Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min="1" max="3" step="0.5" value={lineHeight}
                        onChange={(e) => setLineHeight(Number(e.target.value))}
                        className="flex-1 cursor-pointer accent-pink-500"
                      />
                      <span className="text-xs font-bold text-pink-700 w-8">{lineHeight}</span>
                    </div>
                  </div>
                </div>

                {/* Textarea */}
                <div className="flex-1 mb-4 min-h-96">
                  <textarea
                    value={essay}
                    onChange={(e) => {
                      setEssay(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = e.target.scrollHeight + "px"
                    }}
                    className={`w-full p-6 border-2 border-pink-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none bg-pink-50/50 text-gray-800 placeholder:text-pink-300 ${fontFamilyMap[fontFamily as keyof typeof fontFamilyMap]}`}
                    style={{ fontSize: `${fontSize}px`, lineHeight }}
                    placeholder="Start writing your essay here..."
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t-2 border-pink-200">
                  <div className="text-sm font-semibold text-pink-700">
                    {characterCount} characters · {wordCount} words
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!essay.trim()}
                    className={`px-8 py-3 rounded-full font-bold text-white text-lg transition-all ${
                      essay.trim()
                        ? "bg-gradient-to-r from-pink-400 to-pink-500 hover:scale-105"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Submit Essay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}