
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search as SearchIcon, ArrowLeft } from "lucide-react"

interface WriteTabProps {
  difficulty: string
}

const topicsBySubject = {
  "Nature & Environment": [
    "The beauty of sunrise",
    "My favorite outdoor adventure",
    "Climate change and its impact",
    "Life on a farm",
    "The ocean and its mysteries",
  ],
  Technology: [
    "How technology changed my life",
    "The future of artificial intelligence",
    "Social media and society",
    "Video games and entertainment",
    "Cybersecurity importance",
  ],
  "Personal Growth": [
    "My biggest achievement",
    "Overcoming a challenge",
    "What I learned from failure",
    "My life goals",
    "The person I want to become",
  ],
  Relationships: [
    "Friendship means to me",
    "Family traditions I cherish",
    "A person who inspired me",
    "Communication in relationships",
    "Love and trust",
  ],
  "Travel & Culture": [
    "My dream destination",
    "A memorable trip",
    "Cultural differences I've noticed",
    "Traveling alone",
    "Food from different cultures",
  ],
  "Education & Learning": [
    "My favorite subject to learn",
    "The importance of education",
    "A skill I want to master",
    "Online vs traditional learning",
    "My educational journey",
  ],
}

export default function WriteTab({ difficulty }: WriteTabProps) {
  const router = useRouter()

  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const handleSelectMode = (mode: string) => {
    if (mode === "freewriting") {
      router.push("/write")
      return
    }

    setSelectedMode(mode)
  }

  const handleBack = () => {
    setSelectedMode(null)
    setSearchQuery("")
  }

  const handleTopicSelect = (topic: string) => {
    router.push(`/write?topic=${encodeURIComponent(topic)}`)
  }

  const subjects = Object.keys(topicsBySubject)

  const filteredSubjects = subjects.filter(
    (subject) =>
      subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topicsBySubject[subject as keyof typeof topicsBySubject].some((topic) =>
        topic.toLowerCase().includes(searchQuery.toLowerCase())
      )
  )

  // =============================
  // TOPIC MODE
  // =============================
  if (selectedMode === "topics") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-200 to-pink-100 rounded-3xl p-6 md:p-8 relative">
        <div className="max-w-4xl mx-auto">
          {/* Back */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 bg-white text-gray-800 px-4 py-2 rounded-full font-semibold hover:bg-gray-100 transition shadow-md mb-8"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          {/* Header */}
          <div className="bg-gradient-to-r from-orange-400 to-rose-400 rounded-3xl p-8 shadow-lg mb-8">
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center justify-center gap-2">
                <span>⭐</span>
                Writing Practice Corner
                <span>⭐</span>
              </h1>
            </div>

            {/* Search */}
            <div className="flex gap-3 flex-col sm:flex-row">
              <input
                type="text"
                placeholder="Search writing topics here..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-6 py-3 rounded-full bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 font-medium"
              />

              <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full font-bold transition-colors shadow-lg flex items-center justify-center gap-2 whitespace-nowrap">
                <SearchIcon className="w-5 h-5" />
                Search
              </button>
            </div>
          </div>

          {/* Topics */}
          <div className="space-y-8">
            {filteredSubjects.length > 0 ? (
              filteredSubjects.map((subject) => (
                <div key={subject} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-pink-700">
                      {subject}
                    </h2>

                    <div className="flex-1 h-1 bg-gradient-to-r from-pink-300 to-transparent rounded-full"></div>

                    <span className="text-sm font-semibold text-pink-600 bg-pink-100 px-3 py-1 rounded-full">
                      {
                        topicsBySubject[
                          subject as keyof typeof topicsBySubject
                        ].length
                      }{" "}
                      topics
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {topicsBySubject[
                      subject as keyof typeof topicsBySubject
                    ].map((topic, index) => (
                      <button
                        key={index}
                        onClick={() => handleTopicSelect(topic)}
                        className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg hover:scale-105 transition-all text-left border-2 border-transparent hover:border-pink-300 group"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl flex-shrink-0">✍️</span>

                          <div>
                            <p className="font-semibold text-gray-800 group-hover:text-pink-600 transition-colors">
                              {topic}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              Click to start writing
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-xl text-gray-600">
                  No topics found matching "{searchQuery}"
                </p>
                <p className="text-gray-500 mt-2">
                  Try searching for something else
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // =============================
  // MAIN MODE SELECT
  // =============================
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-200 via-pink-100 to-orange-100 rounded-3xl p-6 md:p-12 relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-8 left-6 text-4xl animate-bounce">💖</div>
      <div className="absolute top-20 right-8 text-3xl animate-pulse">✨</div>
      <div className="absolute top-12 right-1/3 text-3xl">✦</div>
      <div className="absolute bottom-32 left-8 text-3xl animate-pulse">💖</div>
      <div className="absolute bottom-20 right-6 text-4xl">💖</div>

      <div
        className="absolute top-1/2 right-12 text-2xl animate-bounce"
        style={{ animationDelay: "0.3s" }}
      >
        ✨
      </div>

      <div className="absolute bottom-40 left-1/4 text-2xl animate-pulse">
        ✦
      </div>

      <div className="absolute top-1/3 left-10 text-3xl">✨</div>

      <div
        className="absolute bottom-1/4 right-1/4 text-2xl animate-bounce"
        style={{ animationDelay: "0.5s" }}
      >
        ✦
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-pink-600 mb-2">
            ✨ WRITING MODE ✨
          </h1>
          <p className="text-lg text-pink-700 font-semibold">
            Choose your writing adventure
          </p>
        </div>

        {/* Cards */}
        <div className="space-y-6">
          {/* Free Writing */}
          <button
            onClick={() => handleSelectMode("freewriting")}
            className="w-full group relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-300 to-pink-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border-2 border-pink-300 hover:border-pink-400"
          >
            <div className="p-8 relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-2xl">✍️</span>
                <h3 className="text-2xl font-bold text-pink-700">
                  FREE WRITING
                </h3>
                <span className="text-2xl">✍️</span>
              </div>

              <p className="text-center text-pink-700 font-semibold mb-6">
                Write anything your heart desires!
              </p>

              <div className="flex justify-center">
                <div className="bg-gradient-to-r from-pink-400 to-rose-300 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg transform group-hover:scale-110 transition-transform">
                  ✨ START WRITING
                </div>
              </div>
            </div>
          </button>

          {/* Topics */}
          <button
            onClick={() => handleSelectMode("topics")}
            className="w-full group relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-300 to-orange-200 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border-2 border-orange-300 hover:border-orange-400"
          >
            <div className="p-8 relative z-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-2xl">🔍</span>
                <h3 className="text-2xl font-bold text-orange-700">
                  SEARCH TOPIC
                </h3>
                <span className="text-2xl">🔍</span>
              </div>

              <p className="text-center text-orange-700 font-semibold mb-6">
                Find the perfect writing prompt!
              </p>

              <div className="flex justify-center">
                <div className="bg-gradient-to-r from-orange-400 to-amber-300 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg transform group-hover:scale-110 transition-transform">
                  ✨ FIND MY TOPIC
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
