"use client"

interface RightSidebarProps {
  difficulty: string
  setDifficulty: (diff: string) => void
}

export default function RightSidebar({ difficulty, setDifficulty }: RightSidebarProps) {
  return (
    <div className="w-72 flex flex-col gap-6">
      {/* Progress Statistics */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border-4 border-purple-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Your Progress</h3>

        <div className="space-y-4">
          <div className="bg-gradient-to-r from-yellow-300 to-orange-300 rounded-xl p-4 text-center">
            <p className="text-lg text-white">Total Points</p>
            <p className="text-4xl font-bold text-white">1,250</p>
          </div>

          <div className="bg-gradient-to-r from-pink-300 to-red-300 rounded-xl p-4 text-center">
            <p className="text-lg text-white">Badges Earned</p>
            <p className="text-4xl font-bold text-white">🏆 12</p>
          </div>

          <div className="bg-gradient-to-r from-green-300 to-emerald-300 rounded-xl p-4 text-center">
            <p className="text-lg text-white">Current Streak</p>
            <p className="text-4xl font-bold text-white">🔥 5 days</p>
          </div>
        </div>
      </div>

      {/* Difficulty Switcher */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border-4 border-blue-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Difficulty Level</h3>

        <div className="space-y-3">
          {["easy", "normal", "hard"].map((level) => (
            <button
              key={level}
              onClick={() => setDifficulty(level)}
              className={`w-full py-4 px-4 rounded-xl font-bold text-xl transition ${
                difficulty === level
                  ? "bg-blue-500 text-white shadow-lg scale-105"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              {level === "easy" ? "😊 Easy" : level === "normal" ? "😐 Normal" : "🤓 Hard"}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
