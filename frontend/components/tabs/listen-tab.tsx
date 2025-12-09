"use client"
import Link from "next/link"

interface Lesson {
  id: number
  topic: string
  title: string
  difficulty: "easy" | "medium" | "hard"
}

const lessons: Lesson[] = [
  { id: 1, topic: "Greetings", title: "Hello and Goodbye", difficulty: "easy" },
  { id: 2, topic: "Numbers", title: "Counting 1-10", difficulty: "easy" },
  { id: 3, topic: "Colors", title: "Learn the Rainbow", difficulty: "easy" },
  { id: 4, topic: "Food", title: "Common Foods", difficulty: "medium" },
  { id: 5, topic: "Animals", title: "Animal Sounds", difficulty: "medium" },
]

export default function ListenTab() {
  return (
    <div className="space-y-4">
      {/* Lessons List */}
      <div className="space-y-3">
        {lessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/lesson?id=${lesson.id}&title=${encodeURIComponent(lesson.title)}&topic=${encodeURIComponent(lesson.topic)}`}
          >
            <button className="w-full bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition border-4 border-blue-200 flex items-center justify-between hover:scale-105 cursor-pointer">
              <div className="flex-1 text-left">
                <h3 className="text-2xl font-bold text-gray-800">{lesson.title}</h3>
                <p className="text-lg text-gray-600">{lesson.topic}</p>
              </div>

              <div className="flex gap-4 ml-4">
                <button className="bg-green-400 hover:bg-green-500 text-white rounded-full p-6 transition shadow-lg transform hover:scale-110">
                  <span className="text-4xl">▶️</span>
                </button>
                <button className="bg-orange-400 hover:bg-orange-500 text-white rounded-full p-6 transition shadow-lg transform hover:scale-110">
                  <span className="text-3xl">📊</span>
                </button>
                <button className="bg-purple-400 hover:bg-purple-500 text-white rounded-full p-6 transition shadow-lg transform hover:scale-110">
                  <span className="text-3xl">❓</span>
                </button>
              </div>
            </button>
          </Link>
        ))}
      </div>
    </div>
  )
}
