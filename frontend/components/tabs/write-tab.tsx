"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search as SearchIcon, ArrowLeft, ChevronRight, Loader2 } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"

interface Topic {
  topic: string
  count: number
}

interface Question {
  id: string
  question: string
  topic: string
}

interface WriteTabProps {
  difficulty: string
}

async function fetchAllTopics(): Promise<Topic[]> {
  const res = await fetch(`${API_BASE}/writing/topics`)
  if (!res.ok) return []
  const data = await res.json()
  return data.topics ?? []
}

async function fetchQuestionsByTopic(topic: string, skip = 0, limit = 20): Promise<{ questions: Question[]; total: number }> {
  const res = await fetch(
    `${API_BASE}/writing/questions?topic=${encodeURIComponent(topic)}&skip=${skip}&limit=${limit}`
  )
  if (!res.ok) return { questions: [], total: 0 }
  return res.json()
}

async function searchQuestions(keyword: string, skip = 0, limit = 20): Promise<{ questions: Question[]; total: number }> {
  const res = await fetch(
    `${API_BASE}/writing/questions?search=${encodeURIComponent(keyword)}&skip=${skip}&limit=${limit}`
  )
  if (!res.ok) return { questions: [], total: 0 }
  return res.json()
}

async function fetchRandomQuestion(): Promise<Question | null> {
  const res = await fetch(`${API_BASE}/writing/questions/random`)
  if (!res.ok) return null
  return res.json()
}

