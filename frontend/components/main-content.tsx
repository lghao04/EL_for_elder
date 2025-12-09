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
    <div className="flex flex-col gap-6 h-full">
      {/* Large Tab Bar */}
      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab("listen")}
          className={`flex-1 py-6 px-8 rounded-2xl text-3xl font-bold transition-all shadow-lg ${
            activeTab === "listen" ? "bg-green-400 text-white scale-105" : "bg-white text-green-600 hover:bg-green-50"
          }`}
        >
          👂 LISTEN
        </button>
        <button
          onClick={() => setActiveTab("speak")}
          className={`flex-1 py-6 px-8 rounded-2xl text-3xl font-bold transition-all shadow-lg ${
            activeTab === "speak" ? "bg-pink-400 text-white scale-105" : "bg-white text-pink-600 hover:bg-pink-50"
          }`}
        >
          🎤 SPEAK
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
