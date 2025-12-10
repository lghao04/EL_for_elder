"use client"

interface RightSidebarProps {
  difficulty: string
  setDifficulty: (diff: string) => void
}

export default function RightSidebar({ difficulty, setDifficulty }: RightSidebarProps) {
  return (
    <div className="w-80 flex flex-col gap-6">
      {/* Your Progress */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Your Progress</h3>

        <div className="space-y-3">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-gray-600 flex items-center gap-2">⭐ Total Points</p>
            <p className="text-3xl font-bold text-gray-900">1,250</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <p className="text-sm text-gray-600 flex items-center gap-2">🏅 Badges Earned</p>
            <p className="text-3xl font-bold text-gray-900">12</p>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <p className="text-sm text-gray-600 flex items-center gap-2">🔥 Current Streak</p>
            <p className="text-3xl font-bold text-gray-900">5 days</p>
          </div>
        </div>
      </div>

      {/* Difficulty Level */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Difficulty Level</h3>

        <div className="space-y-2">
          {[
            { value: "easy", label: "😊 Easy" },
            { value: "normal", label: "😐 Normal" },
          ].map((level) => (
            <button
              key={level.value}
              onClick={() => setDifficulty(level.value)}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition ${
                difficulty === level.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