function QuestionList({
  title, questions, total, loading, onBack, onSelect, onLoadMore, hasMore,
}: {
  title: string
  questions: Question[]
  total: number
  loading: boolean
  onBack?: () => void   // optional — omit to hide the Back button
  onSelect: (q: Question) => void
  onLoadMore: () => void
  hasMore: boolean
}) {
  return (
    <div className="space-y-6">
      {/* Header row — only rendered when onBack is provided */}
      {onBack && (
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 bg-white text-gray-800 px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-pink-700">{title}</h2>
            {total > 0 && <p className="text-sm text-gray-500">{total.toLocaleString()} questions</p>}
          </div>
        </div>
      )}

      {/* Title + count without Back button (used in search view) */}
      {!onBack && (
        <div>
          <h2 className="text-xl font-bold text-pink-700">{title}</h2>
          {total > 0 && <p className="text-sm text-gray-500">{total.toLocaleString()} questions</p>}
        </div>
      )}

      {loading && questions.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-600">No questions found</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {questions.map((q) => (
              <button
                key={q.id}
                onClick={() => onSelect(q)}
                className="w-full bg-white rounded-2xl p-5 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all text-left border-2 border-transparent hover:border-pink-300 group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">✍️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 group-hover:text-pink-600 transition-colors leading-snug">
                      {q.question}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{q.topic}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-pink-400 flex-shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="flex items-center gap-2 bg-pink-100 hover:bg-pink-200 text-pink-700 font-semibold px-6 py-3 rounded-full transition disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function WriteTab({ difficulty }: WriteTabProps) {
  const router = useRouter()

  const [view, setView] = useState<string>("main")
  const [loadingFreeWrite, setLoadingFreeWrite] = useState(false)

  const [topics, setTopics] = useState<Topic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(false)

  const [questions, setQuestions] = useState<Question[]>([])
  const [questionsTotal, setQuestionsTotal] = useState(0)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionsSkip, setQuestionsSkip] = useState(0)
  const [activeTopic, setActiveTopic] = useState("")

  const [searchQuery, setSearchQuery] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const LIMIT = 20

  useEffect(() => {
    if (view !== "topics") return
    setTopicsLoading(true)
    fetchAllTopics()
      .then(setTopics)
      .finally(() => setTopicsLoading(false))
  }, [view])

  useEffect(() => {
    if (view !== "search-results") return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!searchQuery.trim()) {
      setQuestions([])
      setQuestionsTotal(0)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setQuestionsLoading(true)
      setQuestionsSkip(0)
      const data = await searchQuestions(searchQuery, 0, LIMIT)
      setQuestions(data.questions)
      setQuestionsTotal(data.total)
      setQuestionsLoading(false)
    }, 350)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, view])

  const handleFreeWrite = async () => {
    setLoadingFreeWrite(true)
    try {
      const q = await fetchRandomQuestion()
      if (q) {
        router.push(`/write?topic=${encodeURIComponent(q.question)}&id=${q.id}`)
      } else {
        router.push("/write")
      }
    } catch {
      router.push("/write")
    } finally {
      setLoadingFreeWrite(false)
    }
  }

  const handleTopicClick = async (topic: string) => {
    setActiveTopic(topic)
    setQuestions([])
    setQuestionsSkip(0)
    setView("topic-questions")
    setQuestionsLoading(true)
    const data = await fetchQuestionsByTopic(topic, 0, LIMIT)
    setQuestions(data.questions)
    setQuestionsTotal(data.total)
    setQuestionsLoading(false)
  }

  const handleLoadMore = async () => {
    const nextSkip = questionsSkip + LIMIT
    setQuestionsLoading(true)
    const data = view === "search-results"
      ? await searchQuestions(searchQuery, nextSkip, LIMIT)
      : await fetchQuestionsByTopic(activeTopic, nextSkip, LIMIT)
    setQuestions((prev) => [...prev, ...data.questions])
    setQuestionsTotal(data.total)
    setQuestionsSkip(nextSkip)
    setQuestionsLoading(false)
  }

  const handleQuestionSelect = (q: Question) => {
    router.push(`/write?topic=${encodeURIComponent(q.question)}&id=${q.id}`)
  }

  const handleBackToMain = () => {
    setView("main")
    setSearchQuery("")
    setQuestions([])
    setQuestionsSkip(0)
  }

  const handleBackToTopics = () => {
    setView("topics")
    setQuestions([])
    setQuestionsSkip(0)
  }

  // ─── VIEW: topic-questions ───
  if (view === "topic-questions") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-200 to-pink-100 rounded-3xl p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <QuestionList
            title={activeTopic}
            questions={questions}
            total={questionsTotal}
            loading={questionsLoading}
            onBack={handleBackToTopics}
            onSelect={handleQuestionSelect}
            onLoadMore={handleLoadMore}
            hasMore={questions.length < questionsTotal}
          />
        </div>
      </div>
    )
  }

  // ─── VIEW: search-results ───
  if (view === "search-results") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-200 to-pink-100 rounded-3xl p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Single Back button — owned by this view, not QuestionList */}
          <button
            onClick={handleBackToMain}
            className="flex items-center gap-2 bg-white text-gray-800 px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="bg-gradient-to-r from-orange-400 to-rose-400 rounded-3xl p-8 shadow-lg">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
                <span>⭐</span> Writing Practice Corner <span>⭐</span>
              </h1>
            </div>
            <div className="flex gap-3 flex-col sm:flex-row">
              <input
                type="text"
                autoFocus
                placeholder="Type to search writing questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-6 py-3 rounded-full bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 font-medium"
              />
              <div className="bg-orange-500 text-white px-8 py-3 rounded-full font-bold shadow-lg flex items-center justify-center gap-2 whitespace-nowrap">
                {questionsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <SearchIcon className="w-5 h-5" />}
                Search
              </div>
            </div>
          </div>

          {/* QuestionList WITHOUT onBack → no duplicate Back button */}
          {searchQuery.trim() && (
            <QuestionList
              title={`Results for "${searchQuery}"`}
              questions={questions}
              total={questionsTotal}
              loading={questionsLoading}
              onSelect={handleQuestionSelect}
              onLoadMore={handleLoadMore}
              hasMore={questions.length < questionsTotal}
            />
          )}
        </div>
      </div>
    )
  }

  // ─── VIEW: main ───
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-200 via-pink-100 to-orange-100 rounded-3xl p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-8 left-6 text-4xl animate-bounce">💖</div>
      <div className="absolute top-20 right-8 text-3xl animate-pulse">✨</div>
      <div className="absolute top-12 right-1/3 text-3xl">✦</div>
      <div className="absolute bottom-32 left-8 text-3xl animate-pulse">💖</div>
      <div className="absolute bottom-20 right-6 text-4xl">💖</div>
      <div className="absolute top-1/2 right-12 text-2xl animate-bounce" style={{ animationDelay: "0.3s" }}>✨</div>
      <div className="absolute bottom-40 left-1/4 text-2xl animate-pulse">✦</div>
      <div className="absolute top-1/3 left-10 text-3xl">✨</div>
      <div className="absolute bottom-1/4 right-1/4 text-2xl animate-bounce" style={{ animationDelay: "0.5s" }}>✦</div>

      <div className="relative z-10 max-w-2xl mx-auto">
        <div className="space-y-6">

          {/* Free Writing */}
          <button
            onClick={handleFreeWrite}
            disabled={loadingFreeWrite}
            className="w-full group relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-300 to-pink-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border-2 border-pink-300 hover:border-pink-400 disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100"
          >
            <div className="p-8 relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-2xl">✍️</span>
                <h3 className="text-2xl font-bold text-pink-700">FREE WRITING</h3>
                <span className="text-2xl">✍️</span>
              </div>
              <p className="text-center text-pink-700 font-semibold mb-6">Write anything your heart desires!</p>
              <div className="flex justify-center">
                <div className="bg-gradient-to-r from-pink-400 to-rose-300 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg flex items-center gap-2 transform group-hover:scale-110 transition-transform">
                  {loadingFreeWrite
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</>
                    : <>✨ START</>}
                </div>
              </div>
            </div>
          </button>

          {/* Search question */}
          <button
            onClick={() => setView("search-results")}
            className="w-full group relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-300 to-orange-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border-2 border-orange-300 hover:border-orange-400"
          >
            <div className="p-8 relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-2xl">🔍</span>
                <h3 className="text-2xl font-bold text-orange-700">SEARCH QUESTION</h3>
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-center text-orange-700 font-semibold mb-6">Find a specific writing question!</p>
              <div className="flex justify-center">
                <div className="bg-gradient-to-r from-orange-400 to-amber-300 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg transform group-hover:scale-110 transition-transform">
                  ✨ SEARCH
                </div>
              </div>
            </div>
          </button>

        </div>
      </div>
    </div>
  )
}