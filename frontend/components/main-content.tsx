"use client"
import ListenTab from "./../components/tabs/listen-tab"
import SpeakTab from "./../components/tabs/speak-tab"

interface MainContentProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  difficulty: string
}

export default function MainContent({ activeTab, setActiveTab, difficulty }: MainContentProps) {
  return (
    <div className="flex flex-col gap-6 flex-1">
      {/* Tab Bar */}
      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab("listen")}
          className={`px-8 py-3 rounded-lg font-semibold transition-all ${
            activeTab === "listen" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          👂 Listening
        </button>
        <button
          onClick={() => setActiveTab("speak")}
          className={`px-8 py-3 rounded-lg font-semibold transition-all ${
            activeTab === "speak" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          🔧 Speaking
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "listen" && <ListenTab />}
        {activeTab === "speak" && <SpeakTab difficulty={difficulty} />}
      </div>
    </div>
  )
}
